exports.registerRules = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }

  if (!email || email.trim() === '') {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  next();
};

exports.loginRules = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || email.trim() === '') {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  if (!password || password.trim() === '') {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  next();
};

exports.reviewRules = (req, res, next) => {
  const { rating, comment } = req.body;

  if (rating === undefined || rating === null) {
    return res.status(400).json({ success: false, message: 'Rating is required.' });
  }

  const parsedRating = parseInt(rating, 10);
  if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
  }

  if (!comment || comment.trim() === '') {
    return res.status(400).json({ success: false, message: 'Review comment is required.' });
  }

  next();
};

exports.checkoutRules = (req, res, next) => {
  const { shipping_address, payment_method } = req.body;

  if (!shipping_address || shipping_address.trim() === '') {
    return res.status(400).json({ success: false, message: 'Shipping address is required.' });
  }

  if (!payment_method || !['COD', 'Online'].includes(payment_method)) {
    return res.status(400).json({ success: false, message: 'Please specify a valid payment method (COD or Online).' });
  }

  next();
};
