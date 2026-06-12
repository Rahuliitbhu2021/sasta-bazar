const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createBill, getBills, getBillById, getCustomerBills } = require('../controllers/billController');

router.post('/', authenticateToken, requireAdmin, createBill);
router.get('/', authenticateToken, requireAdmin, getBills);
router.get('/:id', authenticateToken, getBillById);
router.get('/customer/:customerId', authenticateToken, getCustomerBills);

module.exports = router;