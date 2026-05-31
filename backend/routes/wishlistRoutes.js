const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

router.use(protect); // All wishlist routes require login

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.delete('/:product_id', wishlistController.removeFromWishlist);

module.exports = router;
