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
    const result = await query('SELECT * FROM products ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock, discount_percent } = req.body;
  
  try {
    const result = await query(
      `INSERT INTO products (product_code, name, purchase_price, selling_price, current_stock, discount_percent)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [product_code, name, purchase_price || selling_price * 0.7, selling_price, current_stock || 0, discount_percent || 0]
    );
    res.json(result.rows[0]);
  } catch (error) {
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

app.patch('/api/products/:id/discount', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { discount_percent } = req.body;
  try {
    await query('UPDATE products SET discount_percent = $1 WHERE id = $2', [discount_percent, id]);
    const result = await query('SELECT * FROM products WHERE id = $1', [id]);
    res.json({ success: true, product: result.rows[0] });
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

// ============ BILL ROUTES - FIXED ✅ ============
app.post('/api/bills', authenticateToken, async (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  
  try {
    let totalAmount = 0;
    let totalCashback = 0;
    
    for (const item of items) {
      const product = await query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (product.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const p = product.rows[0];
      
      if (p.current_stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${p.name}` });
      }
      
      const cashbackAmount = (p.selling_price * (p.discount_percent || 0)) / 100;
      totalAmount += p.selling_price * item.quantity;
      totalCashback += cashbackAmount * item.quantity;
      
      await query('UPDATE products SET current_stock = current_stock - $1 WHERE id = $2', [item.quantity, p.id]);
    }
    
    const billNumber = `INV${Date.now()}`;
    
    // ✅ FIXED: Added subtotal column
    const billResult = await query(
      `INSERT INTO bills (bill_number, customer_id, subtotal, total_amount, cashback, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [billNumber, customer_id, totalAmount, totalAmount, totalCashback, payment_method || 'cash']
    );
    
    // ✅ Save bill items for selling history
    for (const item of items) {
      const product = await query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      const p = product.rows[0];
      const cashbackAmount = (p.selling_price * (p.discount_percent || 0)) / 100;
      
      await query(
        `INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, discount_percent, total_price, cashback_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          billResult.rows[0].id,
          item.product_id,
          item.quantity,
          p.selling_price,
          p.discount_percent || 0,
          p.selling_price * item.quantity,
          cashbackAmount * item.quantity
        ]
      );
    }
    
    await query('UPDATE customers SET total_purchases = total_purchases + $1 WHERE id = $2', [totalAmount, customer_id]);
    
    if (totalCashback > 0) {
      await query('UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id = $2', [totalCashback, customer_id]);
      await query(
        `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description)
         VALUES ($1, $2, $3, $4)`,
        [customer_id, totalCashback, 'CREDIT', `Cashback from bill ${billNumber}`]
      );
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
    
    res.json({ success: true, bill: billResult.rows[0], cashback: totalCashback });
  } catch (error) {
    console.error('Bill creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const result = await query(`
        SELECT b.*, c.name as customer_name 
        FROM bills b 
        JOIN customers c ON b.customer_id = c.id 
        ORDER BY b.created_at DESC
      `);
      res.json(result.rows);
    } else {
      const result = await query(`
        SELECT b.*, c.name as customer_name 
        FROM bills b 
        JOIN customers c ON b.customer_id = c.id 
        WHERE b.customer_id = $1 
        ORDER BY b.created_at DESC
      `, [req.user.id]);
      res.json(result.rows);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ BILL ITEMS ROUTE ============
app.get('/api/bills/:id/items', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT bi.*, p.name as product_name, p.product_code
      FROM bill_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.bill_id = $1
    `, [id]);
    res.json(result.rows);
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
    const lowStock = await query('SELECT COUNT(*) as total FROM products WHERE current_stock <= 5');
    
    res.json({
      total_sales: parseFloat(totalSales.rows[0].total),
      total_customers: parseInt(totalCustomers.rows[0].total),
      total_commission: parseFloat(totalCommission.rows[0].total || 0),
      low_stock_alerts: parseInt(lowStock.rows[0].total)
    });
  } catch (error) {
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

app.post('/api/wallet/add-money', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can add money' });
  }
  const { customer_id, amount, payment_method } = req.body;
  try {
    await query('UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, customer_id]);
    await query(
      `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description)
       VALUES ($1, $2, $3, $4)`,
      [customer_id, amount, 'CREDIT', `Added via ${payment_method} by admin`]
    );
    res.json({ success: true, message: 'Money added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN WALLET CONTROL ============
app.get('/api/admin/wallet/:customerId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const customer = await query('SELECT id, name, mobile, wallet_balance FROM customers WHERE id = $1', [req.params.customerId]);
    const transactions = await query('SELECT * FROM wallet_transactions WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.customerId]);
    res.json({ customer: customer.rows[0], transactions: transactions.rows });
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
        discount_percent DECIMAL(5,2) DEFAULT 0,
        total_price DECIMAL(10,2) NOT NULL,
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
    
    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('Table creation error:', error.message);
  }
}

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

initTables().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`✅ PostgreSQL Database Connected`);
    console.log(`📋 Admin: admin@shop.com / MyStrongPass@0424`);
    console.log(`📋 Customer: 9876543210 / 9876543210\n`);
  });
});