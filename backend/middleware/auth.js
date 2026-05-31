const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

exports.protect = (req, res, next) => {
  let token;

  // Read Bearer token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authorization token is required.'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'oneclick_jwt_secret_token_2026_premium_dark_ui'
    );
    req.user = decoded; // Contains id, email, name, role
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or expired token.'
    });
  }
};

exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.'
    });
  }
};
