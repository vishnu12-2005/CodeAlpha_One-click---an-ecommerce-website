const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');

router.use(protect, admin); // All admin routes require login AND admin role

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Product CRUD
router.post('/products', adminController.addProduct);
router.put('/products/:id', adminController.editProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Category CRUD
router.post('/categories', adminController.addCategory);
router.put('/categories/:id', adminController.editCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Orders
router.get('/orders', adminController.getOrders);
router.put('/orders/:id', adminController.updateOrderStatus);

// Users
router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);

// Coupons
router.get('/coupons', adminController.getCoupons);
router.post('/coupons', adminController.addCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);

// Reviews
router.get('/reviews', adminController.getReviews);
router.put('/reviews/:id', adminController.updateReviewStatus);
router.delete('/reviews/:id', adminController.deleteReview);

module.exports = router;
