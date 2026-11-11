require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB, sequelize } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Import models to register associations
require('./models');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const serialRoutes = require('./routes/serialRoutes');
const customerRoutes = require('./routes/customerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Root endpoint for cPanel health check
app.get('/', (req, res) => {
  res.status(200).send('Electronics Shop Management API is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString(),
    service: 'Electronics Shop Management System API'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/serials', serialRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize Database & Start Server
const startServer = async () => {
  await connectDB();
  try {
    await sequelize.sync({ alter: true });
    console.log('[PostgreSQL] Database synchronized (tables created/verified).');
  } catch (syncErr) {
    console.warn('[PostgreSQL] Database sync warning:', syncErr.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Electronics Shop API Server running on port ${PORT}`);
    console.log(` Database: PostgreSQL`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Base URL: http://localhost:${PORT}`);
    console.log(`===============================================`);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection Error: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();

module.exports = app;
