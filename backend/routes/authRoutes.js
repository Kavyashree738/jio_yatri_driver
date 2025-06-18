// routes/authRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 3 OTP requests per windowMs
  handler: (req, res) => {
    res.status(429).json({ 
      success: false,
      error: 'rate_limit_exceeded',
      message: 'Too many OTP requests. Please try again later.'
    });
  },
  skipFailedRequests: true // don't count failed attempts (4xx/5xx)
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 verification attempts
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'verification_limit_exceeded',
      message: 'Too many verification attempts. Please try again later.'
    });
  }
});

const router = express.Router();

// Apply JSON content type to all responses
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', verifyLimiter, authController.verifyOtp);

module.exports = router;