const { sequelize } = require('../config/db');
const User = require('./User');
const Product = require('./Product');
const Customer = require('./Customer');
const SerialNumber = require('./SerialNumber');
const Payment = require('./Payment');

// Product <-> SerialNumber
Product.hasMany(SerialNumber, { foreignKey: 'productId', as: 'serials', onDelete: 'CASCADE' });
SerialNumber.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Customer <-> SerialNumber
Customer.hasMany(SerialNumber, { foreignKey: 'customerId', as: 'serialNumbers' });
SerialNumber.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// SerialNumber <-> Payment
SerialNumber.hasMany(Payment, { foreignKey: 'serialNumberId', as: 'payments', onDelete: 'CASCADE' });
Payment.belongsTo(SerialNumber, { foreignKey: 'serialNumberId', as: 'serialNumber' });

// Customer <-> Payment
Customer.hasMany(Payment, { foreignKey: 'customerId', as: 'payments' });
Payment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// User associations (Audit / CreatedBy)
User.hasMany(Product, { foreignKey: 'createdById' });
Product.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

User.hasMany(SerialNumber, { foreignKey: 'createdById' });
SerialNumber.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

User.hasMany(Customer, { foreignKey: 'createdById' });
Customer.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

User.hasMany(Payment, { foreignKey: 'recordedById' });
Payment.belongsTo(User, { foreignKey: 'recordedById', as: 'recordedBy' });

module.exports = {
  sequelize,
  User,
  Product,
  Customer,
  SerialNumber,
  Payment
};

