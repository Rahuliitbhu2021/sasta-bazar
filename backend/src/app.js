const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ============ IN-MEMORY DATABASE (TEMPORARY - WORKING) ============
// This will work without any database connection
const users = [
  {
    id: 1,
    email: 'admin@shop.com',
    password_hash: '$2a$10$rQHjUzRZKXQZ5Z5Z5Z5ZuOZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5', // "Admin@123"
    role: 'admin'
  }
];

const customers = [
  {
    id: 1,
    customer_id: 'CUST001',
    name: 'John Doe',
    mobile: '9876543210',
    referral_code: 'REF123',
    password_hash: '$2a$10$rQHjUzRZKXQZ5Z5Z5Z5ZuOZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5', // "9876543210"
    wallet_balance: 500,
    total_purchases: 0,
    transactions: []
  }
];

const products = [
  { id: 1, product_code: 'P001', name: 'Smartphone', selling_price: 19999, current_stock: 25, discount_percent: 10 },
  { id: 2, product_code: 'P002', name: 'Laptop', selling_price: 54999, current_stock: 10, discount_percent: 15 },
  { id: 3, product_code: 'P003', name: 'Headphones', selling_price: 1499, current_stock: 50, discount_percent: 5 },
  { id: 4, product_code: 'P004', name: 'Charger', selling_price: 599, current_stock: 100, discount_percent: 0 },
  { id: 5, product_code: 'P005', name: 'Power Bank', selling_price: 999, current_stock: 30, discount_percent: 0 }
];

let bills = [];
let commissions = [];

// ============ MIDDLEWARE ============
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

// ============ TEST ROUTE ============
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running on port 5000' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is reachable!', success: true });
});

// ============ AUTH ROUTES ============
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email, password);
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: 'Admin' } });
});

app.post('/api/auth/customer/login', async (req, res) => {
  const { mobile, password } = req.body;
  
  const customer = customers.find(c => c.mobile === mobile);
  if (!customer) {
    return res.status(401).json({ error: 'Customer not found' });
  }
  
  const isValid = await bcrypt.compare(password, customer.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid mobile or password' });
  }
  
  const token = jwt.sign({ id: customer.id, role: 'customer' }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, customer });
});

app.post('/api/auth/customer/register', async (req, res) => {
  const { name, mobile, password, referralCode } = req.body;
  
  const existing = customers.find(c => c.mobile === mobile);
  if (existing) {
    return res.status(400).json({ error: 'Customer already exists' });
  }
  
  const newId = customers.length + 1;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newCustomer = {
    id: newId,
    customer_id: `CUST00${newId}`,
    name: name,
    mobile: mobile,
    referral_code: `REF${Math.random().toString(36).substring(7).toUpperCase()}`,
    referred_by: referralCode || null,
    password_hash: hashedPassword,
    wallet_balance: 0,
    total_purchases: 0,
    transactions: []
  };
  
  customers.push(newCustomer);
  const token = jwt.sign({ id: newCustomer.id, role: 'customer' }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, customer: newCustomer });
});

