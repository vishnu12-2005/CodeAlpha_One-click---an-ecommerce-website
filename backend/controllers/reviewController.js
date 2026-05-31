const db = require('../config/db');

exports.submitReview = async (req, res) => {
  const { product_id, rating, comment } = req.body;

  try {
    // 1. Verify user purchased the product
    const [purchases] = await db.query(
      `SELECT oi.id 
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.order_status = 'Delivered'`,
      [req.user.id, product_id]
    );

    if (purchases.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products that you have purchased and that have been delivered.'
      });
    }

    // 2. Check if user already reviewed this product
    const [existing] = await db.query(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this product.'
      });
    }

    // 3. Create review (Default: Pending admin approval)
    await db.query(
      'INSERT INTO reviews (user_id, product_id, rating, comment, status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, product_id, rating, comment, 'Pending']
    );

    return res.status(201).json({
      success: true,
      message: 'Your review has been submitted and is pending administrator approval.'
    });
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({ success: false, message: 'Server error submitting review.' });
  }
};

exports.getProductReviews = async (req, res) => {
  const { product_id } = req.params;

  try {
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name 
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ? AND r.status = 'Approved'
       ORDER BY r.created_at DESC`,
      [product_id]
    );

    return res.status(200).json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching product reviews.' });
  }
};
