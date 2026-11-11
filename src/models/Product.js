const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Product name is required' }
      }
    },
    brand: {
      type: DataTypes.STRING(100),
      defaultValue: ''
    },
    model: {
      type: DataTypes.STRING(100),
      defaultValue: ''
    },
    category: {
      type: DataTypes.STRING(100),
      defaultValue: 'General'
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: { args: [0], msg: 'Purchase price cannot be negative' }
      },
      get() {
        const val = this.getDataValue('purchasePrice');
        return val === null ? 0 : parseFloat(val);
      }
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: { args: [0], msg: 'Selling price cannot be negative' }
      },
      get() {
        const val = this.getDataValue('sellingPrice');
        return val === null ? 0 : parseFloat(val);
      }
    },
    hasSerial: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Stock quantity cannot be negative' }
      }
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: ''
    }
  },
  {
    tableName: 'products',
    timestamps: true
  }
);

module.exports = Product;
