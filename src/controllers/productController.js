const { Op } = require('sequelize');
const { Product, SerialNumber, User, sequelize } = require('../models');

// @desc    Get all products with inventory stats
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const { category, search, hasSerial } = req.query;

    const where = {};
    if (category && category !== 'All') {
      where.category = category;
    }
    if (hasSerial !== undefined) {
      where.hasSerial = hasSerial === 'true';
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } },
        { model: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const products = await Product.findAll({
      where,
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email']
        },
        {
          model: SerialNumber,
          as: 'serials',
          attributes: ['id', 'status', 'remainingBalance', 'serialNumber']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const enrichedProducts = products.map((product) => {
      const prodJson = product.toJSON();
      const serials = prodJson.serials || [];

      const inventory = {
        totalSerials: serials.length,
        availableSerials: serials.filter((s) => s.status === 'Available').length,
        onCreditSerials: serials.filter((s) => s.status === 'On Credit').length,
        soldSerials: serials.filter((s) => s.status === 'Sold').length,
        damagedSerials: serials.filter((s) => s.status === 'Damaged').length,
        returnedSerials: serials.filter((s) => s.status === 'Returned').length
      };

      return {
        ...prodJson,
        _id: prodJson.id,
        inventory
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedProducts.length,
      data: enrichedProducts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'name', 'email']
        },
        {
          model: SerialNumber,
          as: 'serials'
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const prodJson = product.toJSON();
    const serials = prodJson.serials || [];

    const summary = {
      total: serials.length,
      available: serials.filter((s) => s.status === 'Available').length,
      onCredit: serials.filter((s) => s.status === 'On Credit').length,
      sold: serials.filter((s) => s.status === 'Sold').length,
      damaged: serials.filter((s) => s.status === 'Damaged').length,
      returned: serials.filter((s) => s.status === 'Returned').length
    };

    res.status(200).json({
      success: true,
      data: {
        ...prodJson,
        _id: prodJson.id,
        summary
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new product (with optional instant serial numbers registration)
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      name,
      brand,
      model,
      category,
      purchasePrice,
      sellingPrice,
      hasSerial,
      stockQuantity,
      description,
      serialNumber,
      serialNumbers
    } = req.body;

    // Parse serial numbers if provided
    let serialList = [];
    if (Array.isArray(serialNumbers)) {
      serialList = serialNumbers;
    } else if (typeof serialNumbers === 'string') {
      serialList = serialNumbers
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (serialNumber && typeof serialNumber === 'string') {
      serialList = serialNumber
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    const cleanedSerials = serialList.map((s) => s.trim().toUpperCase());
    const uniqueSerials = [...new Set(cleanedSerials)];

    // Check if any serial already exists
    if (uniqueSerials.length > 0) {
      const existing = await SerialNumber.findAll({
        where: { serialNumber: { [Op.in]: uniqueSerials } },
        attributes: ['serialNumber'],
        transaction
      });

      if (existing.length > 0) {
        await transaction.rollback();
        const existingNames = existing.map((e) => e.serialNumber).join(', ');
        return res.status(400).json({
          success: false,
          message: `The serial number(s) are already registered in your shop: ${existingNames}`
        });
      }
    }

    const calculatedStock = uniqueSerials.length > 0
      ? uniqueSerials.length
      : parseInt(stockQuantity, 10) || 0;

    const product = await Product.create(
      {
        name,
        brand: brand || '',
        model: model || '',
        category: category || 'General',
        purchasePrice: parseFloat(purchasePrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        hasSerial: hasSerial !== undefined ? hasSerial : (uniqueSerials.length > 0 ? true : true),
        stockQuantity: calculatedStock,
        description: description || '',
        createdById: req.user.id
      },
      { transaction }
    );

    let createdSerials = [];
    if (uniqueSerials.length > 0) {
      const serialDocs = uniqueSerials.map((sn) => ({
        serialNumber: sn,
        productId: product.id,
        status: 'Available',
        notes: `Registered with product: ${name}`,
        createdById: req.user.id
      }));

      createdSerials = await SerialNumber.bulkCreate(serialDocs, { transaction });
    }

    await transaction.commit();

    const prodJson = product.toJSON();

    res.status(201).json({
      success: true,
      message: uniqueSerials.length > 0
        ? `Product created and ${uniqueSerials.length} serial number(s) registered successfully`
        : 'Product created successfully',
      data: {
        ...prodJson,
        _id: prodJson.id,
        serials: createdSerials
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const fieldsToUpdate = [
      'name',
      'brand',
      'model',
      'category',
      'purchasePrice',
      'sellingPrice',
      'hasSerial',
      'stockQuantity',
      'description'
    ];

    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();

    const prodJson = product.toJSON();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        ...prodJson,
        _id: prodJson.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if there are active serials on credit or sold
    const activeSerials = await SerialNumber.count({
      where: {
        productId: product.id,
        status: { [Op.in]: ['On Credit', 'Sold'] }
      }
    });

    if (activeSerials > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product. There are ${activeSerials} serial numbers linked to active sales or credit.`
      });
    }

    // Clean up available or damaged serials
    await SerialNumber.destroy({ where: { productId: product.id } });
    await product.destroy();

    res.status(200).json({
      success: true,
      message: 'Product and associated inventory deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
