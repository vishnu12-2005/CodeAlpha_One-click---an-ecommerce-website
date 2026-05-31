const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { protect } = require('../middleware/auth');

router.post('/validate', protect, couponController.validateCoupon);

module.exports = router;
