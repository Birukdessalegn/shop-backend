# Electronics Shop Management System

A full-stack, production-ready Electronics Shop Management System tailored for retail electronics, mobile, and computer stores with serial number (IMEI/Barcode) tracking and local credit/installment sales management.

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, PostgreSQL, Sequelize ORM, `pg` driver, JWT (JSON Web Tokens), Bcryptjs, Morgan, CORS
- **Frontend**: React 19, Vite, Tailwind CSS, React Router v7, Axios, Lucide React

---

## 📁 Project Structure

```
electronics-shop/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                 # MongoDB connection handler
│   │   │   └── seed.js               # Database seeder with mock data
│   │   ├── controllers/
│   │   │   ├── authController.js     # User registration, login, profile, user list
│   │   │   ├── productController.js  # Product catalog & stock aggregation
│   │   │   ├── serialController.js   # Serial number lifecycle, sales & payments
│   │   │   ├── customerController.js # Customer ledger & credit profiles
│   │   │   └── dashboardController.js# Real-time KPIs & telemetry
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verification & role authorization (Admin/Staff)
│   │   │   └── errorHandler.js       # Centralized error handler & 404 catcher
│   │   ├── models/
│   │   │   ├── User.js               # Admin & Staff accounts (bcrypt hashed)
│   │   │   ├── Product.js            # Products (pricing, categories, serial flag)
│   │   │   ├── SerialNumber.js       # Individual serial tracking & credit balance
│   │   │   ├── Customer.js           # Customer information & notes
│   │   │   └── Payment.js            # Ledger of down payments & partial installments
│   │   ├── routes/
│   │   │   ├── authRoutes.js         # /api/auth
│   │   │   ├── productRoutes.js      # /api/products
│   │   │   ├── serialRoutes.js       # /api/serials
│   │   │   ├── customerRoutes.js     # /api/customers
│   │   └── └── dashboardRoutes.js    # /api/dashboard
│   ├── .env                          # Environment variables
│   ├── .env.example
│   ├── package.json
│   └── src/server.js                 # Express server bootstrap
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.jsx            # Responsive sidebar, navigation & user status
    │   │   ├── ProtectedRoute.jsx    # Route guard redirecting to /login
    │   │   ├── StatusBadge.jsx       # Color-coded badges for serial & credit status
    │   │   ├── ProductModal.jsx      # Create & edit product modal
    │   │   ├── AddSerialsModal.jsx   # Bulk serial number registration modal
    │   │   ├── SellSerialModal.jsx   # Cash sale & Credit sale flow modal
    │   │   ├── RecordPaymentModal.jsx# Credit installment payment recording modal
    │   │   ├── CustomerModal.jsx     # Add/edit customer modal
    │   │   └── CustomerLedgerModal.jsx# Full customer ledger & past payments view
    │   ├── context/
    │   │   └── AuthContext.jsx       # Global authentication state & methods
    │   ├── pages/
    │   │   ├── Login.jsx             # Admin/Staff login with quick test credentials
    │   │   ├── Dashboard.jsx         # KPI metrics, active credit list & actions
    │   │   ├── Products.jsx          # Catalog management, pricing & stock counts
    │   │   ├── Serials.jsx           # Serial numbers inventory, credit flow & status
    │   │   └── Customers.jsx         # Customer list, outstanding balances & history
    │   ├── services/
    │   │   └── api.js                # Modular Axios API service with auth interceptors
    │   ├── App.jsx                   # Router and layout configuration
    │   ├── index.css                 # Tailwind CSS styles
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## ⚡ Core Features & Workflows

### 1. Authentication & Role-Based Access Control
- JWT-based authentication with Bearer tokens
- Supports **Admin** (full management, deletion rights, user management) and **Staff** (sales, inventory registration, payment recording) roles
- Passwords safely hashed using `bcryptjs` with salt rounds
- Demo accounts:
  - **Admin**: `admin@shop.com` / `password123`
  - **Staff**: `staff@shop.com` / `password123`

### 2. Product Management
- Fields: `name`, `brand`, `model`, `category`, `purchasePrice`, `sellingPrice`, `hasSerial` (boolean), `stockQuantity`, `description`
- Automatically calculates real-time inventory counts per product:
  - Total Serials registered
  - Available units in store
  - Units currently out on credit
  - Units sold

### 3. Serial Number Management (IMEI / Barcode)
- Bulk register multiple serial numbers at once (scanned via USB barcode scanner or pasted line-by-line)
- Each serial tracks:
  - `serialNumber` (unique string, uppercase)
  - `status`: `Available` | `On Credit` | `Sold` | `Returned` | `Damaged`
  - `customer` (Mongoose reference)
  - `saleType`: `Cash` | `Credit`
  - `creditStatus`: `Pending` | `Partially Paid` | `Fully Paid`
  - `creditAmount`: total agreed credit amount
  - `paidAmount`: total sum of down payment and installments
  - `remainingBalance`: calculated as `creditAmount - paidAmount`
  - `notes`: terms or condition remarks
  - `soldDate`: date item was sold or credited
  - `createdBy`: staff member who processed the registration

### 4. Credit Sale Flow & Installment Payments
- Sell any `Available` serial number on credit to an existing or new customer
- Specify agreed credit price (defaults to product selling price) and optional initial down payment
- Real-time balance preview and receipt generation
- Record installment payments:
  - Updates `paidAmount` and decreases `remainingBalance`
  - Automatically transitions `creditStatus` between `Pending` ➔ `Partially Paid` ➔ `Fully Paid`
  - Creates an audit `Payment` record with method (`Cash`, `Bank Transfer`, `Mobile Money`) and notes

### 5. Customer Ledger
- Dedicated customer profiles with contact numbers, addresses, and trust notes
- Real-time metrics per customer: total items bought, active items on credit, and outstanding debt
- One-click customer ledger modal reviewing item purchase history and all past payment logs

### 6. Interactive Shop Dashboard
- **Total Products**: Count of active catalog items
- **Available Serials**: In-stock units ready for immediate sale
- **Items on Credit**: Units currently held by customers with active credit
- **Outstanding Credit**: Total outstanding money owed to the shop
- Real-time table of active credit receivables with direct installment payment triggers

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database (local on port 5432 or cloud hosted e.g. Neon, Supabase, AWS RDS)

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# (Optional) Seed the database with sample products, serials, and test credit accounts
npm run seed

# Start development server
npm run dev
# Or for standard production start:
npm start
```
The backend API will run on `http://localhost:5000`.

