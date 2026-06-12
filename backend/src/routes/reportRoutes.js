const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getDashboardStats, getDailySales, getMonthlySales, getCustomerWiseSales, getCommissionReport, getStockReport } = require('../controllers/reportController');

router.get('/dashboard', authenticateToken, requireAdmin, getDashboardStats);
router.get('/daily-sales', authenticateToken, requireAdmin, getDailySales);
router.get('/monthly-sales', authenticateToken, requireAdmin, getMonthlySales);
router.get('/customer-sales', authenticateToken, requireAdmin, getCustomerWiseSales);
router.get('/commissions', authenticateToken, requireAdmin, getCommissionReport);
router.get('/stock', authenticateToken, requireAdmin, getStockReport);

module.exports = router;