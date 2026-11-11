const { Op } = require('sequelize');
const { Product, SerialNumber, Customer, Payment, User } = require('../models');

// @desc    Get comprehensive dashboard metrics
// @route   GET /api/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    // 1. Total products
    const totalProducts = await Product.count();

    // 2. Serial status counts
    const allSerials = await SerialNumber.findAll({
      attributes: ['status', 'creditAmount', 'paidAmount', 'remainingBalance']
    });

    let availableSerials = 0;
    let itemsOnCredit = 0;
    let itemsSold = 0;
    let itemsReturned = 0;
    let itemsDamaged = 0;
    let totalCreditOutstanding = 0;
    let totalCreditIssued = 0;

    allSerials.forEach((sn) => {
      const status = sn.status;
      if (status === 'Available') availableSerials += 1;
      if (status === 'On Credit') {
        itemsOnCredit += 1;
        totalCreditOutstanding += parseFloat(sn.remainingBalance) || 0;
        totalCreditIssued += parseFloat(sn.creditAmount) || 0;
      }
      if (status === 'Sold') itemsSold += 1;
      if (status === 'Returned') itemsReturned += 1;
      if (status === 'Damaged') itemsDamaged += 1;
    });

    // 3. Customers count
    const totalCustomers = await Customer.count();

    // 4. Total payments collected
    const totalCollected = (await Payment.sum('amount')) || 0;
    const totalPaymentsCount = await Payment.count();

    // 5. Recent credit items with outstanding balance
    const rawCreditItems = await SerialNumber.findAll({
      where: {
        status: 'On Credit',
        remainingBalance: { [Op.gt]: 0 }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'brand', 'model', 'sellingPrice']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone']
        }
      ],
      order: [['soldDate', 'DESC']],
      limit: 6
    });

    const recentCreditItems = rawCreditItems.map((item) => {
      const json = item.toJSON();
      return {
        ...json,
        _id: json.id,
        product: json.product ? { ...json.product, _id: json.product.id } : null,
        customer: json.customer ? { ...json.customer, _id: json.customer.id } : null
      };
    });

    // 6. Recent payments
    const rawPayments = await Payment.findAll({
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: SerialNumber, as: 'serialNumber', attributes: ['id', 'serialNumber'] },
        { model: User, as: 'recordedBy', attributes: ['id', 'name'] }
      ],
      order: [['paymentDate', 'DESC']],
      limit: 6
    });

    const recentPayments = rawPayments.map((p) => {
      const json = p.toJSON();
      return {
        ...json,
        _id: json.id,
        customer: json.customer ? { ...json.customer, _id: json.customer.id } : null,
        serialNumber: json.serialNumber ? { ...json.serialNumber, _id: json.serialNumber.id } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalProducts,
          availableSerials,
          itemsOnCredit,
          totalCreditOutstanding: +totalCreditOutstanding.toFixed(2),
          totalCreditIssued: +totalCreditIssued.toFixed(2),
          totalCustomers,
          itemsSold,
          itemsReturned,
          itemsDamaged,
          totalCollected: +totalCollected.toFixed(2),
          totalPaymentsCount
        },
        recentCreditItems,
        recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
};
