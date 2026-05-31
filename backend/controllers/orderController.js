const db = require('../config/db');

exports.createOrder = async (req, res) => {
  const { shipping_address, payment_method, coupon_code } = req.body;

  try {
    // 1. Get user cart items
    const [cartItems] = await db.query(
      `SELECT c.product_id, c.quantity, p.price, p.discount, p.stock, p.name 
       FROM cart c 
       JOIN products p ON c.product_id = p.id 
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    // 2. Validate stock for all items
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}. Only ${item.stock} left.`
        });
      }
    }

    // 3. Calculate financial totals
    let subtotal = 0;
    cartItems.forEach(item => {
      const discountedPrice = item.price * (1 - item.discount / 100);
      subtotal += discountedPrice * item.quantity;
    });

    let discountAmount = 0;
    let validatedCouponCode = null;

    // Validate Coupon if provided
    if (coupon_code) {
      const [coupons] = await db.query(
        'SELECT * FROM coupons WHERE code = ? AND expiry_date >= CURRENT_DATE()',
        [coupon_code]
      );
      if (coupons.length > 0) {
        const coupon = coupons[0];
        discountAmount = subtotal * (coupon.discount / 100);
        validatedCouponCode = coupon.code;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid or expired coupon code.' });
      }
    }

    const totalAmount = Math.max(0, subtotal - discountAmount);

    // 4. Begin SQL Transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Create Order row
      // If payment is COD, status is Pending. If Online, we mark it Completed in this mock setup.
      const paymentStatus = payment_method === 'Online' ? 'Completed' : 'Pending';
      const orderStatus = 'Pending'; // initial state

      const [orderResult] = await connection.query(
        `INSERT INTO orders 
         (user_id, total_amount, payment_method, payment_status, order_status, shipping_address, coupon_code, discount_amount) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, totalAmount, payment_method, paymentStatus, orderStatus, shipping_address, validatedCouponCode, discountAmount]
      );

      const orderId = orderResult.insertId;

      // Create OrderItems and Deduct Product Stock
      for (const item of cartItems) {
        const finalPrice = item.price * (1 - item.discount / 100);
        
        // Insert item
        await connection.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, finalPrice]
        );

        // Update stock
        await connection.query(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      // Clear the cart
      await connection.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

      // Commit transaction
      await connection.commit();
      connection.release();

      return res.status(201).json({
        success: true,
        message: 'Order placed successfully.',
        orderId,
        totalAmount
      });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing checkout.' });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving order history.' });
  }
};

exports.getOrderDetails = async (req, res) => {
  const { id } = req.params;

  try {
    let query = 'SELECT * FROM orders WHERE id = ?';
    let queryParams = [id];

    // If client is not admin, restrict to their own order
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      queryParams.push(req.user.id);
    }

    const [orders] = await db.query(query, queryParams);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];

    // Fetch order items with product details
    const [items] = await db.query(
      `SELECT oi.id as item_id, oi.quantity, oi.price, p.name, p.image, p.id as product_id
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      order,
      items
    });
  } catch (error) {
    console.error('Get order details error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving order details.' });
  }
};

exports.cancelOrder = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch order and check status
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];
    if (order.order_status !== 'Pending' && order.order_status !== 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.order_status}.`
      });
    }

    // 2. Perform cancellation inside a transaction to restore stock
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update status
      await connection.query(
        "UPDATE orders SET order_status = 'Cancelled', payment_status = 'Failed' WHERE id = ?",
        [id]
      );

      // Restore product stocks
      const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        if (item.product_id) {
          await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      await connection.commit();
      connection.release();

      return res.status(200).json({
        success: true,
        message: 'Order cancelled successfully and stock updated.'
      });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ success: false, message: 'Server error cancelling order.' });
  }
};
