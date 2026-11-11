const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Payment = sequelize.define(
  'Payment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: { args: [0.01], msg: 'Payment amount must be greater than zero' }
      },
      get() {
        const val = this.getDataValue('amount');
        return val === null ? 0 : parseFloat(val);
      }
    },
    paymentMethod: {
      type: DataTypes.ENUM('Cash', 'Bank Transfer', 'Mobile Money', 'Other'),
      defaultValue: 'Cash'
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    paymentDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'payments',
    timestamps: true
  }
);

module.exports = Payment;
