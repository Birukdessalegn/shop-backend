const { Op } = require('sequelize');
const { Customer, Sale, Payment, Product, User, SerialNumber } = require('../models');

// @desc    Get all customers with credit balances & stats
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const customers = await Customer.findAll({
      where,
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name']
        },
        {
          model: Sale,
          as: 'sales',
          attributes: ['id', 'quantity', 'totalAmount', 'paidAmount', 'remainingBalance', 'saleType', 'creditStatus']
        },
        {
          model: SerialNumber,
          as: 'serialNumbers',
          attributes: ['id', 'status', 'creditAmount', 'paidAmount', 'remainingBalance']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enriched = customers.map((c) => {
      const cJson = c.toJSON();
      const sales = cJson.sales || [];
      const serials = cJson.serialNumbers || [];

      let totalItemsBought = 0;
      let itemsOnCredit = 0;
      let totalCreditAmount = 0;
      let totalPaidAmount = 0;
      let totalOutstandingBalance = 0;

      // Calculate from Sales
      sales.forEach((s) => {
        totalItemsBought += parseInt(s.quantity, 10) || 1;
        if (s.saleType === 'Credit') {
          totalCreditAmount += parseFloat(s.totalAmount) || 0;
          totalPaidAmount += parseFloat(s.paidAmount) || 0;
          const rem = parseFloat(s.remainingBalance) || 0;
          if (rem > 0) {
            itemsOnCredit += 1;
            totalOutstandingBalance += rem;
          }
        }
      });

      // Also include any legacy serial numbers
      serials.forEach((sn) => {
        if (sn.status === 'On Credit') {
          itemsOnCredit += 1;
          totalOutstandingBalance += parseFloat(sn.remainingBalance) || 0;
        }
        totalCreditAmount += parseFloat(sn.creditAmount) || 0;
        totalPaidAmount += parseFloat(sn.paidAmount) || 0;
      });

      return {
        ...cJson,
        _id: cJson.id,
        stats: {
          totalItemsBought: totalItemsBought || serials.length,
          itemsOnCredit,
          totalCreditAmount: +totalCreditAmount.toFixed(2),
          totalPaidAmount: +totalPaidAmount.toFixed(2),
          totalOutstandingBalance: +totalOutstandingBalance.toFixed(2)
        }
      };
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer by ID with full ledger (credit sales and payments)
// @route   GET /api/customers/:id
// @access  Private
exports.getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name']
        },
        {
          model: Sale,
          as: 'sales',
          include: [{ model: Product, as: 'product' }]
        },
        {
          model: SerialNumber,
          as: 'serialNumbers',
          include: [{ model: Product, as: 'product' }]
        },
        {
          model: Payment,
          as: 'payments',
          include: [
            { model: User, as: 'recordedBy', attributes: ['id', 'name'] }
          ]
        }
      ]
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const cJson = customer.toJSON();
    const sales = (cJson.sales || []).map((s) => ({
      ...s,
      _id: s.id,
      product: s.product ? { ...s.product, _id: s.product.id } : null
    }));

    const serials = (cJson.serialNumbers || []).map((sn) => ({
      ...sn,
      _id: sn.id,
      product: sn.product ? { ...sn.product, _id: sn.product.id } : null
    }));

    const payments = (cJson.payments || []).map((p) => ({
      ...p,
      _id: p.id
    }));

    let totalOutstanding = 0;
    let totalCredit = 0;
    let totalPaid = 0;

    sales.forEach((s) => {
      if (s.saleType === 'Credit') {
        totalCredit += parseFloat(s.totalAmount) || 0;
        totalPaid += parseFloat(s.paidAmount) || 0;
        totalOutstanding += parseFloat(s.remainingBalance) || 0;
      }
    });

    serials.forEach((sn) => {
      if (sn.status === 'On Credit') {
        totalOutstanding += parseFloat(sn.remainingBalance) || 0;
      }
      totalCredit += parseFloat(sn.creditAmount) || 0;
      totalPaid += parseFloat(sn.paidAmount) || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        ...cJson,
        _id: cJson.id,
        summary: {
          totalPurchases: sales.length + serials.length,
          activeCreditItems: sales.filter((s) => s.saleType === 'Credit' && s.remainingBalance > 0).length,
          totalOutstanding: +totalOutstanding.toFixed(2),
          totalCredit: +totalCredit.toFixed(2),
          totalPaid: +totalPaid.toFixed(2)
        },
        sales,
        serials,
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res, next) => {
  try {
    const { name, phone, address, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone number are required'
      });
    }

    const customer = await Customer.create({
      name,
      phone,
      address: address || '',
      notes: notes || '',
      createdById: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: {
        ...customer.toJSON(),
        _id: customer.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer details
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const { name, phone, address, notes } = req.body;

    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (address !== undefined) customer.address = address;
    if (notes !== undefined) customer.notes = notes;

    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        ...customer.toJSON(),
        _id: customer.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin only)
exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has outstanding credit balance
    const activeSales = await Sale.count({
      where: {
        customerId: customer.id,
        saleType: 'Credit',
        remainingBalance: { [Op.gt]: 0 }
      }
    });

    if (activeSales > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer who currently has unsettled credit debt'
      });
    }

    await customer.destroy();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
