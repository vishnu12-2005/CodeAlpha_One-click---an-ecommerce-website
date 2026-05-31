const db = require('../config/db');

exports.getCart = async (req, res) => {
  try {
    const [cartItems] = await db.query(
      `SELECT c.id as cart_id, c.product_id, c.quantity, 
              p.name, p.price, p.discount, p.stock, p.image 
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      cart: cartItems
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving shopping cart.' });
  }
};

exports.addToCart = async (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, message: 'Product ID is required.' });
  }

  try {
    // 1. Verify product exists and check stock
    const [products] = await db.query('SELECT stock, name FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = products[0];

    // 2. Check if product is already in user's cart
    const [existing] = await db.query('SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?', [req.user.id, product_id]);

    let newQuantity = quantity;
    if (existing.length > 0) {
      newQuantity = existing[0].quantity + parseInt(quantity, 10);
    }

    if (newQuantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} units of ${product.name} are available in stock.`
      });
    }

    // 3. Insert or update cart
    if (existing.length > 0) {
      await db.query('UPDATE cart SET quantity = ? WHERE id = ?', [newQuantity, existing[0].id]);
    } else {
      await db.query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', [req.user.id, product_id, quantity]);
    }

    return res.status(200).json({
      success: true,
      message: 'Product added to cart successfully.'
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ success: false, message: 'Server error adding to cart.' });
  }
};

exports.updateCartQuantity = async (req, res) => {
  const { product_id, quantity } = req.body;

  if (!product_id || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'Product ID and quantity are required.' });
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive integer.' });
  }

  try {
    // Verify product stock
    const [products] = await db.query('SELECT stock, name FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = products[0];
    if (parsedQty > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} units of ${product.name} are available in stock.`
      });
    }

    const [result] = await db.query(
      'UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
      [parsedQty, req.user.id, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Cart quantity updated.'
    });
  } catch (error) {
    console.error('Update cart error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating cart quantity.' });
  }
};

exports.removeFromCart = async (req, res) => {
  const { product_id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [req.user.id, product_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product removed from cart.'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({ success: false, message: 'Server error removing item from cart.' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await db.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({ success: false, message: 'Server error clearing cart.' });
  }
};
