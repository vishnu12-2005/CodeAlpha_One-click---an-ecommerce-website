const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JSON_DB_PATH = path.join(__dirname, '../../database/fallback_db.json');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'oneclick_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

let useFallback = false;

// Test MySQL Connection and trigger fallback if it fails
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`==================================================`);
    console.log(`✔ MySQL connected: oneclick_db at ${process.env.DB_HOST || 'localhost'}`);
    console.log(`==================================================`);
    connection.release();
  } catch (err) {
    useFallback = true;
    console.warn(`==================================================`);
    console.warn(`⚠️  MySQL Connection Failed: ${err.message}`);
    console.warn(`👉 Automatically falling back to local JSON database:`);
    console.warn(`   ${JSON_DB_PATH}`);
    console.warn(`==================================================`);
  }
})();

// --- JSON Emulator Utility Functions ---
function getJsonData() {
  try {
    const data = fs.readFileSync(JSON_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read local fallback DB file:', err.message);
    return { users: [], categories: [], products: [], cart: [], wishlist: [], orders: [], order_items: [], reviews: [], coupons: [] };
  }
}

function saveJsonData(data) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local fallback DB file:', err.message);
  }
}

// Intercept queries and route to JSON database emulation
// Type-safe comparison helpers to handle int vs string mismatches from JSON body parsing
const toInt = (v) => parseInt(v, 10);
const sameId = (a, b) => toInt(a) === toInt(b);

