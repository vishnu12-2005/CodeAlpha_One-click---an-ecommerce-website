const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

async function seed() {
  console.log('Connecting to MySQL database...');
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('Connected to MySQL host.');

    // 1. Run schema.sql to initialize database and tables
    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql queries...');
    await connection.query(schemaSql);
    console.log('Database schema created successfully.');

    // Switch to database
    await connection.query('USE `oneclick_db`;');

    // 2. Clear existing table data (in correct order of dependency)
    console.log('Clearing old table data...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('TRUNCATE TABLE `reviews`;');
    await connection.query('TRUNCATE TABLE `order_items`;');
    await connection.query('TRUNCATE TABLE `orders`;');
    await connection.query('TRUNCATE TABLE `cart`;');
    await connection.query('TRUNCATE TABLE `wishlist`;');
    await connection.query('TRUNCATE TABLE `products`;');
    await connection.query('TRUNCATE TABLE `categories`;');
    await connection.query('TRUNCATE TABLE `users`;');
    await connection.query('TRUNCATE TABLE `coupons`;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Old table data cleared.');

    // 3. Seed Users
    console.log('Seeding users...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const users = [
      ['Admin User', 'admin@oneclick.com', adminPassword, '1234567890', '123 Admin Lane, HQ', 'admin'],
      ['Jane Doe', 'user@oneclick.com', userPassword, '9876543210', '456 Client Boulevard, Apt 4B', 'customer'],
      ['Alex Smith', 'alex@oneclick.com', userPassword, '5551234567', '789 Elm Street', 'customer']
    ];

    await connection.query(
      'INSERT INTO `users` (name, email, password, phone, address, role) VALUES ?',
      [users]
    );
    console.log('Users seeded.');

    // 4. Seed Categories
    console.log('Seeding categories...');
    const categories = [
      ['Electronics', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&auto=format&fit=crop&q=60'],
      ['Fashion', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop&q=60'],
      ['Books', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&auto=format&fit=crop&q=60'],
      ['Home & Kitchen', 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=60'],
      ['Groceries', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60'],
      ['Beauty', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop&q=60'],
      ['Sports', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=500&auto=format&fit=crop&q=60'],
      ['Toys', 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=500&auto=format&fit=crop&q=60'],
      ['Mobile Accessories', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=500&auto=format&fit=crop&q=60']
    ];

    for (let cat of categories) {
      await connection.query('INSERT INTO `categories` (name, image) VALUES (?, ?)', cat);
    }
    console.log('Categories seeded.');

    // Fetch inserted category IDs to map products
    const [insertedCats] = await connection.query('SELECT id, name FROM `categories`');
    const catMap = {};
    insertedCats.forEach(row => {
      catMap[row.name] = row.id;
    });

    // 5. Seed Products
    console.log('Seeding products...');
    const products = [
      // Electronics
      [
        catMap['Electronics'],
        'Premium Wireless Headphones',
        'Noise-cancelling over-ear wireless headphones with deep bass and 40-hour battery life.',
        15999.00,
        15.00,
        50,
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
        4.5
      ],
      [
        catMap['Electronics'],
        'Smartwatch Series 8 Pro',
        'Waterproof fitness tracker with heart rate monitor, sleep tracking, and built-in GPS.',
        19999.00,
        10.00,
        30,
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
        4.2
      ],
      [
        catMap['Electronics'],
        '4K Ultra HD Projector',
        'Mini portable home theater projector with 8000 lumens, keystone correction, and HDMI support.',
        9999.00,
        0.00,
        15,
        'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=500&auto=format&fit=crop&q=60',
        4.0
      ],

      // Fashion
      [
        catMap['Fashion'],
        'Classic Leather Jacket',
        'Mens premium quality genuine leather motorcycle jacket in sleek black.',
        6999.00,
        20.00,
        25,
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop&q=60',
        4.7
      ],
      [
        catMap['Fashion'],
        'Minimalist Quartz Watch',
        'Elegant watch featuring a leather strap, clean dial, and water resistance up to 30m.',
        3999.00,
        5.00,
        40,
        'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500&auto=format&fit=crop&q=60',
        4.4
      ],

      // Books
      [
        catMap['Books'],
        'Atomic Habits',
        'An easy and proven way to build good habits and break bad ones by James Clear.',
        399.00,
        10.00,
        100,
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&auto=format&fit=crop&q=60',
        4.9
      ],

      // Home & Kitchen
      [
        catMap['Home & Kitchen'],
        'Programmable Drip Coffee Maker',
        '12-cup glass carafe coffee maker with automatic shutoff and brew strength selector.',
        2999.00,
        0.00,
        20,
        'https://images.unsplash.com/photo-1518057111178-44a106bad636?w=500&auto=format&fit=crop&q=60',
        4.1
      ],
      [
        catMap['Home & Kitchen'],
        'Digital Air Fryer 5.8QT',
        'XL air fryer oven with 8 presets, digital touchscreen, and non-stick basket.',
        5999.00,
        12.00,
        18,
        'https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=500&auto=format&fit=crop&q=60',
        4.6
      ],

      // Groceries
      [
        catMap['Groceries'],
        'Organic Matcha Green Tea Powder',
        '100% USDA organic culinary grade green tea powder, rich in antioxidants.',
        999.00,
        0.00,
        60,
        'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop&q=60',
        4.8
      ],

      // Beauty
      [
        catMap['Beauty'],
        'Hydrating Serum (Hyaluronic Acid)',
        'Moisturizing face serum designed to replenish skin hydration and reduce fine lines.',
        1299.00,
        15.00,
        75,
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=60',
        4.5
      ],

      // Sports
      [
        catMap['Sports'],
        'Ergonomic Yoga Mat',
        'Non-slip, extra thick fitness mat for home exercises, yoga, and pilates.',
        1499.00,
        10.00,
        45,
        'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500&auto=format&fit=crop&q=60',
        4.3
      ],

      // Toys
      [
        catMap['Toys'],
        'STEM Robotics Construction Kit',
        'Educational build-your-own robot set with programmable movements for kids.',
        4499.00,
        5.00,
        12,
        'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=500&auto=format&fit=crop&q=60',
        4.5
      ],

      // Mobile Accessories
      [
        catMap['Mobile Accessories'],
        'Magnetic Wireless Charger (15W)',
        'Fast charger stand compatible with latest MagSafe iPhones and devices.',
        2499.00,
        10.00,
        80,
        'https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=500&auto=format&fit=crop&q=60',
        4.4
      ]
    ];

    for (let p of products) {
      await connection.query(
        'INSERT INTO `products` (category_id, name, description, price, discount, stock, image, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        p
      );
    }
    console.log('Products seeded.');

    // 6. Seed Coupons
    console.log('Seeding coupons...');
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const formattedExpiry = nextMonth.toISOString().slice(0, 10);

    const coupons = [
      ['WELCOME10', 10.00, formattedExpiry],
      ['ONECLICK20', 20.00, formattedExpiry],
      ['SUPER30', 30.00, formattedExpiry]
    ];

    await connection.query(
      'INSERT INTO `coupons` (code, discount, expiry_date) VALUES ?',
      [coupons]
    );
    console.log('Coupons seeded.');

    // 7. Seed Reviews & Orders for rich initial look
    console.log('Seeding sample reviews and orders...');
    
    // Fetch some user & product IDs
    const [[customerUser]] = await connection.query("SELECT id FROM `users` WHERE role = 'customer' LIMIT 1");
    const [allProducts] = await connection.query("SELECT id FROM `products` LIMIT 3");

    if (customerUser && allProducts.length > 0) {
      // Create a mock order
      const orderAmount = 15999.00 - (15999.00 * 0.15); // Premium Wireless Headphones with welcome discount
      const [orderResult] = await connection.query(
        'INSERT INTO `orders` (user_id, total_amount, payment_method, payment_status, order_status, shipping_address, coupon_code, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [customerUser.id, orderAmount, 'Online', 'Completed', 'Delivered', '456 Client Boulevard, Apt 4B', 'WELCOME10', 30.00]
      );
      
      const orderId = orderResult.insertId;
      await connection.query(
        'INSERT INTO `order_items` (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, allProducts[0].id, 1, 15999.00]
      );

      // Create reviews
      await connection.query(
        'INSERT INTO `reviews` (user_id, product_id, rating, comment, status) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
        [
          customerUser.id, allProducts[0].id, 5, 'Absolutely love these! The noise cancellation is perfect for focus.', 'Approved',
          customerUser.id, allProducts[1].id, 4, 'Very good smartwatch. Health tracking features work flawlessly.', 'Approved'
        ]
      );
      console.log('Reviews and orders seeded.');
    }

    console.log('Database seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seed();