### 2. Frontend Setup
```bash
# Navigate to frontend directory in another terminal
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
The React frontend will be accessible at `http://localhost:5173`.

---

## 📡 API Reference Overview

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/login` | Login and receive JWT token | Public |
| `POST` | `/api/auth/register` | Register new staff user | Admin |
| `POST` | `/api/auth/seed-admin` | Seed initial admin user if none exists | Public |
| `GET` | `/api/auth/me` | Get current logged-in user profile | Private |
| `GET` | `/api/products` | List products with inventory aggregations | Private |
| `POST` | `/api/products` | Create a new product | Private |
| `PUT` | `/api/products/:id` | Update product info | Private |
| `DELETE` | `/api/products/:id` | Delete product (if no active sales) | Private/Admin |
| `GET` | `/api/serials` | List serials (filterable by status, product, customer) | Private |
| `POST` | `/api/serials` | Bulk register serial numbers | Private |
| `POST` | `/api/serials/:id/sell` | Sell unit on Credit or Cash | Private |
| `POST` | `/api/serials/:id/payments` | Record installment payment towards credit | Private |
| `PUT` | `/api/serials/:id` | Update serial status (e.g. Damaged, Returned) | Private |
| `DELETE` | `/api/serials/:id` | Remove serial (if not on active credit) | Private/Admin |
| `GET` | `/api/customers` | List customers with credit statistics | Private |
| `POST` | `/api/customers` | Register a new customer | Private |
| `GET` | `/api/customers/:id` | View customer ledger, items & payment history | Private |
| `GET` | `/api/dashboard` | Dashboard metrics & credit receivables | Private |

