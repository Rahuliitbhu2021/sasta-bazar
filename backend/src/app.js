const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./config/database');
const compression = require('compression');
const pool = require('./config/database');

dotenv.config();

const app = express();
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(compression());
const cache = new Map();

function getCached(key, ttl = 30000) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data, ttl = 30000) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}
// ========== END CACHE ==========        ← YAHAN TAK

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running on port 5000' });
});
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running on port 5000' });
});
// Helper functions
async function dbGet(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0];
}

async function dbRun(sql, params = []) {
  const result = await pool.query(sql, params);
  return { id: result.rows[0]?.id };
}

async function dbAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}
// Add this function after other helper functions
function calculatePriceWithDiscount(price, discountPercent) {
  if (!discountPercent || discountPercent === 0) {
    return { original: price, discounted: price, discountAmount: 0 };
  }
  const discountAmount = (price * discountPercent) / 100;
  return {
    original: price,
    discounted: price - discountAmount,
    discountAmount: discountAmount
  };
}
// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running! SQLite database connected.' });
});

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin Login
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: 'Admin' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Login
app.post('/api/auth/customer/login', async (req, res) => {
  const { mobile, password } = req.body;
  
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
    
    if (!customer) {
      return res.status(401).json({ error: 'Customer not found' });
    }
    
    const isValid = await bcrypt.compare(password, customer.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid mobile or password' });
    }
    
    const token = jwt.sign(
      { id: customer.id, role: 'customer', customerId: customer.customer_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Registration
app.post('/api/auth/customer/register', async (req, res) => {
  const { name, mobile, password, referralCode } = req.body;
  
  try {
    const existing = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
    if (existing) {
      return res.status(400).json({ error: 'Customer already exists' });
    }
    
    const customerId = `CUST${Date.now()}`;
    const newReferralCode = `REF${Math.random().toString(36).substring(7).toUpperCase()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await dbRun(
      `INSERT INTO customers (customer_id, name, mobile, referral_code, referred_by, password_hash) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customerId, name, mobile, newReferralCode, referralCode || null, hashedPassword]
    );
    
    const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [result.id]);
    
    const token = jwt.sign(
      { id: customer.id, role: 'customer', customerId: customer.customer_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { mobile } = req.body;
  
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE mobile = ?', [mobile]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    await dbRun('INSERT INTO password_resets (mobile, otp, expires_at) VALUES (?, ?, ?)', 
      [mobile, otp, expiresAt.toISOString()]);
    
    console.log(`OTP for ${mobile}: ${otp}`);
    res.json({ message: 'OTP sent successfully', demoOtp: otp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { mobile, otp, newPassword } = req.body;
  
  try {
    const resetRequest = await dbGet(
      'SELECT * FROM password_resets WHERE mobile = ? AND otp = ? AND used = 0 AND expires_at > datetime("now")',
      [mobile, otp]
    );
    
    if (!resetRequest) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    await dbRun('UPDATE password_resets SET used = 1 WHERE id = ?', [resetRequest.id]);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE customers SET password_hash = ? WHERE mobile = ?', [hashedPassword, mobile]);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Products
// 🔽 YEH PURANI ROUTE HATAAO 🔽
// OLD CODE DELETE KARO

// 🔽 AUR YEH NAYA CODE LIKHO 🔽
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const cacheKey = 'products_list';
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      console.log('✅ Serving from cache');
      return res.json(cached);
    }
    
    // Get from database with discount column
    const products = await dbAll('SELECT *, discount_percent as discount FROM products ORDER BY id DESC');
    
    // Store in cache
    setCached(cacheKey, products, 30000); // 30 seconds cache
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 🔼 UP TO HERE 🔼

// Add Product
app.post('/api/products', authenticateToken, async (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock } = req.body;
  
  try {
    const result = await dbRun(
      `INSERT INTO products (product_code, name, purchase_price, selling_price, current_stock) 
       VALUES (?, ?, ?, ?, ?)`,
      [product_code, name, purchase_price, selling_price, current_stock || 0]
    );
    const product = await dbGet('SELECT * FROM products WHERE id = ?', [result.id]);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { product_code, name, purchase_price, selling_price, min_stock_level } = req.body;
  
  try {
    await dbRun(
      `UPDATE products SET product_code=?, name=?, purchase_price=?, selling_price=?, min_stock_level=? 
       WHERE id=?`,
      [product_code, name, purchase_price, selling_price, min_stock_level || 5, id]
    );
    const product = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    await dbRun('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ========== UPDATE PRODUCT DISCOUNT ==========
app.patch('/api/products/:id/discount', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { id } = req.params;
  const { discount_percent } = req.body;
  
  try {
    await dbRun('UPDATE products SET discount_percent = ? WHERE id = ?', [discount_percent || 0, id]);
    const product = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ========== END DISCOUNT UPDATE ==========

// Get Customers
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await dbAll('SELECT id, customer_id, name, mobile, referral_code, referred_by, wallet_balance, total_purchases FROM customers ORDER BY id DESC');
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Customer Profile
app.get('/api/customers/profile', authenticateToken, async (req, res) => {
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.user.id]);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Customer
app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, mobile, address, referred_by } = req.body;
  const customerId = `CUST${Date.now()}`;
  const referralCode = `REF${Math.random().toString(36).substring(7).toUpperCase()}`;
  const defaultPassword = await bcrypt.hash(mobile, 10);
  
  try {
    const result = await dbRun(
      `INSERT INTO customers (customer_id, name, mobile, address, referral_code, referred_by, password_hash) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customerId, name, mobile, address, referralCode, referred_by || null, defaultPassword]
    );
    const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [result.id]);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Bill
app.post('/api/bills', authenticateToken, async (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  
  try {
    // Get commission percentage - FORCE 0.5%
    let commissionPercentage = 0.5;  // ← DIRECT 0.5 SET KARO
    
    console.log('💰 Commission percentage:', commissionPercentage, '%');
    
    let subtotal = 0;
    let totalCashback = 0;
    
    for (const item of items) {
      const product = await dbGet('SELECT * FROM products WHERE id = ?', [item.product_id]);
      
      if (product.current_stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }
      
      // Calculate cashback amount (discount)
      let cashbackAmount = 0;
      if (product.discount_percent && product.discount_percent > 0) {
        cashbackAmount = (product.selling_price * product.discount_percent) / 100;
      }
      
      const itemTotal = product.selling_price * item.quantity;
      subtotal += itemTotal;
      totalCashback += cashbackAmount * item.quantity;
      
      // Update stock
      const newStock = product.current_stock - item.quantity;
      await dbRun('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, item.product_id]);
    }
    
    // Create bill
    const billNumber = `INV${Date.now()}`;
    const billResult = await dbRun(
      `INSERT INTO bills (bill_number, customer_id, subtotal, tax, total_amount, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [billNumber, customer_id, subtotal, 0, subtotal, payment_method || 'cash']
    );
    
    // Add bill items
    for (const item of items) {
      const product = await dbGet('SELECT selling_price FROM products WHERE id = ?', [item.product_id]);
      await dbRun(
        `INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, total_price) 
         VALUES (?, ?, ?, ?, ?)`,
        [billResult.id, item.product_id, item.quantity, product.selling_price, product.selling_price * item.quantity]
      );
    }
    
    // Update customer total purchases
    await dbRun('UPDATE customers SET total_purchases = total_purchases + ? WHERE id = ?', [subtotal, customer_id]);
    
    // Add cashback to wallet
    if (totalCashback > 0) {
      await dbRun('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE id = ?', [totalCashback, customer_id]);
      await dbRun(
        `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description) 
         VALUES (?, ?, ?, ?)`,
        [customer_id, totalCashback, 'CREDIT', `🎁 Cashback from bill ${billNumber}`]
      );
    }
    
    // Handle referral commission - 0.5% FIXED
    const customer = await dbGet('SELECT referred_by FROM customers WHERE id = ?', [customer_id]);
    
    if (customer?.referred_by) {
      const referrer = await dbGet('SELECT id, name, mobile, wallet_balance FROM customers WHERE referral_code = ?', [customer.referred_by]);
      
      if (referrer) {
        // FORCE 0.5% - NO MATTER WHAT
        const commissionAmount = (subtotal * 0.5) / 100;  // ← DIRECT 0.5 MULTIPLY
        
        console.log(`💰 Commission: ${subtotal} * 0.5% = ${commissionAmount}`);
        
        if (commissionAmount > 0) {
          await dbRun(
            `INSERT INTO commissions (customer_id, referred_customer_id, bill_id, amount, percentage, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [referrer.id, customer_id, billResult.id, commissionAmount, 0.5, 'credited']
          );
          
          await dbRun('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE id = ?', [commissionAmount, referrer.id]);
          
          await dbRun(
            `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description) 
             VALUES (?, ?, ?, ?)`,
            [referrer.id, commissionAmount, 'CREDIT', `🎁 Referral commission (0.5%) from bill ${billNumber}`]
          );
          
          console.log(`✅ Commission ₹${commissionAmount} added to ${referrer.name}'s wallet`);
        }
      }
    }
    
    const bill = await dbGet('SELECT * FROM bills WHERE id = ?', [billResult.id]);
    
    res.json({ 
      success: true, 
      bill, 
      cashback: totalCashback,
      commission: (subtotal * 0.5) / 100,
      message: `Bill created! ₹${totalCashback} cashback added! Commission: 0.5%` 
    });
    
  } catch (error) {
    console.error('❌ Bill creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Bills
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const bills = await dbAll(
      `SELECT b.*, c.name as customer_name 
       FROM bills b 
       JOIN customers c ON b.customer_id = c.id 
       ORDER BY b.created_at DESC`
    );
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Reports
app.get('/api/reports/dashboard', authenticateToken, async (req, res) => {
  try {
    const salesResult = await dbGet('SELECT COALESCE(SUM(total_amount), 0) as total FROM bills');
    const customersResult = await dbGet('SELECT COUNT(*) as total FROM customers');
    const commissionResult = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM commissions');
    const lowStockResult = await dbGet('SELECT COUNT(*) as total FROM products WHERE current_stock <= min_stock_level');
    
    res.json({
      total_sales: salesResult?.total || 0,
      total_customers: customersResult?.total || 0,
      total_commission: commissionResult?.total || 0,
      low_stock_alerts: lowStockResult?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Wallet Transactions
app.get('/api/wallet/transactions/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const transactions = await dbAll(
      'SELECT * FROM wallet_transactions WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Money to Wallet
app.post('/api/wallet/add-money', authenticateToken, async (req, res) => {
  const { customer_id, amount, payment_method } = req.body;
  
  try {
    await dbRun('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, customer_id]);
    
    await dbRun(
      `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description) 
       VALUES (?, ?, ?, ?)`,
      [customer_id, amount, 'CREDIT', `Added via ${payment_method}`]
    );
    
    res.json({ success: true, message: 'Money added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ============ ADMIN WALLET CONTROL ============

// Get customer wallet details (Admin)
app.get('/api/admin/wallet/:customerId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { customerId } = req.params;
  
  try {
    const customer = await dbGet('SELECT id, name, mobile, wallet_balance FROM customers WHERE id = ?', [customerId]);
    const transactions = await dbAll('SELECT * FROM wallet_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20', [customerId]);
    
    res.json({ customer, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin add money to customer wallet
app.post('/api/admin/wallet/add', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { customer_id, amount, reason } = req.body;
  
  try {
    await dbRun('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, customer_id]);
    
    await dbRun(
      `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description) 
       VALUES (?, ?, ?, ?)`,
      [customer_id, amount, 'CREDIT', reason || `Admin added ₹${amount}`]
    );
    
    const customer = await dbGet('SELECT wallet_balance FROM customers WHERE id = ?', [customer_id]);
    res.json({ success: true, new_balance: customer.wallet_balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin deduct money from customer wallet
app.post('/api/admin/wallet/deduct', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { customer_id, amount, reason } = req.body;
  
  try {
    const customer = await dbGet('SELECT wallet_balance FROM customers WHERE id = ?', [customer_id]);
    
    if (customer.wallet_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    await dbRun('UPDATE customers SET wallet_balance = wallet_balance - ? WHERE id = ?', [amount, customer_id]);
    
    await dbRun(
      `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description) 
       VALUES (?, ?, ?, ?)`,
      [customer_id, amount, 'DEBIT', reason || `Admin deducted ₹${amount}`]
    );
    
    const updatedCustomer = await dbGet('SELECT wallet_balance FROM customers WHERE id = ?', [customer_id]);
    res.json({ success: true, new_balance: updatedCustomer.wallet_balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ END ADMIN WALLET CONTROL ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  console.log(`✅ SQLite Database is ready!`);
  console.log(`📁 Database file: backend/database.sqlite`);
  console.log(`\n📋 Login Credentials:`);
  console.log(`   Admin: admin@shop.com / Admin@123`);
  console.log(`   Customer: 9876543210 / 9876543210\n`);
});