const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { query } = require('./config/database');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ============ MIDDLEWARE ============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============ TEST ROUTE ============
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running with PostgreSQL!' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is reachable!', success: true });
});

// ============ AUTH ROUTES ============
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    let result = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user = result.rows[0];
    
    if (!user) {
      const hashedPassword = await bcrypt.hash('MyStrongPass@0424', 10);
      await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [email, hashedPassword, 'admin']);
      user = { id: 1, email, role: 'admin' };
    }
    
    if (email === 'admin@shop.com' && password === 'MyStrongPass@0424') {
      const token = jwt.sign({ id: user.id, email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, email, role: 'admin', name: 'Admin' } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/customer/login', async (req, res) => {
  const { mobile, password } = req.body;
  
  try {
    const result = await query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
    const customer = result.rows[0];
    
    if (!customer) {
      return res.status(401).json({ error: 'Customer not found' });
    }
    
    const isValid = await bcrypt.compare(password, customer.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign({ id: customer.id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/customer/register', async (req, res) => {
  const { name, mobile, password, referralCode } = req.body;
  
  try {
    const existing = await query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }
    
    const customerId = `CUST${Date.now()}`;
    const referralCodeNew = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await query(
      `INSERT INTO customers (customer_id, name, mobile, referral_code, referred_by, password_hash, wallet_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [customerId, name, mobile, referralCodeNew, referralCode || null, hashedPassword, 0]
    );
    
    const result = await query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
    const token = jwt.sign({ id: result.rows[0].id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCT ROUTES ============
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, product_code, name, purchase_price, selling_price, 
             current_stock, discount_percent, product_type, unit,
             weight_stock, rate_per_kg, cashback_percent, gst_percent,
             category, brand, description, status, image_url
      FROM products 
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock, discount_percent } = req.body;
  
  try {
    const result = await query(
      `INSERT INTO products (product_code, name, purchase_price, selling_price, current_stock, discount_percent, product_type, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [product_code, name, purchase_price || selling_price * 0.7, selling_price, current_stock || 0, discount_percent || 0, 'piece', 'piece']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { product_code, name, purchase_price, selling_price, discount_percent } = req.body;
  
  try {
    await query(
      `UPDATE products SET product_code=$1, name=$2, purchase_price=$3, selling_price=$4, discount_percent=$5 WHERE id=$6`,
      [product_code, name, purchase_price, selling_price, discount_percent, id]
    );
    const result = await query('SELECT * FROM products WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CUSTOMER ROUTES ============
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT id, customer_id, name, mobile, referral_code, wallet_balance, total_purchases FROM customers ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customers/profile', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM customers WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, mobile, address, referred_by, password } = req.body;
  const customerPassword = password || mobile;
  const hashedPassword = await bcrypt.hash(customerPassword, 10);
  const customerId = `CUST${Date.now()}`;
  const referralCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  try {
    const result = await query(
      `INSERT INTO customers (customer_id, name, mobile, address, referral_code, referred_by, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [customerId, name, mobile, address || '', referralCode, referred_by || null, hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Add customer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ BILL ROUTES - WITH WEIGHT SUPPORT ============
app.post('/api/bills', authenticateToken, async (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  
  console.log('📝 Creating bill for customer:', customer_id);
  
  try {
    let totalAmount = 0;
    let totalCashback = 0;
    
    for (const item of items) {
      const product = await query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (product.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const p = product.rows[0];
      
      // ✅ WEIGHT PRODUCT
      if (p.product_type === 'weight') {
        const weight = item.weight || 0;
        
        if (weight <= 0) {
          return res.status(400).json({ error: `Invalid weight for ${p.name}` });
        }
        
        if (p.weight_stock > 0 && weight > p.weight_stock) {
          return res.status(400).json({ 
            error: `Only ${p.weight_stock} ${p.unit} available for ${p.name}` 
          });
        }
        
        const cashbackAmount = (weight * p.rate_per_kg * (p.cashback_percent || 0)) / 100;
        const amount = weight * p.rate_per_kg;
        const gstAmount = (amount * (p.gst_percent || 0)) / 100;
        
        totalAmount += amount + gstAmount;
        totalCashback += cashbackAmount;
        
        if (p.weight_stock > 0) {
          const newStock = parseFloat(p.weight_stock) - parseFloat(weight);
          await query('UPDATE products SET weight_stock = $1 WHERE id = $2', [newStock, p.id]);
        }
      } else {
        // ✅ PIECE PRODUCT
        if (p.current_stock < item.quantity) {
          return res.status(400).json({ error: `Insufficient stock for ${p.name}` });
        }
        
        const cashbackAmount = (p.selling_price * (p.discount_percent || 0)) / 100;
        totalAmount += p.selling_price * item.quantity;
        totalCashback += cashbackAmount * item.quantity;
        
        await query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.quantity, p.id]);
      }
    }
    
    const billNumber = `INV${Date.now()}`;
    
    const billResult = await query(
      `INSERT INTO bills (bill_number, customer_id, subtotal, total_amount, cashback, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [billNumber, customer_id, totalAmount, totalAmount, totalCashback, payment_method || 'cash']
    );
    
    console.log('✅ Bill created:', billResult.rows[0].id);
    
    // ✅ SAVE BILL ITEMS
    for (const item of items) {
      const product = await query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      const p = product.rows[0];
      
      if (p.product_type === 'weight' && item.weight) {
        const cashbackAmount = (item.weight * p.rate_per_kg * (p.cashback_percent || 0)) / 100;
        const amount = item.weight * p.rate_per_kg;
        const gstAmount = (amount * (p.gst_percent || 0)) / 100;
        
        await query(
          `INSERT INTO weight_transactions (bill_id, product_id, weight, rate_per_kg, amount, gst_amount, cashback_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [billResult.rows[0].id, item.product_id, item.weight, p.rate_per_kg, amount, gstAmount, cashbackAmount]
        );
      } else {
        await query(
          `INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [billResult.rows[0].id, item.product_id, item.quantity, p.selling_price, p.selling_price * item.quantity]
        );
      }
    }
    
    // Update customer total purchases
    await query('UPDATE customers SET total_purchases = total_purchases + $1 WHERE id = $2', [totalAmount, customer_id]);
    
    // Add cashback to wallet
    if (totalCashback > 0) {
      await query('UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id = $2', [totalCashback, customer_id]);
      await query(
        `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description)
         VALUES ($1, $2, $3, $4)`,
        [customer_id, totalCashback, 'CREDIT', `Cashback from bill ${billNumber}`]
      );
      console.log('✅ Cashback added to wallet:', totalCashback);
    }
    
    // Referral commission
    const customer = await query('SELECT referred_by FROM customers WHERE id = $1', [customer_id]);
    if (customer.rows[0]?.referred_by) {
      const referrer = await query('SELECT id FROM customers WHERE referral_code = $1', [customer.rows[0].referred_by]);
      if (referrer.rows[0]) {
        const commissionAmount = (totalAmount * 0.5) / 100;
        if (commissionAmount > 0) {
          await query('UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id = $2', [commissionAmount, referrer.rows[0].id]);
          await query(
            `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description)
             VALUES ($1, $2, $3, $4)`,
            [referrer.rows[0].id, commissionAmount, 'CREDIT', `Commission from bill ${billNumber}`]
          );
        }
      }
    }
    
    res.json({ 
      success: true, 
      bill: billResult.rows[0], 
      cashback: totalCashback,
      total: totalAmount
    });
    
  } catch (error) {
    console.error('❌ Bill creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT b.*, c.name as customer_name 
      FROM bills b 
      JOIN customers c ON b.customer_id = c.id 
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WEIGHT PRODUCTS ROUTES ============
app.get('/api/weight-products', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM products WHERE product_type = 'weight' ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/weight-products', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const {
    product_code, name, category, brand, unit,
    rate_per_kg, min_weight, max_weight,
    cashback_percent, gst_percent, description,
    status, weight_stock, reorder_level, image_url
  } = req.body;
  
  try {
    const rate_per_gram = rate_per_kg / 1000;
    
    const result = await query(
      `INSERT INTO products (
        product_code, name, category, brand, unit,
        rate_per_kg, rate_per_gram, min_weight, max_weight,
        cashback_percent, gst_percent, description,
        status, weight_stock, reorder_level, image_url,
        product_type, selling_price, purchase_price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        product_code, name, category || 'General', brand || '',
        unit || 'Kg', rate_per_kg, rate_per_gram,
        min_weight || 0, max_weight || 0,
        cashback_percent || 0, gst_percent || 0,
        description || '', status || 'active',
        weight_stock || 0, reorder_level || 5,
        image_url || '', 'weight', rate_per_kg, rate_per_kg * 0.7
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create weight product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/weight-products/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { id } = req.params;
  const {
    product_code, name, category, brand, unit,
    rate_per_kg, min_weight, max_weight,
    cashback_percent, gst_percent, description,
    status, weight_stock, reorder_level, image_url
  } = req.body;
  
  try {
    const result = await query(
      `UPDATE products SET
        product_code = $1, name = $2, category = $3, brand = $4,
        unit = $5, rate_per_kg = $6, rate_per_gram = $7,
        min_weight = $8, max_weight = $9,
        cashback_percent = $10, gst_percent = $11,
        description = $12, status = $13,
        weight_stock = $14, reorder_level = $15,
        image_url = $16, selling_price = $17
       WHERE id = $18 RETURNING *`,
      [
        product_code, name, category, brand,
        unit, rate_per_kg, rate_per_gram,
        min_weight, max_weight,
        cashback_percent, gst_percent,
        description, status,
        weight_stock, reorder_level,
        image_url, rate_per_kg, id
      ]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update weight product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/weight-products/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { id } = req.params;
  
  try {
    const result = await query('DELETE FROM products WHERE id = $1 AND product_type = $2 RETURNING *', [id, 'weight']);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Weight product not found' });
    }
    
    res.json({ message: 'Weight product deleted successfully' });
  } catch (error) {
    console.error('Delete weight product error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/weight-products/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    const result = await query(
      'UPDATE products SET status = $1 WHERE id = $2 AND product_type = $3 RETURNING *',
      [status, id, 'weight']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/weight-products/:id/rate', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { id } = req.params;
  const { rate_per_kg } = req.body;
  
  try {
    const result = await query(
      'UPDATE products SET rate_per_kg = $1, rate_per_gram = $1/1000, selling_price = $1 WHERE id = $2 AND product_type = $3 RETURNING *',
      [rate_per_kg, id, 'weight']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/weight-products/:id/cashback', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { id } = req.params;
  const { cashback_percent } = req.body;
  
  try {
    const result = await query(
      'UPDATE products SET cashback_percent = $1 WHERE id = $2 AND product_type = $3 RETURNING *',
      [cashback_percent, id, 'weight']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REPORT ROUTES ============
app.get('/api/reports/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalSales = await query('SELECT COALESCE(SUM(total_amount), 0) as total FROM bills');
    const totalCustomers = await query('SELECT COUNT(*) as total FROM customers');
    const totalCommission = await query('SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE transaction_type = $1', ['CREDIT']);
    const lowStock = await query('SELECT COUNT(*) as total FROM products WHERE current_stock <= 5 OR weight_stock <= 5');
    
    res.json({
      total_sales: parseFloat(totalSales.rows[0].total),
      total_customers: parseInt(totalCustomers.rows[0].total),
      total_commission: parseFloat(totalCommission.rows[0].total || 0),
      low_stock_alerts: parseInt(lowStock.rows[0].total)
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ WALLET ROUTES ============
app.get('/api/wallet/transactions/:customerId', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM wallet_transactions WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customerId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/wallet/add', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { customer_id, amount, reason } = req.body;
  try {
    await query('UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, customer_id]);
    await query(
      `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description)
       VALUES ($1, $2, $3, $4)`,
      [customer_id, amount, 'CREDIT', reason || `Admin added ₹${amount}`]
    );
    res.json({ success: true, message: 'Money added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/wallet/deduct', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { customer_id, amount, reason } = req.body;
  try {
    const check = await query('SELECT wallet_balance FROM customers WHERE id = $1', [customer_id]);
    if (parseFloat(check.rows[0].wallet_balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    await query('UPDATE customers SET wallet_balance = wallet_balance - $1 WHERE id = $2', [amount, customer_id]);
    await query(
      `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description)
       VALUES ($1, $2, $3, $4)`,
      [customer_id, amount, 'DEBIT', reason || `Admin deducted ₹${amount}`]
    );
    res.json({ success: true, message: 'Money deducted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CREATE TABLES IF NOT EXISTS ==========
async function initTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin'
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) UNIQUE,
        name VARCHAR(255),
        mobile VARCHAR(20) UNIQUE,
        address TEXT,
        referral_code VARCHAR(50) UNIQUE,
        referred_by VARCHAR(50),
        password_hash VARCHAR(255),
        wallet_balance DECIMAL DEFAULT 0,
        total_purchases DECIMAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        product_code VARCHAR(50) UNIQUE,
        name VARCHAR(255),
        purchase_price DECIMAL,
        selling_price DECIMAL,
        current_stock INT DEFAULT 0,
        discount_percent DECIMAL DEFAULT 0,
        product_type VARCHAR(20) DEFAULT 'piece',
        unit VARCHAR(20) DEFAULT 'piece',
        rate_per_kg DECIMAL(10,2) DEFAULT 0,
        rate_per_gram DECIMAL(10,2) DEFAULT 0,
        min_weight DECIMAL(10,2) DEFAULT 0,
        max_weight DECIMAL(10,2) DEFAULT 0,
        gst_percent DECIMAL(5,2) DEFAULT 0,
        brand VARCHAR(100),
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        reorder_level INT DEFAULT 5,
        weight_stock DECIMAL(10,3) DEFAULT 0,
        image_url TEXT,
        cashback_percent DECIMAL DEFAULT 0,
        category VARCHAR(100) DEFAULT 'General',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        bill_number VARCHAR(50) UNIQUE,
        customer_id INT,
        subtotal DECIMAL DEFAULT 0,
        total_amount DECIMAL,
        cashback DECIMAL,
        payment_method VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS bill_items (
        id SERIAL PRIMARY KEY,
        bill_id INT REFERENCES bills(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS weight_transactions (
        id SERIAL PRIMARY KEY,
        bill_id INT REFERENCES bills(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        weight DECIMAL(10,3) NOT NULL,
        rate_per_kg DECIMAL(10,2) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        gst_amount DECIMAL(10,2) DEFAULT 0,
        cashback_amount DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        customer_id INT,
        amount DECIMAL,
        transaction_type VARCHAR(20),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        customer_id INT,
        referred_customer_id INT,
        bill_id INT,
        amount DECIMAL,
        percentage DECIMAL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id SERIAL PRIMARY KEY,
        product_id INT REFERENCES products(id),
        transaction_type VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        previous_stock DECIMAL(10,3) NOT NULL,
        new_stock DECIMAL(10,3) NOT NULL,
        reference_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT,
        old_data JSONB,
        new_data JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      CREATE TABLE IF NOT EXISTS hardware_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await query(`
      INSERT INTO hardware_settings (setting_key, setting_value) 
      VALUES 
        ('weighing_machine_type', 'serial'),
        ('weighing_machine_port', 'COM14'),
        ('weighing_machine_baudrate', '9600'),
        ('scale_stable_timeout', '2'),
        ('manual_weight_fallback', 'false')
      ON CONFLICT (setting_key) DO NOTHING
    `);
    
    await query(`UPDATE products SET product_type = 'piece', unit = 'piece', category = 'General' WHERE product_type IS NULL`);
    
    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('Table creation error:', error.message);
  }
}

// =============================================
// SERIALPORT - OPTIONAL DEPENDENCY
// =============================================
let SerialPort, ReadlineParser;
let scalePort = null;
let scaleWeight = 0;
let scaleConnected = false;
let lastWeight = 0;
let stableCount = 0;
const STABLE_THRESHOLD = 3;
let scaleDataBuffer = '';

try {
    const serialport = require('serialport');
    const parser = require('@serialport/parser-readline');
    SerialPort = serialport.SerialPort;
    ReadlineParser = parser.ReadlineParser;
    console.log('✅ Serialport loaded');
} catch (error) {
    console.log('⚠️ Serialport not available - scale disabled');
    SerialPort = null;
    ReadlineParser = class MockParser { constructor() { return { on: () => {} }; } };
}

// =============================================
// I-SCALE / MiScale WEIGHING MACHINE - COM14
// =============================================

// Connect to scale
app.post('/api/scale/connect', authenticateToken, async (req, res) => {
    const { port, baudRate } = req.body;
    
    try {
        if (scalePort) {
            try { scalePort.close(); } catch (e) {}
            scalePort = null;
        }
        
        const portName = port || 'COM14';
        const baud = baudRate || 9600;
        
        console.log(`🔌 Connecting to scale on ${portName} at ${baud} baud...`);
        
        // ✅ If SerialPort not available
        if (!SerialPort) {
            console.log('⚠️ SerialPort not available');
            scaleConnected = false;
            scaleWeight = 0;
            return res.json({ connected: false, error: 'SerialPort not available' });
        }
        
        scalePort = new SerialPort({ 
            path: portName, 
            baudRate: baud,
            autoOpen: false,
            dataBits: 8,
            parity: 'none',
            stopBits: 1
        });
        
        scalePort.open((err) => {
            if (err) {
                console.error('❌ Failed to open port:', err.message);
                scaleConnected = false;
                scaleWeight = 0;
                return res.json({ connected: false, error: err.message });
            }
            
            scaleConnected = true;
            console.log(`✅ Scale connected on ${portName}`);
            
            // ✅ Send commands to start reading
            try { 
                scalePort.write('C\r\n'); 
                console.log('📤 Sent "C" command');
            } catch (e) {}
            try { 
                scalePort.write('S\r\n'); 
                console.log('📤 Sent "S" command');
            } catch (e) {}
            
            res.json({ connected: true, message: `Scale connected on ${portName}` });
        });
        
        const parser = scalePort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        
        parser.on('data', (data) => {
            try {
                const trimmed = data.toString().trim();
                console.log('📊 RAW SCALE DATA:', JSON.stringify(trimmed));
                
                if (!trimmed) return;
                
                let weight = null;
                
                // ✅ Support multiple formats
                const match = trimmed.match(/([\d.]+)\s*kg/i) ||
                              trimmed.match(/ST,GS,([\d.]+),/i) ||
                              trimmed.match(/ST,GS,\+?([\d.]+),/i) ||
                              trimmed.match(/([\d.]+)/);
                
                if (match) {
                    weight = parseFloat(match[1]);
                }
                
                if (weight !== null && !isNaN(weight) && weight >= 0 && weight <= 50) {
                    const newWeight = parseFloat(weight.toFixed(3));
                    if (lastWeight > 0 && Math.abs(newWeight - lastWeight) <= 0.005) {
                        stableCount++;
                    } else {
                        stableCount = 0;
                    }
                    lastWeight = newWeight;
                    scaleWeight = newWeight;
                    console.log(`⚖️ Weight: ${newWeight} Kg | Stable: ${stableCount >= STABLE_THRESHOLD}`);
                }
            } catch (e) {
                console.log('⚠️ Parse error:', e.message);
            }
        });
        
        scalePort.on('error', (err) => {
            console.error('❌ Scale error:', err.message);
            scaleConnected = false;
            scaleWeight = 0;
        });
        
        scalePort.on('close', () => {
            console.log('⚠️ Scale port closed');
            scaleConnected = false;
            scaleWeight = 0;
        });
        
        setTimeout(() => {
            if (!res.headersSent) {
                scaleConnected = false;
                scaleWeight = 0;
                res.json({ connected: false, error: 'Connection timeout' });
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Scale connection error:', error);
        scaleConnected = false;
        scaleWeight = 0;
        res.json({ connected: false, error: error.message });
    }
});

// ✅ GET CURRENT WEIGHT
app.get('/api/scale/weight', authenticateToken, async (req, res) => {
    const isStable = stableCount >= STABLE_THRESHOLD;
    res.json({ 
        weight: scaleWeight, 
        connected: scaleConnected,
        stable: isStable && scaleConnected,
        unit: 'Kg'
    });
});

// ✅ DISCONNECT SCALE
app.post('/api/scale/disconnect', authenticateToken, async (req, res) => {
    try {
        if (scalePort) {
            scalePort.close();
            scalePort = null;
        }
        scaleConnected = false;
        scaleWeight = 0;
        lastWeight = 0;
        stableCount = 0;
        res.json({ success: true, message: 'Scale disconnected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ GET SCALE STATUS
app.get('/api/scale/status', authenticateToken, async (req, res) => {
    res.json({ 
        connected: scaleConnected,
        weight: scaleWeight,
        port: scalePort?.path || 'COM14',
        stable: stableCount >= STABLE_THRESHOLD
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

initTables().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`✅ PostgreSQL Database Connected`);
    console.log(`📋 Admin: admin@shop.com / MyStrongPass@0424`);
    console.log(`📋 Customer: 9876543210 / 9876543210\n`);
    console.log(`⚖️ Scale configured on COM14 at 9600 baud`);
  });
});