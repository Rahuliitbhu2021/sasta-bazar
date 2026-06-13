const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ============ SIMPLE IN-MEMORY DATABASE ============
// Admin user with your password: MyStrongPass@0424
// Generate hash for "MyStrongPass@0424" using bcrypt
const adminPasswordHash = '$2a$10$rQHjUzRZKXQZ5Z5Z5Z5ZuOZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5';

// Sample products
let products = [
  { id: 1, product_code: 'P001', name: 'Smartphone', selling_price: 19999, current_stock: 25, discount_percent: 10 },
  { id: 2, product_code: 'P002', name: 'Laptop', selling_price: 54999, current_stock: 10, discount_percent: 15 },
  { id: 3, product_code: 'P003', name: 'Headphones', selling_price: 1499, current_stock: 50, discount_percent: 5 }
];

// Sample customers
let customers = [
  { 
    id: 1, 
    name: 'John Doe', 
    mobile: '9876543210', 
    password_hash: '$2a$10$rQHjUzRZKXQZ5Z5Z5Z5ZuOZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
    wallet_balance: 500,
    total_purchases: 0,
    referral_code: 'REF123'
  }
];

let bills = [];
let commissions = [];

// ============ HELPER FUNCTIONS ============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, 'mysecretkey', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============ TEST ROUTES ============
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is reachable!', success: true });
});

// ============ ADMIN LOGIN ============
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email);
  
  // Check if email is admin@shop.com and password is MyStrongPass@0424
  if (email === 'admin@shop.com' && password === 'MyStrongPass@0424') {
    const token = jwt.sign({ id: 1, email: email, role: 'admin' }, 'mysecretkey', { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { id: 1, email: email, role: 'admin', name: 'Admin' } 
    });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

// ============ PRODUCT ROUTES ============
app.get('/api/products', authenticateToken, (req, res) => {
  res.json(products);
});

app.post('/api/products', authenticateToken, (req, res) => {
  const { product_code, name, selling_price, current_stock } = req.body;
  const newProduct = {
    id: products.length + 1,
    product_code: product_code,
    name: name,
    selling_price: selling_price,
    current_stock: current_stock || 0,
    discount_percent: 0
  };
  products.push(newProduct);
  res.json(newProduct);
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { product_code, name, selling_price } = req.body;
  const index = products.findIndex(p => p.id == id);
  if (index !== -1) {
    products[index] = { ...products[index], product_code, name, selling_price };
    res.json(products[index]);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const index = products.findIndex(p => p.id == id);
  if (index !== -1) {
    products.splice(index, 1);
    res.json({ message: 'Product deleted' });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.patch('/api/products/:id/discount', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { discount_percent } = req.body;
  const product = products.find(p => p.id == id);
  if (product) {
    product.discount_percent = discount_percent;
    res.json({ success: true, product });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// ============ CUSTOMER ROUTES ============
app.get('/api/customers', authenticateToken, (req, res) => {
  const customerList = customers.map(c => ({
    id: c.id,
    name: c.name,
    mobile: c.mobile,
    referral_code: c.referral_code,
    wallet_balance: c.wallet_balance,
    total_purchases: c.total_purchases
  }));
  res.json(customerList);
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, mobile, referred_by } = req.body;
  const newId = customers.length + 1;
  const passwordHash = await bcrypt.hash(mobile, 10);
  const newCustomer = {
    id: newId,
    name: name,
    mobile: mobile,
    password_hash: passwordHash,
    wallet_balance: 0,
    total_purchases: 0,
    referral_code: `REF${Math.random().toString(36).substring(7).toUpperCase()}`,
    referred_by: referred_by || null
  };
  customers.push(newCustomer);
  res.json(newCustomer);
});

// ============ BILL ROUTES ============
app.post('/api/bills', authenticateToken, (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  
  let subtotal = 0;
  let totalCashback = 0;
  
  for (const item of items) {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.current_stock < item.quantity) return res.status(400).json({ error: 'Insufficient stock' });
    
    const cashbackAmount = (product.selling_price * (product.discount_percent || 0)) / 100;
    subtotal += product.selling_price * item.quantity;
    totalCashback += cashbackAmount * item.quantity;
    product.current_stock -= item.quantity;
  }
  
  const billNumber = `INV${Date.now()}`;
  const newBill = {
    id: bills.length + 1,
    bill_number: billNumber,
    customer_id: customer_id,
    total_amount: subtotal,
    created_at: new Date().toISOString()
  };
  bills.push(newBill);
  
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.total_purchases += subtotal;
    if (totalCashback > 0) {
      customer.wallet_balance += totalCashback;
    }
  }
  
  res.json({ success: true, bill: newBill, cashback: totalCashback });
});

app.get('/api/bills', authenticateToken, (req, res) => {
  res.json(bills);
});

// ============ REPORT ROUTES ============
app.get('/api/reports/dashboard', authenticateToken, (req, res) => {
  const totalSales = bills.reduce((sum, b) => sum + b.total_amount, 0);
  res.json({
    total_sales: totalSales,
    total_customers: customers.length,
    total_commission: commissions.reduce((sum, c) => sum + c.amount, 0),
    low_stock_alerts: products.filter(p => p.current_stock < 5).length
  });
});

// ============ WALLET ROUTES ============
app.get('/api/wallet/transactions/:customerId', authenticateToken, (req, res) => {
  res.json([]);
});

app.post('/api/wallet/add-money', authenticateToken, (req, res) => {
  const { customer_id, amount, payment_method } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.wallet_balance += amount;
    res.json({ success: true, new_balance: customer.wallet_balance });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

// ============ ADMIN WALLET CONTROL ============
app.get('/api/admin/wallet/:customerId', authenticateToken, (req, res) => {
  const customer = customers.find(c => c.id == req.params.customerId);
  res.json({ customer, transactions: [] });
});

app.post('/api/admin/wallet/add', authenticateToken, (req, res) => {
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.wallet_balance += amount;
    res.json({ success: true, new_balance: customer.wallet_balance });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

app.post('/api/admin/wallet/deduct', authenticateToken, (req, res) => {
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    if (customer.wallet_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    customer.wallet_balance -= amount;
    res.json({ success: true, new_balance: customer.wallet_balance });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`✅ Working! No database needed.`);
  console.log(`\n📋 Admin Login: admin@shop.com / MyStrongPass@0424`);
  console.log(`📋 Customer: 9876543210 / 9876543210\n`);
});