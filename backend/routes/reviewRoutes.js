const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');
const { reviewRules } = require('../middleware/validate');

router.post('/', protect, reviewRules, reviewController.submitReview);
router.get('/:product_id', reviewController.getProductReviews);

module.exports = router;
