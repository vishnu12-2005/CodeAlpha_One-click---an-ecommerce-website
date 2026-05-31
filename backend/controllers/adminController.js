const db = require('../config/db');

// --- 1. Analytics & Reports ---
exports.getAnalytics = async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) as totalUsers FROM users WHERE role = "customer"');
    const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) as totalOrders FROM orders');
    const [[{ totalRevenue }]] = await db.query('SELECT COALESCE(SUM(total_amount), 0) as totalRevenue FROM orders WHERE order_status NOT IN ("Cancelled", "Returned", "Refunded")');
    
    // Top products by sales count
    const [topProducts] = await db.query(
      `SELECT p.id, p.name, SUM(oi.quantity) as sales_count, SUM(oi.quantity * oi.price) as revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.order_status NOT IN ("Cancelled", "Returned", "Refunded")
       GROUP BY p.id, p.name
       ORDER BY sales_count DESC
       LIMIT 5`
    );

    // Sales by Category
    const [categorySales] = await db.query(
      `SELECT c.name as category_name, SUM(oi.quantity * oi.price) as revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.order_status NOT IN ("Cancelled", "Returned", "Refunded")
       GROUP BY c.name`
    );

    return res.status(200).json({
      success: true,
      analytics: {
        totalUsers,
        totalOrders,
        totalRevenue: parseFloat(totalRevenue),
        topProducts,
        categorySales
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating analytics.' });
  }
};

// --- 2. Product Management (CRUD) ---
exports.addProduct = async (req, res) => {
  const { category_id, name, description, price, discount, stock, image } = req.body;

  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ success: false, message: 'Please provide product name, price, and stock.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO products (category_id, name, description, price, discount, stock, image, rating) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0.00)`,
      [category_id || null, name, description || null, price, discount || 0.00, stock, image || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Product added successfully.',
      productId: result.insertId
    });
  } catch (error) {
    console.error('Add product error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating product.' });
  }
};

exports.editProduct = async (req, res) => {
  const { id } = req.params;
  const { category_id, name, description, price, discount, stock, image } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE products 
       SET category_id = ?, name = ?, description = ?, price = ?, discount = ?, stock = ?, image = ? 
       WHERE id = ?`,
      [category_id || null, name, description || null, price, discount || 0.00, stock, image || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.status(200).json({ success: true, message: 'Product updated successfully.' });
  } catch (error) {
    console.error('Edit product error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating product.' });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    return res.status(200).json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting product.' });
  }
};

// --- 3. Category Management (CRUD) ---
exports.addCategory = async (req, res) => {
  const { name, image } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }

  try {
    const [result] = await db.query('INSERT INTO categories (name, image) VALUES (?, ?)', [name, image || null]);
    return res.status(201).json({ success: true, message: 'Category created successfully.', categoryId: result.insertId });
  } catch (error) {
    console.error('Add category error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating category.' });
  }
};

exports.editCategory = async (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;

  try {
    const [result] = await db.query('UPDATE categories SET name = ?, image = ? WHERE id = ?', [name, image || null, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    return res.status(200).json({ success: true, message: 'Category updated successfully.' });
  } catch (error) {
    console.error('Edit category error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating category.' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    return res.status(200).json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting category.' });
  }
};

// --- 4. Order Management ---
exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email 
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving orders.' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { order_status, payment_status } = req.body;

  const validStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];
  if (order_status && !validStatuses.includes(order_status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status value.' });
  }

  try {
    let updateFields = [];
    let params = [];

    if (order_status) {
      updateFields.push('order_status = ?');
      params.push(order_status);
    }
    if (payment_status) {
      updateFields.push('payment_status = ?');
      params.push(payment_status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide status values to update.' });
    }

    params.push(id);
    const [result] = await db.query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    return res.status(200).json({ success: true, message: `Order status updated to ${order_status || payment_status}.` });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating order status.' });
  }
};

// --- 5. User Management ---
exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, phone, address, role, created_at FROM users ORDER BY role ASC, name ASC');
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving users.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found or user is an administrator.' });
    }
    return res.status(200).json({ success: true, message: 'User account removed.' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting user.' });
  }
};

// --- 6. Coupon Management ---
exports.getCoupons = async (req, res) => {
  try {
    const [coupons] = await db.query('SELECT * FROM coupons ORDER BY expiry_date DESC');
    return res.status(200).json({ success: true, coupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving coupons.' });
  }
};

exports.addCoupon = async (req, res) => {
  const { code, discount, expiry_date } = req.body;

  if (!code || discount === undefined || !expiry_date) {
    return res.status(400).json({ success: false, message: 'Please provide coupon code, discount percentage, and expiry date.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO coupons (code, discount, expiry_date) VALUES (?, ?, ?)',
      [code.toUpperCase(), discount, expiry_date]
    );
    return res.status(201).json({ success: true, message: 'Coupon added successfully.', couponId: result.insertId });
  } catch (error) {
    console.error('Add coupon error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating coupon.' });
  }
};

exports.deleteCoupon = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM coupons WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }
    return res.status(200).json({ success: true, message: 'Coupon deleted.' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting coupon.' });
  }
};

// --- 7. Review Moderation ---
exports.getReviews = async (req, res) => {
  try {
    const [reviews] = await db.query(
      `SELECT r.*, u.name as customer_name, p.name as product_name 
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC`
    );
    return res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error('Get reviews admin error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving reviews.' });
  }
};

exports.updateReviewStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Approved' or 'Rejected'

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid review status. Must be Approved or Rejected.' });
  }

  try {
    // 1. Get review product_id
    const [reviews] = await db.query('SELECT product_id FROM reviews WHERE id = ?', [id]);
    if (reviews.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const productId = reviews[0].product_id;

    // 2. Begin SQL transaction to update status and recalculate rating
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update status
      await connection.query('UPDATE reviews SET status = ? WHERE id = ?', [status, id]);

      // If approved, recalculate product rating average
      if (status === 'Approved') {
        const [[{ avgRating }]] = await connection.query(
          'SELECT COALESCE(AVG(rating), 0) as avgRating FROM reviews WHERE product_id = ? AND status = "Approved"',
          [productId]
        );
        await connection.query('UPDATE products SET rating = ? WHERE id = ?', [parseFloat(avgRating).toFixed(2), productId]);
      }

      await connection.commit();
      connection.release();

      return res.status(200).json({ success: true, message: `Review status updated to ${status}.` });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('Update review status error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating review status.' });
  }
};

exports.deleteReview = async (req, res) => {
  const { id } = req.params;

  try {
    const [reviews] = await db.query('SELECT product_id FROM reviews WHERE id = ?', [id]);
    if (reviews.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const productId = reviews[0].product_id;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      await connection.query('DELETE FROM reviews WHERE id = ?', [id]);

      // Recalculate average rating for product
      const [[{ avgRating }]] = await connection.query(
        'SELECT COALESCE(AVG(rating), 0) as avgRating FROM reviews WHERE product_id = ? AND status = "Approved"',
        [productId]
      );
      await connection.query('UPDATE products SET rating = ? WHERE id = ?', [parseFloat(avgRating).toFixed(2), productId]);

      await connection.commit();
      connection.release();

      return res.status(200).json({ success: true, message: 'Review deleted and product rating updated.' });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('Delete review error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting review.' });
  }
};
