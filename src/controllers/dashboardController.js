const { Op } = require('sequelize');
const { Product, SerialNumber, Customer, Payment, User } = require('../models');

// @desc    Get comprehensive dashboard metrics & financial telemetry
// @route   GET /api/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    // 1. Total products
    const totalProducts = await Product.count();

    // 2. Serial status counts and financial aggregates
    const allSerials = await SerialNumber.findAll({
      attributes: [
        'status',
        'saleType',
        'creditAmount',
        'paidAmount',
        'remainingBalance',
        'soldDate',
        'createdAt'
      ],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category', 'purchasePrice', 'sellingPrice']
        }
      ]
    });

    let availableSerials = 0;
    let itemsOnCredit = 0;
    let itemsSold = 0;
    let itemsReturned = 0;
    let itemsDamaged = 0;
    let totalCreditOutstanding = 0;
    let totalCreditIssued = 0;
    let totalCashSales = 0;
    let totalCostOfSold = 0;
    let currentInventoryCost = 0;
    let currentInventoryRetail = 0;

    allSerials.forEach((sn) => {
      const status = sn.status;
      const cost = parseFloat(sn.product?.purchasePrice) || 0;
      const retail = parseFloat(sn.product?.sellingPrice) || 0;

      if (status === 'Available') {
        availableSerials += 1;
        currentInventoryCost += cost;
        currentInventoryRetail += retail;
      } else if (status === 'On Credit') {
        itemsOnCredit += 1;
        const credit = parseFloat(sn.creditAmount) || retail;
        totalCreditIssued += credit;
        totalCreditOutstanding += parseFloat(sn.remainingBalance) || 0;
        totalCostOfSold += cost;
      } else if (status === 'Sold') {
        itemsSold += 1;
        const cash = parseFloat(sn.paidAmount) || retail;
        totalCashSales += cash;
        totalCostOfSold += cost;
      } else if (status === 'Returned') {
        itemsReturned += 1;
        currentInventoryCost += cost;
      } else if (status === 'Damaged') {
        itemsDamaged += 1;
      }
    });

    // Bulk / Non-serialized inventory valuation
    const bulkProducts = await Product.findAll({
      where: { hasSerial: false },
      attributes: ['stockQuantity', 'purchasePrice', 'sellingPrice']
    });

    bulkProducts.forEach((bp) => {
      const qty = parseInt(bp.stockQuantity, 10) || 0;
      const cost = parseFloat(bp.purchasePrice) || 0;
      const retail = parseFloat(bp.sellingPrice) || 0;
      currentInventoryCost += cost * qty;
      currentInventoryRetail += retail * qty;
    });

    // 3. Customers count
    const totalCustomers = await Customer.count();

    // 4. Payments total collected
    const totalCollected = (await Payment.sum('amount')) || 0;
    const totalPaymentsCount = await Payment.count();

    // Financial performance calculations
    const totalGrossSales = totalCashSales + totalCreditIssued;
    const netProfit = totalGrossSales - totalCostOfSold;
    const profitMargin =
      totalGrossSales > 0 ? +((netProfit / totalGrossSales) * 100).toFixed(1) : 0;

    // 5. Recent 7 Days Timeline Trend
    const now = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      last7Days.push({
        date: dateStr,
        day: dayName,
        sales: 0,
        collected: 0
      });
    }

    // Populate timeline with payments
    const allRecentPayments = await Payment.findAll({
      attributes: ['amount', 'paymentDate']
    });

    allRecentPayments.forEach((p) => {
      if (p.paymentDate) {
        const pDate = new Date(p.paymentDate).toISOString().split('T')[0];
        const match = last7Days.find((day) => day.date === pDate);
        if (match) {
          match.collected += parseFloat(p.amount) || 0;
        }
      }
    });

    // Populate timeline with sold serials
    allSerials.forEach((sn) => {
      if (sn.soldDate && (sn.status === 'Sold' || sn.status === 'On Credit')) {
        const sDate = new Date(sn.soldDate).toISOString().split('T')[0];
        const match = last7Days.find((day) => day.date === sDate);
        if (match) {
          const val =
            sn.status === 'Sold'
              ? parseFloat(sn.paidAmount) || parseFloat(sn.product?.sellingPrice) || 0
              : parseFloat(sn.creditAmount) || parseFloat(sn.product?.sellingPrice) || 0;
          match.sales += val;
        }
      }
    });

    // 6. Category breakdown
    const categoryMap = {};
    allSerials.forEach((sn) => {
      const cat = sn.product?.category || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, totalCount: 0, availableCount: 0 };
      }
      categoryMap[cat].totalCount += 1;
      if (sn.status === 'Available') categoryMap[cat].availableCount += 1;
    });
    const categoryBreakdown = Object.values(categoryMap);

    // 7. Recent credit items with outstanding balance
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

    // 8. Recent payments
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
          totalPaymentsCount,

          // Enhanced Financial Telemetry
          totalCashSales: +totalCashSales.toFixed(2),
          totalGrossSales: +totalGrossSales.toFixed(2),
          totalCostOfSold: +totalCostOfSold.toFixed(2),
          netProfit: +netProfit.toFixed(2),
          profitMargin,
          currentInventoryCost: +currentInventoryCost.toFixed(2),
          currentInventoryRetail: +currentInventoryRetail.toFixed(2)
        },
        dailyTrend: last7Days,
        categoryBreakdown,
        recentCreditItems,
        recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
};
