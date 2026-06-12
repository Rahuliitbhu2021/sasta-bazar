const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getProducts, getLowStockProducts, addProduct, updateProduct, updateStock, deleteProduct } = require('../controllers/productController');

router.get('/', authenticateToken, getProducts);
router.get('/low-stock', authenticateToken, getLowStockProducts);
router.post('/', authenticateToken, requireAdmin, addProduct);
router.put('/:id', authenticateToken, requireAdmin, updateProduct);
router.patch('/:id/stock', authenticateToken, requireAdmin, updateStock);
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);

module.exports = router;