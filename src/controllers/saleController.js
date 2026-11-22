const { Op } = require('sequelize');
const { Sale, Product, Customer, Payment, User, sequelize } = require('../models');

// @desc    Make a sale (Cash or Credit) and deduct product stock
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      productId,
      quantity = 1,
      unitPrice,
      saleType = 'Cash',
      customerId,
      downPayment = 0,
      paymentMethod = 'Cash',
      notes = ''
    } = req.body;

    if (!productId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Product is required' });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const product = await Product.findByPk(productId, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check stock
    if (product.stockQuantity < qty) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock! You only have ${product.stockQuantity} piece(s) of "${product.name}" in stock.`
      });
    }

    // Unit price
    const finalUnitPrice = parseFloat(unitPrice !== undefined && unitPrice !== '' ? unitPrice : product.sellingPrice);
    if (isNaN(finalUnitPrice) || finalUnitPrice < 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Valid unit price is required' });
    }

    const totalAmount = parseFloat((finalUnitPrice * qty).toFixed(2));
    const purchasePrice = parseFloat(product.purchasePrice) || 0;

    let customer = null;
    if (customerId) {
      customer = await Customer.findByPk(customerId, { transaction });
      if (!customer && saleType === 'Credit') {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Customer not found for credit sale' });
      }
    }

    let paidAmount = 0;
    let remainingBalance = 0;
    let creditStatus = null;

    if (saleType === 'Credit') {
      if (!customer) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'A registered customer is required to make a sale on credit'
        });
      }

      const initialDown = parseFloat(downPayment) || 0;
      if (initialDown > totalAmount) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Down payment cannot exceed the total sale amount'
        });
      }

      paidAmount = initialDown;
      remainingBalance = parseFloat((totalAmount - initialDown).toFixed(2));
      creditStatus = remainingBalance === 0 ? 'Fully Paid' : initialDown > 0 ? 'Partially Paid' : 'Pending';
    } else {
      // Cash sale - paid in full
      paidAmount = totalAmount;
      remainingBalance = 0;
      creditStatus = null;
    }

    // Deduct stock from product
    product.stockQuantity = product.stockQuantity - qty;
    await product.save({ transaction });

    // Create Sale record
    const sale = await Sale.create(
      {
        productId: product.id,
        customerId: customer ? customer.id : null,
        quantity: qty,
        unitPrice: finalUnitPrice,
        purchasePrice,
        totalAmount,
        paidAmount,
        remainingBalance,
        saleType,
        creditStatus,
        notes: notes || '',
        soldById: req.user.id,
        soldDate: new Date()
      },
      { transaction }
    );

    // If any cash was received (full cash or credit downpayment), create Payment entry
    let paymentRecord = null;
    if (paidAmount > 0) {
      paymentRecord = await Payment.create(
        {
          saleId: sale.id,
          customerId: customer ? customer.id : null,
          amount: paidAmount,
          paymentMethod: paymentMethod || 'Cash',
          notes: saleType === 'Credit'
            ? `Down payment for ${qty}x ${product.name}`
            : `Cash sale: ${qty}x ${product.name}`,
          recordedById: req.user.id,
          paymentDate: new Date()
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Successfully sold ${qty} piece(s) of "${product.name}". Remaining stock: ${product.stockQuantity}`,
      data: {
        ...sale.toJSON(),
        _id: sale.id,
        product: { id: product.id, _id: product.id, name: product.name, stockQuantity: product.stockQuantity },
        customer: customer ? { id: customer.id, _id: customer.id, name: customer.name } : null,
        payment: paymentRecord
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res, next) => {
  try {
    const { saleType, customerId, creditStatus } = req.query;

    const where = {};
    if (saleType) where.saleType = saleType;
    if (customerId) where.customerId = customerId;
    if (creditStatus) where.creditStatus = creditStatus;

    const sales = await Sale.findAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'brand', 'model', 'category'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'soldBy', attributes: ['id', 'name'] },
        { model: Payment, as: 'payments' }
      ],
      order: [['soldDate', 'DESC']]
    });

    const formatted = sales.map((s) => {
      const j = s.toJSON();
      return {
        ...j,
        _id: j.id,
        product: j.product ? { ...j.product, _id: j.product.id } : null,
        customer: j.customer ? { ...j.customer, _id: j.customer.id } : null
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record an installment payment for a credit sale
// @route   POST /api/sales/:id/payments
// @access  Private
exports.recordSalePayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'Cash', notes = '' } = req.body;

    const payVal = parseFloat(amount);
    if (isNaN(payVal) || payVal <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
    }

    const sale = await Sale.findByPk(id, {
      include: [
        { model: Product, as: 'product' },
        { model: Customer, as: 'customer' }
      ],
      transaction
    });

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Sale record not found' });
    }

    if (sale.remainingBalance <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'This credit sale is already fully paid!' });
    }

    if (payVal > sale.remainingBalance) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Payment amount ($${payVal}) exceeds remaining balance ($${sale.remainingBalance})`
      });
    }

    const newPaid = parseFloat((sale.paidAmount + payVal).toFixed(2));
    const newRemaining = parseFloat((sale.remainingBalance - payVal).toFixed(2));
    const newStatus = newRemaining === 0 ? 'Fully Paid' : 'Partially Paid';

    sale.paidAmount = newPaid;
    sale.remainingBalance = newRemaining;
    sale.creditStatus = newStatus;
    await sale.save({ transaction });

    const payment = await Payment.create(
      {
        saleId: sale.id,
        customerId: sale.customerId,
        amount: payVal,
        paymentMethod,
        notes: notes || `Credit payment for ${sale.product?.name || 'item'}`,
        recordedById: req.user.id,
        paymentDate: new Date()
      },
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Payment of $${payVal.toFixed(2)} recorded successfully. Remaining balance: $${newRemaining.toFixed(2)}`,
      data: {
        ...sale.toJSON(),
        _id: sale.id
      },
      payment
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
