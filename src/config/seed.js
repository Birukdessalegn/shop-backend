require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { sequelize, User, Product, Customer, SerialNumber, Payment } = require('../models');

const seedData = async () => {
  try {
    await sequelize.authenticate();
    console.log('[PostgreSQL Seed] Connected to PostgreSQL...');

    // Drop and recreate all tables
    await sequelize.sync({ force: true });
    console.log('[PostgreSQL Seed] Fresh database tables created...');

    // 1. Create Admin and Staff
    const admin = await User.create({
      name: 'Shop Admin',
      email: 'admin@shop.com',
      password: 'password123',
      role: 'admin'
    });

    const staff = await User.create({
      name: 'John Staff',
      email: 'staff@shop.com',
      password: 'password123',
      role: 'staff'
    });
    console.log('[PostgreSQL Seed] Users created (admin@shop.com / staff@shop.com, password: password123)...');

    // 2. Create Customers
    const customer1 = await Customer.create({
      name: 'Abebe Kebede',
      phone: '+251 911 223344',
      address: 'Bole Medhanealem, House 241',
      notes: 'Neighboring cafe owner, trustworthy credit buyer',
      createdById: admin.id
    });

    const customer2 = await Customer.create({
      name: 'Sara Tesfaye',
      phone: '+251 922 556677',
      address: 'Kazanchis, Near Total',
      notes: 'Freelance video editor',
      createdById: staff.id
    });

    const customer3 = await Customer.create({
      name: 'Dawit Alemu',
      phone: '+251 933 889900',
      address: 'Piazza, Churchill Ave',
      notes: 'Repeat customer for gaming gear',
      createdById: staff.id
    });
    console.log('[PostgreSQL Seed] Customers created...');

    // 3. Create Products
    const tv = await Product.create({
      name: 'Smart 4K UHD LED TV 55"',
      brand: 'Samsung',
      model: 'UN55CU7000',
      category: 'Televisions',
      purchasePrice: 420.0,
      sellingPrice: 599.99,
      hasSerial: true,
      stockQuantity: 4,
      description: '55-inch Crystal UHD 4K Smart TV with HDR and Gaming Hub',
      createdById: admin.id
    });

    const phone = await Product.create({
      name: 'Galaxy S24 Ultra 256GB',
      brand: 'Samsung',
      model: 'SM-S928B',
      category: 'Smartphones',
      purchasePrice: 950.0,
      sellingPrice: 1249.99,
      hasSerial: true,
      stockQuantity: 3,
      description: 'Titanium Gray, AI camera features, S-Pen included',
      createdById: admin.id
    });

    const laptop = await Product.create({
      name: 'MacBook Air 15" M3',
      brand: 'Apple',
      model: 'MRYN3LL/A',
      category: 'Laptops',
      purchasePrice: 1050.0,
      sellingPrice: 1399.0,
      hasSerial: true,
      stockQuantity: 3,
      description: 'Midnight, 16GB Unified Memory, 512GB SSD',
      createdById: admin.id
    });

    const cable = await Product.create({
      name: 'Braided HDMI 2.1 Cable 3m',
      brand: 'Anker',
      model: 'A8743',
      category: 'Accessories',
      purchasePrice: 8.5,
      sellingPrice: 19.99,
      hasSerial: false,
      stockQuantity: 50,
      description: 'Ultra High Speed 48Gbps 8K@60Hz / 4K@120Hz',
      createdById: staff.id
    });
    console.log('[PostgreSQL Seed] Products created...');

    // 4. Create Serial Numbers
    // TV serials
    await SerialNumber.create({
      serialNumber: 'SAM-TV-88201',
      productId: tv.id,
      status: 'Available',
      notes: 'Pristine condition in warehouse slot A1',
      createdById: admin.id
    });

    const snTv2 = await SerialNumber.create({
      serialNumber: 'SAM-TV-88202',
      productId: tv.id,
      status: 'On Credit',
      customerId: customer1.id,
      saleType: 'Credit',
      creditStatus: 'Partially Paid',
      creditAmount: 600.0,
      paidAmount: 200.0,
      remainingBalance: 400.0,
      notes: 'Agreed 3 installments. Next payment end of month.',
      soldDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      createdById: staff.id
    });

    await SerialNumber.create({
      serialNumber: 'SAM-TV-88203',
      productId: tv.id,
      status: 'Sold',
      customerId: customer3.id,
      saleType: 'Cash',
      creditAmount: 0.0,
      paidAmount: 599.99,
      remainingBalance: 0.0,
      soldDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdById: staff.id
    });

    await SerialNumber.create({
      serialNumber: 'SAM-TV-88204',
      productId: tv.id,
      status: 'Available',
      notes: 'New delivery batch B',
      createdById: admin.id
    });

    // Phone serials
    await SerialNumber.create({
      serialNumber: 'IMEI-S24U-990142',
      productId: phone.id,
      status: 'On Credit',
      customerId: customer2.id,
      saleType: 'Credit',
      creditStatus: 'Pending',
      creditAmount: 1250.0,
      paidAmount: 0.0,
      remainingBalance: 1250.0,
      notes: 'Full credit given on agreement. Due in 30 days.',
      soldDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdById: staff.id
    });

    await SerialNumber.create({
      serialNumber: 'IMEI-S24U-990143',
      productId: phone.id,
      status: 'Available',
      createdById: staff.id
    });

    await SerialNumber.create({
      serialNumber: 'IMEI-S24U-990144',
      productId: phone.id,
      status: 'Damaged',
      notes: 'Display cracked in transit, awaiting supplier warranty return',
      createdById: admin.id
    });

    // Laptop serials
    await SerialNumber.create({
      serialNumber: 'APP-MBA15-C02GF9',
      productId: laptop.id,
      status: 'Available',
      createdById: admin.id
    });

    await SerialNumber.create({
      serialNumber: 'APP-MBA15-C02GF8',
      productId: laptop.id,
      status: 'Available',
      createdById: admin.id
    });

    // 5. Create Payments
    await Payment.create({
      serialNumberId: snTv2.id,
      customerId: customer1.id,
      amount: 200.0,
      paymentMethod: 'Cash',
      notes: 'Initial down payment at credit purchase',
      recordedById: staff.id,
      paymentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    });

    console.log('[PostgreSQL Seed] Database seeded successfully!');
    console.log('--- Default Login Credentials ---');
    console.log('Admin: admin@shop.com / password123');
    console.log('Staff: staff@shop.com / password123');
    process.exit(0);
  } catch (error) {
    console.error('[PostgreSQL Seed] Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
