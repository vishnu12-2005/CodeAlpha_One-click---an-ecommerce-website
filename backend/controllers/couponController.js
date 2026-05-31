const db = require('../config/db');

exports.validateCoupon = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Coupon code is required.' });
  }

  try {
    const [coupons] = await db.query(
      'SELECT id, code, discount, expiry_date FROM coupons WHERE code = ?',
      [code]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    }

    const coupon = coupons[0];
    const expiry = new Date(coupon.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiry < today) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Coupon applied successfully.',
      discount: coupon.discount,
      code: coupon.code
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({ success: false, message: 'Server error validating coupon.' });
  }
};
