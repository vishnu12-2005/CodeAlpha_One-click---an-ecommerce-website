const db = require('../config/db');

exports.getWishlist = async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT w.id as wishlist_id, w.product_id, 
              p.name, p.price, p.discount, p.stock, p.image, p.rating 
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = ?`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      wishlist: items
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving wishlist.' });
  }
};

exports.addToWishlist = async (req, res) => {
  const { product_id } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, message: 'Product ID is required.' });
  }

  try {
    // Check if product exists
    const [products] = await db.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Insert ignore/insert (unique key will prevent duplicates)
    await db.query(
      'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)',
      [req.user.id, product_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Product added to wishlist.'
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return res.status(500).json({ success: false, message: 'Server error adding to wishlist.' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  const { product_id } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found in wishlist.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product removed from wishlist.'
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    return res.status(500).json({ success: false, message: 'Server error removing from wishlist.' });
  }
};
