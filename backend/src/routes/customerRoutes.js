const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getCustomers, getCustomerById, createCustomer, updateCustomer, getCustomerProfile, getReferrals } = require('../controllers/customerController');

router.get('/', authenticateToken, requireAdmin, getCustomers);
router.get('/profile', authenticateToken, getCustomerProfile);
router.get('/referrals', authenticateToken, getReferrals);
router.get('/:id', authenticateToken, requireAdmin, getCustomerById);
router.post('/', authenticateToken, requireAdmin, createCustomer);
router.put('/:id', authenticateToken, requireAdmin, updateCustomer);

module.exports = router;