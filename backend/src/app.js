const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ============ IN-MEMORY DATABASE ============
// Admin (email: admin@shop.com, password: MyStrongPass@0424)
const adminEmail = 'admin@shop.com';
const adminPasswordHash = bcrypt.hashSync('MyStrongPass@0424', 10);

// Customers array
let customers = [];
let nextCustomerId = 1;

// Products array
let products = [
  { id: 1, product_code: 'P001', name: 'Smartphone', selling_price: 19999, current_stock: 25, discount_percent: 10 },
  { id: 2, product_code: 'P002', name: 'Laptop', selling_price: 54999, current_stock: 10, discount_percent: 15 },
  { id: 3, product_code: 'P003', name: 'Headphones', selling_price: 1499, current_stock: 50, discount_percent: 5 },
  { id: 4, product_code: 'P004', name: 'Charger', selling_price: 599, current_stock: 100, discount_percent: 0 },
  { id: 5, product_code: 'P005', name: 'Power Bank', selling_price: 999, current_stock: 30, discount_percent: 0 }
];

// Bills array
let bills = [];
let nextBillId = 1;

// Add a default customer for testing
customers.push({
  id: nextCustomerId++,
  name: 'John Doe',
  mobile: '9876543210',
  password_hash: bcrypt.hashSync('9876543210', 10),
  wallet_balance: 500,
  total_purchases: 0,
  referral_code: 'REF123',
  referred_by: null,
  transactions: []
});

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

// ============ TEST ROUTES ============
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is reachable!', success: true });
});

// ============ AUTH ROUTES ============
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (email === adminEmail && password === 'MyStrongPass@0424') {
    const token = jwt.sign({ id: 1, email, role: 'admin' }, 'mysecretkey', { expiresIn: '7d' });
    res.json({ token, user: { id: 1, email, role: 'admin', name: 'Admin' } });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.post('/api/auth/customer/login', async (req, res) => {
  const { mobile, password } = req.body;
  const customer = customers.find(c => c.mobile === mobile);
  if (!customer) return res.status(401).json({ error: 'Customer not found' });
  const isValid = await bcrypt.compare(password, customer.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: customer.id, role: 'customer' }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, customer });
});

app.post('/api/auth/customer/register', async (req, res) => {
  const { name, mobile, password, referralCode } = req.body;
  if (customers.find(c => c.mobile === mobile)) {
    return res.status(400).json({ error: 'Mobile number already registered' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newCustomer = {
    id: nextCustomerId++,
    name,
    mobile,
    password_hash: hashedPassword,
    wallet_balance: 0,
    total_purchases: 0,
    referral_code: `REF${Math.random().toString(36).substring(7).toUpperCase()}`,
    referred_by: referralCode || null,
    transactions: []
  };
  customers.push(newCustomer);
  const token = jwt.sign({ id: newCustomer.id, role: 'customer' }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, customer: newCustomer });
});

// ============ PRODUCT ROUTES ============
app.get('/api/products', authenticateToken, (req, res) => {
  res.json(products);
});

app.post('/api/products', authenticateToken, (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock } = req.body;
  const newProduct = {
    id: products.length + 1,
    product_code,
    name,
    selling_price,
    current_stock: current_stock || 0,
    discount_percent: 0
  };
  products.push(newProduct);
  res.json(newProduct);
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
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

app.get('/api/customers/profile', authenticateToken, (req, res) => {
  const customer = customers.find(c => c.id === req.user.id);
  res.json(customer);
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, mobile, address, referred_by } = req.body;
  const hashedPassword = await bcrypt.hash(mobile, 10);
  const newCustomer = {
    id: nextCustomerId++,
    name,
    mobile,
    password_hash: hashedPassword,
    wallet_balance: 0,
    total_purchases: 0,
    referral_code: `REF${Math.random().toString(36).substring(7).toUpperCase()}`,
    referred_by: referred_by || null,
    transactions: []
  };
  customers.push(newCustomer);
  res.json(newCustomer);
});

// ============ BILL ROUTES ============
app.post('/api/bills', authenticateToken, (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  let subtotal = 0;
  let totalCashback = 0;
  const billItems = [];

  for (const item of items) {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.current_stock < item.quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const cashbackAmount = (product.selling_price * (product.discount_percent || 0)) / 100;
    const itemTotal = product.selling_price * item.quantity;
    subtotal += itemTotal;
    totalCashback += cashbackAmount * item.quantity;
    product.current_stock -= item.quantity;

    billItems.push({
      product_id: product.id,
      name: product.name,
      quantity: item.quantity,
      price: product.selling_price,
      cashback: cashbackAmount
    });
  }

  const billNumber = `INV${Date.now()}`;
  const newBill = {
    id: nextBillId++,
    bill_number: billNumber,
    customer_id: customer.id,
    customer_name: customer.name,
    subtotal: subtotal,
    total_amount: subtotal,
    items: billItems,
    cashback: totalCashback,
    created_at: new Date().toISOString()
  };
  bills.push(newBill);

  // Update customer
  customer.total_purchases += subtotal;
  if (totalCashback > 0) {
    customer.wallet_balance += totalCashback;
    customer.transactions.push({
      id: customer.transactions.length + 1,
      date: new Date().toISOString(),
      type: 'CREDIT',
      amount: totalCashback,
      description: `Cashback from bill ${billNumber}`
    });
  }

  // Referral commission (0.5%)
  if (customer.referred_by) {
    const referrer = customers.find(c => c.referral_code === customer.referred_by);
    if (referrer) {
      const commissionAmount = subtotal * 0.5 / 100;
      if (commissionAmount > 0) {
        referrer.wallet_balance += commissionAmount;
        referrer.transactions.push({
          id: referrer.transactions.length + 1,
          date: new Date().toISOString(),
          type: 'CREDIT',
          amount: commissionAmount,
          description: `Commission from bill ${billNumber}`
        });
      }
    }
  }

  res.json({ success: true, bill: newBill, cashback: totalCashback });
});

app.get('/api/bills', authenticateToken, (req, res) => {
  const customerBills = bills.filter(b => b.customer_id === req.user.id);
  res.json(customerBills);
});

// ============ REPORT ROUTES ============
app.get('/api/reports/dashboard', authenticateToken, (req, res) => {
  const totalSales = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const totalCommission = 0; // Calculate if needed
  const lowStockAlerts = products.filter(p => p.current_stock < 5).length;
  res.json({
    total_sales: totalSales,
    total_customers: customers.length,
    total_commission: totalCommission,
    low_stock_alerts: lowStockAlerts
  });
});

// ============ WALLET ROUTES ============
app.get('/api/wallet/transactions/:customerId', authenticateToken, (req, res) => {
  const customer = customers.find(c => c.id == req.params.customerId);
  res.json(customer?.transactions || []);
});

app.post('/api/wallet/add-money', authenticateToken, (req, res) => {
  const { customer_id, amount, payment_method } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.wallet_balance += amount;
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
app.get('/api/admin/wallet/:customerId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const customer = customers.find(c => c.id == req.params.customerId);
  res.json({ customer, transactions: customer?.transactions || [] });
});

app.post('/api/admin/wallet/add', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    customer.wallet_balance += amount;
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

app.post('/api/admin/wallet/deduct', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (customer) {
    if (customer.wallet_balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    customer.wallet_balance -= amount;
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

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📋 Admin: admin@shop.com / MyStrongPass@0424`);
  console.log(`📋 Customer: 9876543210 / 9876543210\n`);
});