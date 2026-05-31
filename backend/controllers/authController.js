const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'oneclick_jwt_secret_token_2026_premium_dark_ui',
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

exports.register = async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  try {
    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, phone, address, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone || null, address || null, 'customer']
    );

    const newUser = { id: result.insertId, name, email, role: 'customer' };
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const loggedUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = generateToken(loggedUser);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: loggedUser
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving profile.' });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, phone, address } = req.body;

  try {
    await db.query(
      'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
      [name, phone, address, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Please provide current and new passwords.' });
  }

  try {
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.user.id]);

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error changing password.' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required.' });
  }

  try {
    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'No user registered with this email.' });
    }

    // Generate a mock reset token and print to terminal (or simulate sending to email)
    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET || 'oneclick_jwt_secret_token_2026_premium_dark_ui', { expiresIn: '15m' });
    console.log(`[MOCK EMAIL] Password Reset Link: http://localhost:5000/pages/reset-password.html?token=${resetToken}`);

    return res.status(200).json({
      success: true,
      message: 'A password reset instructions email has been simulated. Check backend logs for the reset link.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error requesting password reset.' });
  }
};
