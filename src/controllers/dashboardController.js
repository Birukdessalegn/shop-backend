const { Op } = require('sequelize');
const { Product, Sale, Customer, Payment, User } = require('../models');

// @desc    Get comprehensive simplified dashboard metrics & financial telemetry
// @route   GET /api/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    // 1. Total products & total pieces in stock
    const totalProducts = await Product.count();
    const allProducts = await Product.findAll({
      attributes: ['id', 'stockQuantity', 'purchasePrice', 'sellingPrice', 'category']
    });

    let totalStockPieces = 0;
    let currentInventoryCost = 0;
    let currentInventoryRetail = 0;
    const categoryStockMap = {};

    allProducts.forEach((p) => {
      const qty = parseInt(p.stockQuantity, 10) || 0;
      const cost = parseFloat(p.purchasePrice) || 0;
      const retail = parseFloat(p.sellingPrice) || 0;
      const cat = p.category || 'General';

      totalStockPieces += qty;
      currentInventoryCost += cost * qty;
      currentInventoryRetail += retail * qty;

      if (!categoryStockMap[cat]) {
        categoryStockMap[cat] = { category: cat, totalCount: 0, stockPieces: 0 };
      }
      categoryStockMap[cat].totalCount += 1;
      categoryStockMap[cat].stockPieces += qty;
    });

    // 2. Sales aggregates
    const allSales = await Sale.findAll({
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'category'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] }
      ]
    });

    let totalGrossSales = 0;
    let totalCashSales = 0;
    let totalCreditIssued = 0;
    let totalCreditOutstanding = 0;
    let totalCostOfSold = 0;
    let totalUnitsSold = 0;
    let activeCreditCount = 0;

    allSales.forEach((s) => {
      const amt = parseFloat(s.totalAmount) || 0;
      const cost = (parseFloat(s.purchasePrice) || 0) * (parseInt(s.quantity, 10) || 1);
      const qty = parseInt(s.quantity, 10) || 1;
      const rem = parseFloat(s.remainingBalance) || 0;

      totalGrossSales += amt;
      totalCostOfSold += cost;
      totalUnitsSold += qty;

      if (s.saleType === 'Credit') {
        totalCreditIssued += amt;
        if (rem > 0) {
          totalCreditOutstanding += rem;
          activeCreditCount += 1;
        }
      } else {
        totalCashSales += amt;
      }
    });

    // 3. Total customers
    const totalCustomers = await Customer.count();

    // 4. Actual cash collected in hand
    const totalCollected = (await Payment.sum('amount')) || 0;
    const totalPaymentsCount = await Payment.count();

    // 5. Net Profit
    const netProfit = totalGrossSales - totalCostOfSold;
    const profitMargin =
      totalGrossSales > 0 ? +((netProfit / totalGrossSales) * 100).toFixed(1) : 0;

    // 6. 7-Day Timeline Trend
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

    allSales.forEach((s) => {
      if (s.soldDate) {
        const sDate = new Date(s.soldDate).toISOString().split('T')[0];
        const match = last7Days.find((day) => day.date === sDate);
        if (match) {
          match.sales += parseFloat(s.totalAmount) || 0;
        }
      }
    });

    const allPayments = await Payment.findAll({
      attributes: ['amount', 'paymentDate']
    });

    allPayments.forEach((p) => {
      if (p.paymentDate) {
        const pDate = new Date(p.paymentDate).toISOString().split('T')[0];
        const match = last7Days.find((day) => day.date === pDate);
        if (match) {
          match.collected += parseFloat(p.amount) || 0;
        }
      }
    });

    // 7. Active credit sales (unsettled debt)
    const rawCreditSales = await Sale.findAll({
      where: {
        saleType: 'Credit',
        remainingBalance: { [Op.gt]: 0 }
      },
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'brand', 'model', 'sellingPrice'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }
      ],
      order: [['soldDate', 'DESC']],
      limit: 8
    });

    const recentCreditSales = rawCreditSales.map((s) => {
      const json = s.toJSON();
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
        { model: Sale, as: 'sale', include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] },
        { model: User, as: 'recordedBy', attributes: ['id', 'name'] }
      ],
      order: [['paymentDate', 'DESC']],
      limit: 8
    });

    const recentPayments = rawPayments.map((p) => {
      const json = p.toJSON();
      return {
        ...json,
        _id: json.id,
        customer: json.customer ? { ...json.customer, _id: json.customer.id } : null,
        sale: json.sale ? { ...json.sale, _id: json.sale.id } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalProducts,
          totalStockPieces,
          itemsOnCredit: activeCreditCount,
          totalCreditOutstanding: +totalCreditOutstanding.toFixed(2),
          totalCreditIssued: +totalCreditIssued.toFixed(2),
          totalCustomers,
          itemsSold: totalUnitsSold,
          totalCollected: +totalCollected.toFixed(2),
          totalPaymentsCount,

          // Financial aggregates
          totalCashSales: +totalCashSales.toFixed(2),
          totalGrossSales: +totalGrossSales.toFixed(2),
          totalCostOfSold: +totalCostOfSold.toFixed(2),
          netProfit: +netProfit.toFixed(2),
          profitMargin,
          currentInventoryCost: +currentInventoryCost.toFixed(2),
          currentInventoryRetail: +currentInventoryRetail.toFixed(2)
        },
        dailyTrend: last7Days,
        categoryBreakdown: Object.values(categoryStockMap),
        recentCreditItems: recentCreditSales,
        recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
};
