const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { checkoutRules } = require('../middleware/validate');

router.use(protect); // All order routes require login

router.post('/', checkoutRules, orderController.createOrder);
router.get('/', orderController.getMyOrders);
router.get('/:id', orderController.getOrderDetails);
router.put('/:id/cancel', orderController.cancelOrder);

module.exports = router;
