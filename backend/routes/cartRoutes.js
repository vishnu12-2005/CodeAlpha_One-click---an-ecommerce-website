const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect); // All cart routes require login

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.put('/', cartController.updateCartQuantity);
router.delete('/:product_id', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

module.exports = router;
