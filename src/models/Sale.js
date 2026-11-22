const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Sale = sequelize.define(
  'Sale',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: { args: [1], msg: 'Quantity must be at least 1' }
      }
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue('unitPrice');
        return val === null ? 0 : parseFloat(val);
      }
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const val = this.getDataValue('purchasePrice');
        return val === null ? 0 : parseFloat(val);
      }
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue('totalAmount');
        return val === null ? 0 : parseFloat(val);
      }
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const val = this.getDataValue('paidAmount');
        return val === null ? 0 : parseFloat(val);
      }
    },
    remainingBalance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const val = this.getDataValue('remainingBalance');
        return val === null ? 0 : parseFloat(val);
      }
    },
    saleType: {
      type: DataTypes.ENUM('Cash', 'Credit'),
      defaultValue: 'Cash'
    },
    creditStatus: {
      type: DataTypes.ENUM('Pending', 'Partially Paid', 'Fully Paid'),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    soldDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'sales',
    timestamps: true
  }
);

module.exports = Sale;