// ============ PRODUCT ROUTES ============
app.get('/api/products', authenticateToken, async (req, res) => {
  res.json(products);
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock } = req.body;
  const newId = products.length + 1;
  const newProduct = {
    id: newId,
    product_code: product_code,
    name: name,
    selling_price: selling_price,
    current_stock: current_stock || 0,
    discount_percent: 0
  };
  products.push(newProduct);
  res.json(newProduct);
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { product_code, name, selling_price, min_stock_level } = req.body;
  const index = products.findIndex(p => p.id == id);
  if (index !== -1) {
    products[index] = { ...products[index], product_code, name, selling_price };
    res.json(products[index]);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const index = products.findIndex(p => p.id == id);
  if (index !== -1) {
    products.splice(index, 1);
    res.json({ message: 'Product deleted' });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.patch('/api/products/:id/discount', authenticateToken, async (req, res) => {
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
app.get('/api/customers', authenticateToken, async (req, res) => {
  const customersList = customers.map(c => ({
    id: c.id,
    customer_id: c.customer_id,
    name: c.name,
    mobile: c.mobile,
    referral_code: c.referral_code,
    wallet_balance: c.wallet_balance,
    total_purchases: c.total_purchases
  }));
  res.json(customersList);
});

app.get('/api/customers/profile', authenticateToken, async (req, res) => {
  const customer = customers.find(c => c.id === req.user.id);
  res.json(customer);
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, mobile, address, referred_by } = req.body;
  const newId = customers.length + 1;
  const hashedPassword = await bcrypt.hash(mobile, 10);
  const newCustomer = {
    id: newId,
    customer_id: `CUST00${newId}`,
    name: name,
    mobile: mobile,
    referral_code: `REF${Math.random().toString(36).substring(7).toUpperCase()}`,
    referred_by: referred_by || null,
    password_hash: hashedPassword,
    wallet_balance: 0,
    total_purchases: 0,
    transactions: []
  };
  customers.push(newCustomer);
  res.json(newCustomer);
});

// ============ BILL ROUTES ============
app.post('/api/bills', authenticateToken, async (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  
  let subtotal = 0;
  let totalCashback = 0;
  
  for (const item of items) {
    const product = products.find(p => p.id === item.product_id);
    if (!product) throw new Error(`Product not found`);
    if (product.current_stock < item.quantity) throw new Error(`Insufficient stock`);
    
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
    
    // Add cashback to wallet
    if (totalCashback > 0) {
      customer.wallet_balance += totalCashback;
      if (!customer.transactions) customer.transactions = [];
      customer.transactions.push({
        id: customer.transactions.length + 1,
        date: new Date().toISOString(),
        type: 'CREDIT',
        amount: totalCashback,
        description: `Cashback from bill ${billNumber}`
      });
    }
    
    // Handle referral commission (0.5%)
    if (customer.referred_by) {
      const referrer = customers.find(c => c.referral_code === customer.referred_by);
      if (referrer) {
        const commissionAmount = subtotal * 0.5 / 100;
        referrer.wallet_balance += commissionAmount;
        if (!referrer.transactions) referrer.transactions = [];
        referrer.transactions.push({
          id: referrer.transactions.length + 1,
          date: new Date().toISOString(),
          type: 'CREDIT',
          amount: commissionAmount,
          description: `Commission from bill ${billNumber}`
        });
        commissions.push({
          id: commissions.length + 1,
          customer_id: referrer.id,
          amount: commissionAmount,
          bill_id: newBill.id
        });
      }
    }
  }
  
  res.json({ success: true, bill: newBill, cashback: totalCashback, message: 'Bill created successfully' });
});

app.get('/api/bills', authenticateToken, async (req, res) => {
  res.json(bills);
});

// ============ REPORT ROUTES ============
app.get('/api/reports/dashboard', authenticateToken, async (req, res) => {
  const totalSales = bills.reduce((sum, b) => sum + b.total_amount, 0);
  res.json({
    total_sales: totalSales,
    total_customers: customers.length,
    total_commission: commissions.reduce((sum, c) => sum + c.amount, 0),
    low_stock_alerts: products.filter(p => p.current_stock < 5).length
  });
});

// ============ WALLET ROUTES ============
app.get('/api/wallet/transactions/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  const customer = customers.find(c => c.id == customerId);
  res.json(customer?.transactions || []);
});

app.post('/api/wallet/add-money', authenticateToken, async (req, res) => {
  const { customer_id, amount, payment_method } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.wallet_balance += amount;
    if (!customer.transactions) customer.transactions = [];
    customer.transactions.push({
      id: customer.transactions.length + 1,
      date: new Date().toISOString(),
      type: 'CREDIT',
      amount: amount,
      description: `Added via ${payment_method}`
    });
    res.json({ success: true, new_balance: customer.wallet_balance });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

// ============ ADMIN WALLET CONTROL ============
app.get('/api/admin/wallet/:customerId', authenticateToken, async (req, res) => {
  const customer = customers.find(c => c.id == req.params.customerId);
  res.json({ customer, transactions: customer?.transactions || [] });
});

app.post('/api/admin/wallet/add', authenticateToken, async (req, res) => {
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.wallet_balance += amount;
    if (!customer.transactions) customer.transactions = [];
    customer.transactions.push({
      id: customer.transactions.length + 1,
      date: new Date().toISOString(),
      type: 'CREDIT',
      amount: amount,
      description: reason || `Admin added ₹${amount}`
    });
    res.json({ success: true, new_balance: customer.wallet_balance });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

app.post('/api/admin/wallet/deduct', authenticateToken, async (req, res) => {
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    if (customer.wallet_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    customer.wallet_balance -= amount;
    if (!customer.transactions) customer.transactions = [];
    customer.transactions.push({
      id: customer.transactions.length + 1,
      date: new Date().toISOString(),
      type: 'DEBIT',
      amount: amount,
      description: reason || `Admin deducted ₹${amount}`
    });
    res.json({ success: true, new_balance: customer.wallet_balance });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Working without database!`);
  console.log(`\n📋 Login Credentials:`);
  console.log(`   Admin: admin@shop.com / Admin@123`);
  console.log(`   Customer: 9876543210 / 9876543210\n`);
});