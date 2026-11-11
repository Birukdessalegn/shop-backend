const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Customer = sequelize.define(
  'Customer',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Customer name is required' }
      }
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Phone number is required' }
      }
    },
    address: {
      type: DataTypes.STRING(255),
      defaultValue: ''
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: ''
    }
  },
  {
    tableName: 'customers',
    timestamps: true
  }
);

module.exports = Customer;
