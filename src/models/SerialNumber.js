const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SerialNumber = sequelize.define(
  'SerialNumber',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: {
        msg: 'This serial number is already registered'
      },
      set(val) {
        this.setDataValue('serialNumber', val ? val.trim().toUpperCase() : val);
      }
    },
    status: {
      type: DataTypes.ENUM('Available', 'On Credit', 'Sold', 'Returned', 'Damaged'),
      defaultValue: 'Available'
    },
    saleType: {
      type: DataTypes.ENUM('Cash', 'Credit'),
      allowNull: true,
      defaultValue: null
    },
    creditStatus: {
      type: DataTypes.ENUM('Pending', 'Partially Paid', 'Fully Paid'),
      allowNull: true,
      defaultValue: null
    },
    creditAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue('creditAmount');
        return val === null ? 0 : parseFloat(val);
      }
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue('paidAmount');
        return val === null ? 0 : parseFloat(val);
      }
    },
    remainingBalance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue('remainingBalance');
        return val === null ? 0 : parseFloat(val);
      }
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    soldDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  },
  {
    tableName: 'serial_numbers',
    timestamps: true,
    hooks: {
      beforeSave: (instance) => {
        if (instance.saleType === 'Credit' || instance.status === 'On Credit') {
          const credit = parseFloat(instance.creditAmount) || 0;
          const paid = parseFloat(instance.paidAmount) || 0;
          const remaining = Math.max(0, parseFloat((credit - paid).toFixed(2)));
          instance.remainingBalance = remaining;

          if (credit > 0) {
            if (remaining === 0 && paid >= credit) {
              instance.creditStatus = 'Fully Paid';
            } else if (paid > 0 && paid < credit) {
              instance.creditStatus = 'Partially Paid';
            } else {
              instance.creditStatus = 'Pending';
            }
          }
        } else if (instance.saleType === 'Cash') {
          instance.creditAmount = 0.0;
          instance.remainingBalance = 0.0;
          instance.creditStatus = null;
        }
      }
    }
  }
);

module.exports = SerialNumber;