async function executeJsonQuery(sql, params = []) {
  const data = getJsonData();
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();

  // 1. Users Queries
  if (/SELECT id FROM users WHERE email = \?/i.test(normalizedSql)) {
    const email = params[0];
    const match = data.users.filter(u => u.email === email);
    return [match.map(u => ({ id: u.id }))];
  }

  if (/INSERT INTO users/i.test(normalizedSql)) {
    const [name, email, password, phone, address, role] = params;
    const newId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
    const newUser = { id: newId, name, email, password, phone, address, role, created_at: new Date().toISOString() };
    data.users.push(newUser);
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/SELECT \* FROM users WHERE email = \?/i.test(normalizedSql)) {
    const email = params[0];
    const match = data.users.filter(u => u.email === email);
    return [match];
  }

  if (/SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    const match = data.users.filter(u => u.id === id);
    return [match];
  }

  if (/UPDATE users SET name = \?, phone = \?, address = \? WHERE id = \?/i.test(normalizedSql)) {
    const [name, phone, address, id] = params;
    data.users = data.users.map(u => u.id === id ? { ...u, name, phone, address } : u);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/UPDATE users SET password = \? WHERE id = \?/i.test(normalizedSql)) {
    const [password, id] = params;
    data.users = data.users.map(u => u.id === id ? { ...u, password } : u);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  // 2. Categories Queries
  if (/SELECT \* FROM categories ORDER BY name/i.test(normalizedSql)) {
    return [data.categories];
  }

  if (/SELECT \* FROM categories WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    const match = data.categories.filter(c => c.id === id);
    return [match];
  }

  if (/INSERT INTO categories/i.test(normalizedSql)) {
    const [name, image] = params;
    const newId = data.categories.length > 0 ? Math.max(...data.categories.map(c => c.id)) + 1 : 1;
    data.categories.push({ id: newId, name, image });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/UPDATE categories SET name = \?, image = \? WHERE id = \?/i.test(normalizedSql)) {
    const [name, image, id] = params;
    data.categories = data.categories.map(c => c.id === id ? { ...c, name, image } : c);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/DELETE FROM categories WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    data.categories = data.categories.filter(c => c.id !== id);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  // 3. Products Queries
  if (/SELECT COUNT\(\*\) as total FROM products/i.test(normalizedSql) || /SELECT p\.\*, c\.name as category_name FROM products/i.test(normalizedSql)) {
    // Collect filtered product list
    let filtered = [...data.products];

    // Category check (params mapping changes depending on arguments length)
    // Basic filter emulations
    const catIndex = normalizedSql.indexOf('category_id = ?');
    const catNameIndex = normalizedSql.indexOf('c.name = ?');
    const searchIndex = normalizedSql.indexOf('p.name LIKE ?');
    const minPriceIndex = normalizedSql.indexOf('(p.price * (1 - p.discount/100)) >= ?');
    const maxPriceIndex = normalizedSql.indexOf('(p.price * (1 - p.discount/100)) <= ?');

    let paramIdx = 0;

    if (catIndex !== -1 || catNameIndex !== -1) {
      const catVal = params[paramIdx++];
      if (typeof catVal === 'number') {
        filtered = filtered.filter(p => p.category_id === catVal);
      } else {
        filtered = filtered.filter(p => p.category_name === catVal);
      }
    }

    if (searchIndex !== -1) {
      const searchVal = params[paramIdx++].replace(/%/g, '').toLowerCase();
      paramIdx++; // skip duplicate search wildcard mapping in query
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal) || p.description.toLowerCase().includes(searchVal));
    }

    if (minPriceIndex !== -1) {
      const minVal = params[paramIdx++];
      filtered = filtered.filter(p => (p.price * (1 - p.discount/100)) >= minVal);
    }

    if (maxPriceIndex !== -1) {
      const maxVal = params[paramIdx++];
      filtered = filtered.filter(p => (p.price * (1 - p.discount/100)) <= maxVal);
    }

    // If count query requested
    if (normalizedSql.includes('COUNT(*)')) {
      return [[{ total: filtered.length }]];
    }

    // Sort order
    if (normalizedSql.includes('price_asc')) {
      filtered.sort((a, b) => (a.price * (1 - a.discount/100)) - (b.price * (1 - b.discount/100)));
    } else if (normalizedSql.includes('price_desc')) {
      filtered.sort((a, b) => (b.price * (1 - b.discount/100)) - (a.price * (1 - a.discount/100)));
    } else if (normalizedSql.includes('rating DESC')) {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (normalizedSql.includes('created_at DESC')) {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // Pagination slice
    if (normalizedSql.includes('LIMIT ? OFFSET ?')) {
      const limitVal = params[params.length - 2];
      const offsetVal = params[params.length - 1];
      filtered = filtered.slice(offsetVal, offsetVal + limitVal);
    }

    return [filtered];
  }

  if (/SELECT p\.\*, c\.name as category_name FROM products p LEFT JOIN categories c ON p\.category_id = c\.id WHERE p\.id = \?/i.test(normalizedSql)) {
    const id = toInt(params[0]);
    const match = data.products.filter(p => sameId(p.id, id));
    return [match];
  }

  if (/SELECT (category_id|stock, name|id) FROM products WHERE id = \?/i.test(normalizedSql)) {
    const id = toInt(params[0]);
    const match = data.products.filter(p => sameId(p.id, id));
    return [match.map(p => ({
      id: p.id,
      category_id: p.category_id,
      stock: p.stock,
      name: p.name
    }))];
  }

  if (/SELECT p\.\*, c\.name as category_name FROM products p LEFT JOIN categories c ON p\.category_id = c\.id WHERE p\.category_id = \? AND p\.id != \? LIMIT 4/i.test(normalizedSql)) {
    const [catId, prodId] = params;
    const match = data.products.filter(p => sameId(p.category_id, catId) && !sameId(p.id, prodId)).slice(0, 4);
    return [match];
  }

  if (/INSERT INTO products/i.test(normalizedSql)) {
    const [category_id, name, description, price, discount, stock, image] = params;
    const newId = data.products.length > 0 ? Math.max(...data.products.map(p => p.id)) + 1 : 1;
    const cat = data.categories.find(c => c.id === category_id);
    data.products.push({
      id: newId,
      category_id,
      category_name: cat ? cat.name : 'General',
      name,
      description,
      price,
      discount,
      stock,
      image,
      rating: 0.00,
      created_at: new Date().toISOString()
    });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/UPDATE products SET category_id = \?, name = \?, description = \?, price = \?, discount = \?, stock = \?, image = \? WHERE id = \?/i.test(normalizedSql)) {
    const [category_id, name, description, price, discount, stock, image, id] = params;
    const cat = data.categories.find(c => c.id === category_id);
    data.products = data.products.map(p => p.id === id ? {
      ...p,
      category_id,
      category_name: cat ? cat.name : 'General',
      name,
      description,
      price,
      discount,
      stock,
      image
    } : p);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/DELETE FROM products WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    data.products = data.products.filter(p => p.id !== id);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  // 4. Cart Queries
  if (/SELECT c\.id as cart_id, c\.product_id, c\.quantity, p\.name, p\.price, p\.discount, p\.stock, p\.image FROM cart/i.test(normalizedSql)) {
    const userId = toInt(params[0]);
    const match = data.cart.filter(c => sameId(c.user_id, userId)).map(c => {
      const p = data.products.find(prod => sameId(prod.id, c.product_id)) || {};
      return {
        cart_id: c.id,
        product_id: c.product_id,
        quantity: c.quantity,
        name: p.name || 'Unknown',
        price: p.price || 0,
        discount: p.discount || 0,
        stock: p.stock || 0,
        image: p.image || ''
      };
    });
    return [match];
  }

  if (/SELECT id, quantity FROM cart WHERE user_id = \? AND product_id = \?/i.test(normalizedSql)) {
    const [userId, prodId] = params;
    const match = data.cart.filter(c => sameId(c.user_id, userId) && sameId(c.product_id, prodId));
    return [match];
  }

  if (/UPDATE cart SET quantity = \? WHERE id = \?/i.test(normalizedSql)) {
    const [qty, id] = params;
    data.cart = data.cart.map(c => sameId(c.id, id) ? { ...c, quantity: toInt(qty) } : c);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/UPDATE cart SET quantity = \? WHERE user_id = \? AND product_id = \?/i.test(normalizedSql)) {
    const [qty, userId, prodId] = params;
    data.cart = data.cart.map(c => sameId(c.user_id, userId) && sameId(c.product_id, prodId) ? { ...c, quantity: toInt(qty) } : c);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/INSERT INTO cart/i.test(normalizedSql)) {
    const [userId, prodId, qty] = params;
    const newId = data.cart.length > 0 ? Math.max(...data.cart.map(c => c.id)) + 1 : 1;
    data.cart.push({ id: newId, user_id: toInt(userId), product_id: toInt(prodId), quantity: toInt(qty) });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/DELETE FROM cart WHERE user_id = \? AND product_id = \?/i.test(normalizedSql)) {
    const [userId, prodId] = params;
    const before = data.cart.length;
    data.cart = data.cart.filter(c => !(sameId(c.user_id, userId) && sameId(c.product_id, prodId)));
    saveJsonData(data);
    return [{ affectedRows: before - data.cart.length }];
  }

  if (/DELETE FROM cart WHERE user_id = \?/i.test(normalizedSql)) {
    const userId = params[0];
    data.cart = data.cart.filter(c => !sameId(c.user_id, userId));
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  // 5. Wishlist Queries
  if (/SELECT w\.id as wishlist_id, w\.product_id, p\.name, p\.price, p\.discount, p\.stock, p\.image, p\.rating FROM wishlist/i.test(normalizedSql)) {
    const userId = toInt(params[0]);
    const match = data.wishlist.filter(w => sameId(w.user_id, userId)).map(w => {
      const p = data.products.find(prod => sameId(prod.id, w.product_id)) || {};
      return {
        wishlist_id: w.id,
        product_id: w.product_id,
        name: p.name || 'Unknown',
        price: p.price || 0,
        discount: p.discount || 0,
        stock: p.stock || 0,
        image: p.image || '',
        rating: p.rating || 0
      };
    });
    return [match];
  }

  if (/INSERT IGNORE INTO wishlist/i.test(normalizedSql)) {
    const [userId, prodId] = params;
    const exists = data.wishlist.some(w => sameId(w.user_id, userId) && sameId(w.product_id, prodId));
    if (!exists) {
      const newId = data.wishlist.length > 0 ? Math.max(...data.wishlist.map(w => w.id)) + 1 : 1;
      data.wishlist.push({ id: newId, user_id: toInt(userId), product_id: toInt(prodId) });
      saveJsonData(data);
    }
    return [{ affectedRows: 1 }];
  }

  if (/DELETE FROM wishlist WHERE user_id = \? AND product_id = \?/i.test(normalizedSql)) {
    const [userId, prodId] = params;
    const before = data.wishlist.length;
    data.wishlist = data.wishlist.filter(w => !(sameId(w.user_id, userId) && sameId(w.product_id, prodId)));
    saveJsonData(data);
    return [{ affectedRows: before - data.wishlist.length }];
  }

  // 6. Coupons Queries
  if (/SELECT id, code, discount, expiry_date FROM coupons WHERE code = \?/i.test(normalizedSql)) {
    const code = params[0];
    const match = data.coupons.filter(c => c.code === code);
    return [match];
  }

  if (/SELECT \* FROM coupons ORDER BY expiry_date/i.test(normalizedSql)) {
    return [data.coupons];
  }

  if (/INSERT INTO coupons/i.test(normalizedSql)) {
    const [code, discount, expiry_date] = params;
    const newId = data.coupons.length > 0 ? Math.max(...data.coupons.map(c => c.id)) + 1 : 1;
    data.coupons.push({ id: newId, code: code.toUpperCase(), discount, expiry_date });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/DELETE FROM coupons WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    data.coupons = data.coupons.filter(c => c.id !== id);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  // 7. Orders Queries
  if (/INSERT INTO orders/i.test(normalizedSql)) {
    const [userId, totalAmount, payment_method, paymentStatus, orderStatus, shipping_address, coupon_code, discountAmount] = params;
    const newId = data.orders.length > 0 ? Math.max(...data.orders.map(o => o.id)) + 1 : 1;
    
    data.orders.push({
      id: newId,
      user_id: userId,
      total_amount: totalAmount,
      payment_method,
      payment_status: paymentStatus,
      order_status: orderStatus,
      shipping_address,
      coupon_code,
      discount_amount: discountAmount,
      created_at: new Date().toISOString()
    });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/INSERT INTO order_items/i.test(normalizedSql)) {
    const [orderId, prodId, quantity, price] = params;
    const newId = data.order_items.length > 0 ? Math.max(...data.order_items.map(oi => oi.id)) + 1 : 1;
    data.order_items.push({ id: newId, order_id: orderId, product_id: prodId, quantity, price });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/UPDATE products SET stock = stock - \? WHERE id = \?/i.test(normalizedSql)) {
    const [qty, id] = params;
    data.products = data.products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock - qty) } : p);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/UPDATE products SET stock = stock \+ \? WHERE id = \?/i.test(normalizedSql)) {
    const [qty, id] = params;
    data.products = data.products.map(p => p.id === id ? { ...p, stock: p.stock + qty } : p);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/SELECT \* FROM orders WHERE user_id = \?/i.test(normalizedSql)) {
    const userId = params[0];
    const match = data.orders.filter(o => o.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return [match];
  }

  if (/SELECT \* FROM orders WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    const match = data.orders.filter(o => o.id === id);
    return [match];
  }

  if (/SELECT oi\.id as item_id, oi\.quantity, oi\.price, p\.name, p\.image, p\.id as product_id FROM order_items/i.test(normalizedSql)) {
    const orderId = params[0];
    const match = data.order_items.filter(oi => oi.order_id === orderId).map(oi => {
      const p = data.products.find(prod => prod.id === oi.product_id) || {};
      return {
        item_id: oi.id,
        quantity: oi.quantity,
        price: oi.price,
        name: p.name || 'Unknown',
        image: p.image || '',
        product_id: oi.product_id
      };
    });
    return [match];
  }

  if (/UPDATE orders SET order_status = 'Cancelled', payment_status = 'Failed' WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    data.orders = data.orders.map(o => o.id === id ? { ...o, order_status: 'Cancelled', payment_status: 'Failed' } : o);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/SELECT product_id, quantity FROM order_items WHERE order_id = \?/i.test(normalizedSql)) {
    const orderId = params[0];
    return [data.order_items.filter(oi => oi.order_id === orderId)];
  }

  // 8. Reviews Queries
  if (/SELECT oi\.id FROM order_items oi JOIN orders o ON oi\.order_id = o\.id WHERE o\.user_id = \? AND oi\.product_id = \? AND o\.order_status = 'Delivered'/i.test(normalizedSql)) {
    const [userId, prodId] = params;
    const deliveredOrders = data.orders.filter(o => o.user_id === userId && o.order_status === 'Delivered').map(o => o.id);
    const match = data.order_items.filter(oi => deliveredOrders.includes(oi.order_id) && oi.product_id === prodId);
    return [match];
  }

  if (/SELECT id FROM reviews WHERE user_id = \? AND product_id = \?/i.test(normalizedSql)) {
    const [userId, prodId] = params;
    const match = data.reviews.filter(r => r.user_id === userId && r.product_id === prodId);
    return [match];
  }

  if (/INSERT INTO reviews/i.test(normalizedSql)) {
    const [userId, prodId, rating, comment, status] = params;
    const newId = data.reviews.length > 0 ? Math.max(...data.reviews.map(r => r.id)) + 1 : 1;
    const u = data.users.find(usr => usr.id === userId);
    data.reviews.push({
      id: newId,
      user_id: userId,
      user_name: u ? u.name : 'Customer',
      product_id: prodId,
      rating,
      comment,
      status,
      created_at: new Date().toISOString()
    });
    saveJsonData(data);
    return [{ insertId: newId }];
  }

  if (/SELECT r\.id, r\.rating, r\.comment, r\.created_at, u\.name as user_name FROM reviews r JOIN users u/i.test(normalizedSql)) {
    // Reviews details logic
    const prodId = params[0];
    const match = data.reviews.filter(r => r.product_id === prodId && r.status === 'Approved').sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return [match];
  }

  // 9. Admin Auditing & Analytics
  if (/SELECT COUNT\(\*\) as totalUsers FROM users WHERE role = "customer"/i.test(normalizedSql)) {
    return [[{ totalUsers: data.users.filter(u => u.role === 'customer').length }]];
  }

  if (/SELECT COUNT\(\*\) as totalOrders FROM orders/i.test(normalizedSql)) {
    return [[{ totalOrders: data.orders.length }]];
  }

  if (/SELECT COALESCE\(SUM\(total_amount\), 0\) as totalRevenue/i.test(normalizedSql)) {
    const revenue = data.orders
      .filter(o => !['Cancelled', 'Returned', 'Refunded'].includes(o.order_status))
      .reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
    return [[{ totalRevenue: revenue }]];
  }

  if (/SELECT p\.id, p\.name, SUM\(oi\.quantity\) as sales_count/i.test(normalizedSql)) {
    const validOrders = data.orders.filter(o => !['Cancelled', 'Returned', 'Refunded'].includes(o.order_status)).map(o => o.id);
    const counts = {};
    data.order_items.filter(oi => validOrders.includes(oi.order_id)).forEach(oi => {
      if (!counts[oi.product_id]) counts[oi.product_id] = { qty: 0, rev: 0 };
      counts[oi.product_id].qty += oi.quantity;
      counts[oi.product_id].rev += oi.quantity * oi.price;
    });

    const topList = Object.keys(counts).map(pid => {
      const p = data.products.find(prod => prod.id === parseInt(pid, 10)) || {};
      return {
        id: parseInt(pid, 10),
        name: p.name || 'Product',
        sales_count: counts[pid].qty,
        revenue: counts[pid].rev
      };
    }).sort((a,b) => b.sales_count - a.sales_count).slice(0, 5);

    return [topList];
  }

  if (/SELECT c\.name as category_name, SUM\(oi\.quantity \* oi\.price\) as revenue/i.test(normalizedSql)) {
    const validOrders = data.orders.filter(o => !['Cancelled', 'Returned', 'Refunded'].includes(o.order_status)).map(o => o.id);
    const counts = {};
    data.order_items.filter(oi => validOrders.includes(oi.order_id)).forEach(oi => {
      const p = data.products.find(prod => prod.id === oi.product_id) || {};
      const catName = p.category_name || 'General';
      if (!counts[catName]) counts[catName] = 0;
      counts[catName] += oi.quantity * oi.price;
    });

    const list = Object.keys(counts).map(name => ({ category_name: name, revenue: counts[name] }));
    return [list];
  }

  if (/SELECT o\.\*, u\.name as customer_name, u\.email as customer_email/i.test(normalizedSql)) {
    const match = data.orders.map(o => {
      const u = data.users.find(usr => usr.id === o.user_id) || {};
      return {
        ...o,
        customer_name: u.name || 'Customer',
        customer_email: u.email || 'customer@oneclick.com'
      };
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return [match];
  }

  if (/UPDATE orders SET/i.test(normalizedSql)) {
    // Expecting order_status or payment_status params
    const id = params[params.length - 1];
    let order_status, payment_status;
    
    if (params.length === 3) {
      [order_status, payment_status] = params;
    } else {
      const field = normalizedSql.includes('order_status = ?') ? 'order_status' : 'payment_status';
      if (field === 'order_status') order_status = params[0];
      else payment_status = params[0];
    }

    data.orders = data.orders.map(o => {
      if (o.id === id) {
        return {
          ...o,
          order_status: order_status || o.order_status,
          payment_status: payment_status || o.payment_status
        };
      }
      return o;
    });

    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/SELECT id, name, email, phone, address, role, created_at FROM users ORDER BY/i.test(normalizedSql)) {
    return [data.users];
  }

  if (/DELETE FROM users WHERE id = \? AND role != "admin"/i.test(normalizedSql)) {
    const id = params[0];
    data.users = data.users.filter(u => !(u.id === id && u.role !== 'admin'));
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/SELECT r\.\*, u\.name as customer_name, p\.name as product_name/i.test(normalizedSql)) {
    const list = data.reviews.map(r => {
      const u = data.users.find(usr => usr.id === r.user_id) || {};
      const p = data.products.find(prod => prod.id === r.product_id) || {};
      return {
        ...r,
        customer_name: u.name || 'Customer',
        product_name: p.name || 'Product'
      };
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return [list];
  }

  if (/SELECT product_id FROM reviews WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    const match = data.reviews.filter(r => r.id === id);
    return [match];
  }

  if (/UPDATE reviews SET status = \? WHERE id = \?/i.test(normalizedSql)) {
    const [status, id] = params;
    data.reviews = data.reviews.map(r => r.id === id ? { ...r, status } : r);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/SELECT COALESCE\(AVG\(rating\), 0\) as avgRating FROM reviews WHERE product_id = \? AND status = "Approved"/i.test(normalizedSql)) {
    const prodId = params[0];
    const approved = data.reviews.filter(r => r.product_id === prodId && r.status === 'Approved');
    const avg = approved.length > 0 ? approved.reduce((sum, r) => sum + r.rating, 0) / approved.length : 0;
    return [[{ avgRating: avg }]];
  }

  if (/UPDATE products SET rating = \? WHERE id = \?/i.test(normalizedSql)) {
    const [rating, id] = params;
    data.products = data.products.map(p => p.id === id ? { ...p, rating: parseFloat(rating) } : p);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  if (/DELETE FROM reviews WHERE id = \?/i.test(normalizedSql)) {
    const id = params[0];
    data.reviews = data.reviews.filter(r => r.id !== id);
    saveJsonData(data);
    return [{ affectedRows: 1 }];
  }

  console.warn(`Unmatched Emulated SQL Query: ${normalizedSql}`);
  return [[]];
}

// Wrapper pool interface delegating depending on connection state
const poolProxy = {
  query: async (sql, params) => {
    if (useFallback) {
      return executeJsonQuery(sql, params);
    }
    return pool.query(sql, params);
  },
  getConnection: async () => {
    if (useFallback) {
      // Return emulated connection methods to handle transactional queries
      return {
        query: async (sql, params) => executeJsonQuery(sql, params),
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
      };
    }
    return pool.getConnection();
  }
};

module.exports = poolProxy;
