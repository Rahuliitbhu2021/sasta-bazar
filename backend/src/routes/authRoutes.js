const express = require('express');
const router = express.Router();
const { adminLogin, customerLogin, sendOTPCode } = require('../controllers/authController');

router.post('/admin/login', adminLogin);
router.post('/customer/login', customerLogin);
router.post('/customer/send-otp', sendOTPCode);

module.exports = router;