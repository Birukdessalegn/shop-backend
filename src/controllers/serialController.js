const { Op } = require('sequelize');
const { SerialNumber, Product, Customer, Payment, User, sequelize } = require('../models');

// Helper to normalize objects with _id for frontend compatibility
const formatSerial = (instance) => {
  if (!instance) return null;
  const json = typeof instance.toJSON === 'function' ? instance.toJSON() : instance;
  return {
    ...json,
    _id: json.id,
    product: json.product ? { ...json.product, _id: json.product.id } : null,
    customer: json.customer ? { ...json.customer, _id: json.customer.id } : null,
    createdBy: json.createdBy ? { ...json.createdBy, _id: json.createdBy.id } : null
  };
};

// @desc    Quick verification of serial number ownership ("Is this our PC / item?")
// @route   GET /api/serials/verify/:serialNumber
// @access  Private
exports.verifySerial = async (req, res, next) => {
  try {
    const rawSerial = req.params.serialNumber?.trim();
    if (!rawSerial) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a serial number to verify'
      });
    }

    const serial = await SerialNumber.findOne({
      where: {
        serialNumber: { [Op.iLike]: rawSerial }
      },
      include: [
        { model: Product, as: 'product' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
        {
          model: Payment,
          as: 'payments',
          include: [{ model: User, as: 'recordedBy', attributes: ['id', 'name'] }]
        }
      ]
    });

    if (!serial) {
      return res.status(200).json({
        success: true,
        isOurShopItem: false,
        serialNumber: rawSerial.toUpperCase(),
        message: `Serial Number "${rawSerial.toUpperCase()}" is NOT registered in your shop.`
      });
    }

    const formatted = formatSerial(serial);

    let ownershipStatusText = 'In Shop (Available)';
    if (formatted.status === 'On Credit') {
      ownershipStatusText = formatted.customer
        ? `Out with Customer / Neighbor: ${formatted.customer.name}`
        : 'Out on Credit';
    } else if (formatted.status === 'Sold') {
      ownershipStatusText = 'Sold';
    } else if (formatted.status === 'Damaged') {
      ownershipStatusText = 'Damaged / Under Inspection';
    } else if (formatted.status === 'Returned') {
      ownershipStatusText = 'Returned by Customer';
    }

    res.status(200).json({
      success: true,
      isOurShopItem: true,
      ownershipStatusText,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all serial numbers with filters
// @route   GET /api/serials
// @access  Private
exports.getSerials = async (req, res, next) => {
  try {
    const { product, status, customer, saleType, creditStatus, search } = req.query;

    const where = {};

    if (product) where.productId = product;
    if (status && status !== 'All') where.status = status;
    if (customer) where.customerId = customer;
    if (saleType && saleType !== 'All') where.saleType = saleType;
    if (creditStatus && creditStatus !== 'All') where.creditStatus = creditStatus;

    if (search) {
      where[Op.or] = [
        { serialNumber: { [Op.iLike]: `%${search}%` } },
        { notes: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const serials = await SerialNumber.findAll({
      where,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'model', 'category', 'sellingPrice', 'purchasePrice']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'address', 'notes']
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formatted = serials.map(formatSerial);

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single serial number by ID with payment history
// @route   GET /api/serials/:id
// @access  Private
exports.getSerialById = async (req, res, next) => {
  try {
    const serial = await SerialNumber.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'product' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'createdBy', attributes: ['id', 'name', 'email'] },
        {
          model: Payment,
          as: 'payments',
          include: [{ model: User, as: 'recordedBy', attributes: ['id', 'name'] }]
        }
      ]
    });

    if (!serial) {
      return res.status(404).json({
        success: false,
        message: 'Serial number not found'
      });
    }

    res.status(200).json({
      success: true,
      data: formatSerial(serial)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register one or multiple serial numbers for a product
// @route   POST /api/serials
// @access  Private
exports.addSerials = async (req, res, next) => {
  try {
    const { productId, serialNumbers, notes } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Support single serial (string) or array of serials or comma-separated string
    let serialList = [];
    if (Array.isArray(serialNumbers)) {
      serialList = serialNumbers;
    } else if (typeof serialNumbers === 'string') {
      serialList = serialNumbers
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (serialList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one serial number'
      });
    }

    // Clean and uppercase
    const cleanedSerials = serialList.map((s) => s.trim().toUpperCase());

    // Check for internal duplicates within input
    const uniqueInput = [...new Set(cleanedSerials)];
    if (uniqueInput.length !== cleanedSerials.length) {
      return res.status(400).json({
        success: false,
        message: 'Input contains duplicate serial numbers within the submission'
      });
    }

    // Check if any already exist in database
    const existing = await SerialNumber.findAll({
      where: { serialNumber: { [Op.in]: uniqueInput } },
      attributes: ['serialNumber']
    });

    if (existing.length > 0) {
      const existingNames = existing.map((e) => e.serialNumber).join(', ');
      return res.status(400).json({
        success: false,
        message: `The following serial number(s) are already registered: ${existingNames}`
      });
    }

    // Prepare docs
    const docs = uniqueInput.map((sn) => ({
      serialNumber: sn,
      productId: product.id,
      status: 'Available',
      notes: notes || '',
      createdById: req.user.id
    }));

    const createdSerials = await SerialNumber.bulkCreate(docs);

    // Update product stockQuantity
    product.stockQuantity = (product.stockQuantity || 0) + createdSerials.length;
    await product.save();

    res.status(201).json({
      success: true,
      message: `Successfully registered ${createdSerials.length} serial number(s)`,
      count: createdSerials.length,
      data: createdSerials.map(formatSerial)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Credit Sale / Cash Sale / Handover to Neighbor Shop
// @route   POST /api/serials/:id/sell
// @access  Private
exports.sellSerial = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      saleType, // 'Credit' or 'Cash'
      customerId,
      creditAmount,
      downPayment, // initial cash paid at time of credit sale
      paymentMethod,
      notes
    } = req.body;

    const serial = await SerialNumber.findByPk(id, {
      include: [{ model: Product, as: 'product' }],
      transaction
    });

    if (!serial) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Serial number not found'
      });
    }

    if (serial.status !== 'Available') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Serial number is currently '${serial.status}'. Only 'Available' items can be sold or handed over.`
      });
    }

    if (!saleType || !['Cash', 'Credit'].includes(saleType)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "saleType must be either 'Cash' or 'Credit'"
      });
    }

    let customer = null;
    if (customerId) {
      customer = await Customer.findByPk(customerId, { transaction });
      if (!customer) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Customer / Neighbor shop not found'
        });
      }
    }

    if (saleType === 'Credit') {
      if (!customer) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'A registered customer or neighbor shop is required to make a sale/handover on credit'
        });
      }

      const totalCredit = parseFloat(
        creditAmount !== undefined ? creditAmount : serial.product.sellingPrice
      );
      if (totalCredit < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Credit amount cannot be negative'
        });
      }

      const initialPaid = parseFloat(downPayment) || 0;
      if (initialPaid < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Down payment cannot be negative'
        });
      }

      if (initialPaid > totalCredit) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Down payment cannot exceed total credit amount'
        });
      }

      serial.status = 'On Credit';
      serial.saleType = 'Credit';
      serial.customerId = customer.id;
      serial.creditAmount = totalCredit;
      serial.paidAmount = initialPaid;
      serial.remainingBalance = Math.max(0, parseFloat((totalCredit - initialPaid).toFixed(2)));
      serial.soldDate = new Date();
      if (notes) serial.notes = notes;

      if (serial.remainingBalance === 0) {
        serial.creditStatus = 'Fully Paid';
      } else if (initialPaid > 0) {
        serial.creditStatus = 'Partially Paid';
      } else {
        serial.creditStatus = 'Pending';
      }

      await serial.save({ transaction });

      // If initial down payment was made, record payment entry
      let paymentRecord = null;
      if (initialPaid > 0) {
        paymentRecord = await Payment.create(
          {
            serialNumberId: serial.id,
            customerId: customer.id,
            amount: initialPaid,
            paymentMethod: paymentMethod || 'Cash',
            notes: notes ? `Initial payment: ${notes}` : 'Initial payment at credit handover',
            recordedById: req.user.id,
            paymentDate: new Date()
          },
          { transaction }
        );
      }

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: 'Serial sold / handed over on credit successfully',
        data: formatSerial(serial),
        payment: paymentRecord
      });
    }

    // Cash sale
    const cashPrice = parseFloat(
      creditAmount !== undefined ? creditAmount : serial.product.sellingPrice
    );
    serial.status = 'Sold';
    serial.saleType = 'Cash';
    serial.customerId = customer ? customer.id : null;
    serial.creditAmount = 0.0;
    serial.paidAmount = cashPrice;
    serial.remainingBalance = 0.0;
    serial.creditStatus = null;
    serial.soldDate = new Date();
    if (notes) serial.notes = notes;

    await serial.save({ transaction });

    let cashPayment = null;
    if (customer) {
      cashPayment = await Payment.create(
        {
          serialNumberId: serial.id,
          customerId: customer.id,
          amount: cashPrice,
          paymentMethod: paymentMethod || 'Cash',
          notes: notes ? `Full cash sale: ${notes}` : 'Full cash sale',
          recordedById: req.user.id,
          paymentDate: new Date()
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Serial sold for cash successfully',
      data: formatSerial(serial),
      payment: cashPayment
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Record partial or full payment for an item on credit
// @route   POST /api/serials/:id/payments
// @access  Private
exports.recordPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes, markAsSoldWhenFullyPaid } = req.body;

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than zero'
      });
    }

    const serial = await SerialNumber.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Product, as: 'product' }
      ],
      transaction
    });

    if (!serial) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Serial number not found'
      });
    }

    if (serial.status !== 'On Credit' && serial.saleType !== 'Credit') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `This item is not on credit (current status: ${serial.status}). Payments can only be recorded for credit sales.`
      });
    }

    if (serial.remainingBalance <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'This credit account has already been fully paid'
      });
    }

    if (paymentAmount > serial.remainingBalance) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Payment amount (${paymentAmount}) exceeds remaining balance (${serial.remainingBalance})`
      });
    }

    // Create payment record
    const payment = await Payment.create(
      {
        serialNumberId: serial.id,
        customerId: serial.customerId,
        amount: paymentAmount,
        paymentMethod: paymentMethod || 'Cash',
        notes: notes || '',
        recordedById: req.user.id,
        paymentDate: new Date()
      },
      { transaction }
    );

    // Update serial paidAmount and remainingBalance
    serial.paidAmount = parseFloat((parseFloat(serial.paidAmount) + paymentAmount).toFixed(2));
    serial.remainingBalance = Math.max(
      0,
      parseFloat((parseFloat(serial.creditAmount) - parseFloat(serial.paidAmount)).toFixed(2))
    );

    if (serial.remainingBalance === 0) {
      serial.creditStatus = 'Fully Paid';
      if (markAsSoldWhenFullyPaid) {
        serial.status = 'Sold';
      }
    } else {
      serial.creditStatus = 'Partially Paid';
    }

    if (notes) {
      serial.notes = serial.notes ? `${serial.notes} | ${notes}` : notes;
    }

    await serial.save({ transaction });
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Payment of $${paymentAmount} recorded successfully. Remaining balance: $${serial.remainingBalance}`,
      data: {
        serial: formatSerial(serial),
        payment
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Update serial number details or status (e.g. Damaged, Returned, Available)
// @route   PUT /api/serials/:id
// @access  Private
exports.updateSerial = async (req, res, next) => {
  try {
    const { status, notes, serialNumber } = req.body;

    const serial = await SerialNumber.findByPk(req.params.id);
    if (!serial) {
      return res.status(404).json({
        success: false,
        message: 'Serial number not found'
      });
    }

    if (serialNumber && serialNumber !== serial.serialNumber) {
      const duplicate = await SerialNumber.findOne({
        where: {
          serialNumber: serialNumber.trim().toUpperCase(),
          id: { [Op.ne]: serial.id }
        }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Serial number already in use by another item'
        });
      }
      serial.serialNumber = serialNumber.trim().toUpperCase();
    }

    if (status) {
      // Validate transition: If returning from credit/sold back to Available
      if (status === 'Available' && (serial.status === 'On Credit' || serial.status === 'Sold')) {
        serial.customerId = null;
        serial.saleType = null;
        serial.creditStatus = null;
        serial.creditAmount = 0.0;
        serial.paidAmount = 0.0;
        serial.remainingBalance = 0.0;
        serial.soldDate = null;
      }
      serial.status = status;
    }

    if (notes !== undefined) {
      serial.notes = notes;
    }

    await serial.save();

    res.status(200).json({
      success: true,
      message: 'Serial number updated successfully',
      data: formatSerial(serial)
    });
  } catch (error) {
    next(error);
  }
};


exports.deleteSerial = async (req, res, next) => {
  try {
    const serial = await SerialNumber.findByPk(req.params.id);
    if (!serial) {
      return res.status(404).json({
        success: false,
        message: 'Serial number not found'
      });
    }

    if (serial.status === 'On Credit') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a serial number that is currently on credit with active balance'
      });
    }

    await Payment.destroy({ where: { serialNumberId: serial.id } });
    await serial.destroy();

    res.status(200).json({
      success: true,
      message: 'Serial number removed successfully'
    });
  } catch (error) {
    next(error);
  }
};
