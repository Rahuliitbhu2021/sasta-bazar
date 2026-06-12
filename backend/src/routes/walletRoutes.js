const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getWalletBalance, getTransactions, getCommissions, redeemWallet } = require('../controllers/walletController');

router.get('/balance', authenticateToken, getWalletBalance);
router.get('/transactions', authenticateToken, getTransactions);
router.get('/commissions', authenticateToken, getCommissions);
router.post('/redeem', authenticateToken, redeemWallet);

module.exports = router;