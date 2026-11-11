const { Op } = require('sequelize');
const { Customer, SerialNumber, Payment, Product, User } = require('../models');

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
          model: SerialNumber,
          as: 'serialNumbers',
          attributes: ['id', 'status', 'creditAmount', 'paidAmount', 'remainingBalance']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enriched = customers.map((c) => {
      const cJson = c.toJSON();
      const serials = cJson.serialNumbers || [];

      let totalItemsBought = serials.length;
      let itemsOnCredit = 0;
      let totalCreditAmount = 0;
      let totalPaidAmount = 0;
      let totalOutstandingBalance = 0;

      serials.forEach((s) => {
        if (s.status === 'On Credit') {
          itemsOnCredit += 1;
          totalOutstandingBalance += parseFloat(s.remainingBalance) || 0;
        }
        totalCreditAmount += parseFloat(s.creditAmount) || 0;
        totalPaidAmount += parseFloat(s.paidAmount) || 0;
      });

      return {
        ...cJson,
        _id: cJson.id,
        stats: {
          totalItemsBought,
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

// @desc    Get single customer by ID with full ledger (credit items and payments)
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
          model: SerialNumber,
          as: 'serialNumbers',
          include: [{ model: Product, as: 'product' }]
        },
        {
          model: Payment,
          as: 'payments',
          include: [
            { model: SerialNumber, as: 'serialNumber', attributes: ['id', 'serialNumber'] },
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
    const serials = (cJson.serialNumbers || []).map((s) => ({
      ...s,
      _id: s.id,
      product: s.product ? { ...s.product, _id: s.product.id } : null
    }));

    const payments = (cJson.payments || []).map((p) => ({
      ...p,
      _id: p.id
    }));

    let totalOutstanding = 0;
    let totalCredit = 0;
    let totalPaid = 0;

    serials.forEach((s) => {
      if (s.status === 'On Credit') {
        totalOutstanding += parseFloat(s.remainingBalance) || 0;
      }
      totalCredit += parseFloat(s.creditAmount) || 0;
      totalPaid += parseFloat(s.paidAmount) || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        ...cJson,
        _id: cJson.id,
        summary: {
          totalPurchases: serials.length,
          activeCreditItems: serials.filter((s) => s.status === 'On Credit').length,
          totalOutstanding: +totalOutstanding.toFixed(2),
          totalCredit: +totalCredit.toFixed(2),
          totalPaid: +totalPaid.toFixed(2)
        },
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

    const cJson = customer.toJSON();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        ...cJson,
        _id: cJson.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a customer
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

    const cJson = customer.toJSON();

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        ...cJson,
        _id: cJson.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private/Admin
exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has serials with outstanding credit
    const activeCredit = await SerialNumber.count({
      where: {
        customerId: customer.id,
        status: 'On Credit',
        remainingBalance: { [Op.gt]: 0 }
      }
    });

    if (activeCredit > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer. This customer currently has ${activeCredit} item(s) on credit with outstanding debt.`
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
