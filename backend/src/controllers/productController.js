const pool = require('../config/database');

const getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLowStockProducts = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE current_stock <= min_stock_level ORDER BY current_stock ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addProduct = async (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock, min_stock_level } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO products (product_code, name, purchase_price, selling_price, current_stock, min_stock_level) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [product_code, name, purchase_price, selling_price, current_stock || 0, min_stock_level || 5]
    );
    
    // Add stock transaction
    if (current_stock > 0) {
      await pool.query(
        'INSERT INTO stock_transactions (product_id, transaction_type, quantity, previous_stock, new_stock) VALUES ($1, $2, $3, $4, $5)',
        [result.rows[0].id, 'IN', current_stock, 0, current_stock]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { product_code, name, purchase_price, selling_price, min_stock_level } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE products SET product_code=$1, name=$2, purchase_price=$3, selling_price=$4, min_stock_level=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *',
      [product_code, name, purchase_price, selling_price, min_stock_level, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateStock = async (req, res) => {
  const { id } = req.params;
  const { quantity, type } = req.body; // type: 'add' or 'remove'
  
  try {
    const product = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const currentStock = product.rows[0].current_stock;
    let newStock;
    
    if (type === 'add') {
      newStock = currentStock + quantity;
    } else if (type === 'remove') {
      if (currentStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      newStock = currentStock - quantity;
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    
    await pool.query('UPDATE products SET current_stock=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [newStock, id]);
    
    await pool.query(
      'INSERT INTO stock_transactions (product_id, transaction_type, quantity, previous_stock, new_stock) VALUES ($1, $2, $3, $4, $5)',
      [id, type === 'add' ? 'IN' : 'OUT', quantity, currentStock, newStock]
    );
    
    res.json({ message: 'Stock updated successfully', newStock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getProducts, getLowStockProducts, addProduct, updateProduct, updateStock, deleteProduct };