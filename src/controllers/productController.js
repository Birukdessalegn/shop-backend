const { Op } = require('sequelize');
const { Product, User, sequelize } = require('../models');

// @desc    Get all products with stock quantity
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const { category, search } = req.query;

    const where = {};
    if (category && category !== 'All') {
      where.category = category;
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
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formatted = products.map((product) => {
      const prodJson = product.toJSON();
      return {
        ...prodJson,
        _id: prodJson.id
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

    res.status(200).json({
      success: true,
      data: {
        ...prodJson,
        _id: prodJson.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new product with initial stock quantity
// @route   POST /api/products
// @access  Private (Admin, Stock, Staff)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      brand,
      model,
      category,
      purchasePrice,
      sellingPrice,
      stockQuantity = 1,
      description
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    const cost = parseFloat(purchasePrice);
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ success: false, message: 'Valid cost price is required' });
    }

    const sell = parseFloat(sellingPrice);
    if (isNaN(sell) || sell < 0) {
      return res.status(400).json({ success: false, message: 'Valid selling price is required' });
    }

    const qty = parseInt(stockQuantity, 10);
    const finalStock = isNaN(qty) || qty < 0 ? 0 : qty;

    const product = await Product.create({
      name: name.trim(),
      brand: brand ? brand.trim() : '',
      model: model ? model.trim() : '',
      category: category || 'General',
      purchasePrice: cost,
      sellingPrice: sell,
      stockQuantity: finalStock,
      hasSerial: false,
      description: description || '',
      createdById: req.user.id
    });

    res.status(201).json({
      success: true,
      message: `Product "${product.name}" created with ${product.stockQuantity} piece(s) in stock`,
      data: {
        ...product.toJSON(),
        _id: product.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product details or stock
// @route   PUT /api/products/:id
// @access  Private (Admin, Stock, Staff)
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      name,
      brand,
      model,
      category,
      purchasePrice,
      sellingPrice,
      stockQuantity,
      description
    } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (brand !== undefined) product.brand = brand.trim();
    if (model !== undefined) product.model = model.trim();
    if (category !== undefined) product.category = category;
    if (purchasePrice !== undefined) product.purchasePrice = parseFloat(purchasePrice) || 0;
    if (sellingPrice !== undefined) product.sellingPrice = parseFloat(sellingPrice) || 0;
    if (stockQuantity !== undefined) product.stockQuantity = Math.max(0, parseInt(stockQuantity, 10) || 0);
    if (description !== undefined) product.description = description;

    await product.save();

    res.status(200).json({
      success: true,
      message: `Product "${product.name}" updated successfully`,
      data: {
        ...product.toJSON(),
        _id: product.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add stock / restock pieces of an existing item
// @route   POST /api/products/:id/stock
// @access  Private (Admin, Stock, Staff)
exports.addStock = async (req, res, next) => {
  try {
    const { quantity = 1 } = req.body;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid quantity to add (at least 1)'
      });
    }

    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.stockQuantity = (product.stockQuantity || 0) + qty;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Added ${qty} piece(s) to "${product.name}". Total in stock: ${product.stockQuantity} Pcs`,
      data: {
        ...product.toJSON(),
        _id: product.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      message: `Product "${product.name}" removed successfully`
    });
  } catch (error) {
    next(error);
  }
};
