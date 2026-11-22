const { sequelize } = require('../config/db');
const User = require('./User');
const Product = require('./Product');
const Customer = require('./Customer');
const SerialNumber = require('./SerialNumber');
const Payment = require('./Payment');
const Sale = require('./Sale');

// Product <-> Sale
Product.hasMany(Sale, { foreignKey: 'productId', as: 'sales', onDelete: 'CASCADE' });
Sale.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Customer <-> Sale
Customer.hasMany(Sale, { foreignKey: 'customerId', as: 'sales' });
Sale.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// Sale <-> Payment
Sale.hasMany(Payment, { foreignKey: 'saleId', as: 'payments', onDelete: 'CASCADE' });
Payment.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });

// Customer <-> Payment
Customer.hasMany(Payment, { foreignKey: 'customerId', as: 'payments' });
Payment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// Product <-> SerialNumber (preserved for backwards-compatibility)
Product.hasMany(SerialNumber, { foreignKey: 'productId', as: 'serials', onDelete: 'CASCADE' });
SerialNumber.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Customer.hasMany(SerialNumber, { foreignKey: 'customerId', as: 'serialNumbers' });
SerialNumber.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
SerialNumber.hasMany(Payment, { foreignKey: 'serialNumberId', as: 'payments', onDelete: 'CASCADE' });
Payment.belongsTo(SerialNumber, { foreignKey: 'serialNumberId', as: 'serialNumber' });

// User associations (Audit / CreatedBy)
User.hasMany(Product, { foreignKey: 'createdById' });
Product.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

User.hasMany(Sale, { foreignKey: 'soldById' });
Sale.belongsTo(User, { foreignKey: 'soldById', as: 'soldBy' });

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
  Payment,
  Sale
};

