# OneClick – All in One Store

> "Everything You Need, One Click Away"

OneClick is a production-quality full-stack e-commerce application designed with a **Dark Premium UI**. It features a modern design aesthetic reminiscent of Apple Store, Amazon, and leading SaaS applications.

---

## 🚀 Key Features

* **Branding & Design**: Sleek glassmorphic forms, card shadow lifts, image zoom animations, Google Fonts (`Poppins` & `Inter`), HSL tailored dark colors, and dynamic micro-animations.
* **Authentication**: JWT-based token authorization, password hashing via `bcrypt`, and secure role checks.
* **Storefront Shopping**: Browse, dynamic searching, multi-filter panels (category, price range), ratings, and verified customer reviews moderation.
* **Cart & Wishlist**: Persistent database-level shopping cart with inventory stock control, and saved items wishlist.
* **Transactional Checkout**: Cash on Delivery (COD) and Online Payment simulator, including promo coupon validations and SQL transactions ensuring stock safety.
* **Order Timelines**: Linear progress tracking workflows showing shipment states: `Pending` ➔ `Confirmed` ➔ `Packed` ➔ `Shipped` ➔ `Out For Delivery` ➔ `Delivered`.
* **Admin Dashboard**: Revenue charts, sales statistics, full CRUD panels for inventory products/categories, users database audit logs, coupons creation, and reviews approvals.

---

## 📁 Project Structure

```text
intelligent-pascal/
├── database/
│   ├── schema.sql           # Database tables creation script
│   └── seed.js              # Node database seeder (mock items and admin)
├── backend/
│   ├── config/
│   │   └── db.js            # MySQL2 async pool connection setup
│   ├── middleware/
│   │   ├── auth.js          # JWT protectors and Admin role validators
│   │   └── validate.js      # Payloads validation constraints
│   ├── controllers/         # Express API controllers
│   ├── routes/              # Express Router API endpoints
│   ├── test-api.js          # API integration smoke test checker
│   ├── package.json         # NPM package dependencies
│   └── server.js            # Express server entry point
├── frontend/
│   ├── css/
│   │   └── style.css        # Premium Dark utility styling framework
│   ├── js/
│   │   ├── api.js           # REST fetch wrappers and Toast alerts
│   │   ├── components.js    # Shared Navbar/Footer layout injector
│   │   ├── shop.js          # Browsing listings and QuickView modals
│   │   ├── auth.js          # Signup / Login event controllers
│   │   ├── cart.js          # Cart items updates and checkout logic
│   │   └── admin.js         # Administration CRUD interfaces
│   ├── pages/               # Multi-page HTML layout files
│   └── index.html           # Storefront Home Page
└── README.md
```

---

## 🛠️ Step-by-Step Installation

Follow these steps to run the application locally on Windows:

### 1. Install Node.js & MySQL
* **Node.js**: Download and install [Node.js LTS Version](https://nodejs.org/). This will configure both `node` and `npm` in your system's PATH.
* **MySQL**: Download and run [MySQL Installer](https://dev.mysql.com/downloads/installer/) (community version), setting a password for the `root` user (e.g. leaving it blank or setting a custom one).

### 2. Configure Environment Variables
Inside the `backend/` directory, open the `.env` file and edit parameters matching your MySQL database credentials:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
DB_DATABASE=oneclick_db
JWT_SECRET=oneclick_jwt_secret_token_2026_premium_dark_ui
JWT_EXPIRE=24h
```

### 3. Install Dependencies
Open a terminal inside the `/backend` folder and run:
```bash
npm install
```

### 4. Create and Seed Database Tables
To automatically initialize the database schema and populate it with sample categories, products, coupons, and users, run:
```bash
npm run seed
```

This creates:
* **Admin Account**: `admin@oneclick.com` / Password: `admin123`
* **Regular Customer Account**: `user@oneclick.com` / Password: `user123`

### 5. Launch the Server
Start the local server by executing:
```bash
npm run dev
```
*(Uses nodemon to auto-restart on edits)*.

---

## 🌐 Navigating the App

Once running, navigate your web browser to:
👉 **[http://localhost:5000](http://localhost:5000)**

* The home page automatically loads.
* Click **Shop** to browse all items or search.
* Click **Login** to test the customer dashboard, add products to cart, apply the seed coupons (`WELCOME10`, `ONECLICK20`), and checkout.
* Log in as the Admin user (`admin@oneclick.com`) to access the system metrics dashboards, manage products list, edit orders, and approve reviews.

---

## 🧪 Testing API Endpoints

To check API response schemas and route protections automatically:
1. Ensure the Express server is active (`npm run dev`).
2. Run:
```bash
node test-api.js
```
This tests GET catalog lists, verifies authorization credentials, and checks path restrictions.
