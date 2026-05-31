const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { registerRules, loginRules } = require('../middleware/validate');

router.post('/register', registerRules, authController.register);
router.post('/login', loginRules, authController.login);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.put('/change-password', protect, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
