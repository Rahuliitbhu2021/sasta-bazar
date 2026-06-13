const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ============ DATABASE ============
let products = [
  { id: 1, product_code: 'P001', name: 'Smartphone', purchase_price: 15000, selling_price: 19999, current_stock: 25, min_stock_level: 5, discount_percent: 10 },
  { id: 2, product_code: 'P002', name: 'Laptop', purchase_price: 45000, selling_price: 54999, current_stock: 10, min_stock_level: 3, discount_percent: 15 },
  { id: 3, product_code: 'P003', name: 'Headphones', purchase_price: 800, selling_price: 1499, current_stock: 50, min_stock_level: 10, discount_percent: 5 },
  { id: 4, product_code: 'P004', name: 'Charger', purchase_price: 300, selling_price: 599, current_stock: 100, min_stock_level: 20, discount_percent: 0 },
  { id: 5, product_code: 'P005', name: 'Power Bank', purchase_price: 500, selling_price: 999, current_stock: 30, min_stock_level: 8, discount_percent: 0 }
];

let customers = [
  { 
    id: 1, customer_id: 'CUST001', name: 'John Doe', mobile: '9876543210', address: '123 Main Street',
    referral_code: 'REF123', referred_by: null, 
    password_hash: bcrypt.hashSync('9876543210', 10),
    wallet_balance: 500, total_purchases: 0, transactions: [], created_at: new Date().toISOString()
  }
];

let bills = [];
let commissions = [];
let walletTransactions = [];

let nextProductId = 6;
let nextCustomerId = 2;
let nextBillId = 1;

// ============ HELPER FUNCTIONS ============
function generateReferralCode() {
  return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateCustomerId() {
  return 'CUST' + String(nextCustomerId).padStart(3, '0');
}

function generateBillNumber() {
  return 'INV' + Date.now();
}

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
app.post('/api/auth/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@shop.com' && password === 'MyStrongPass@0424') {
    const token = jwt.sign({ id: 1, email, role: 'admin' }, 'mysecretkey', { expiresIn: '7d' });
    res.json({ token, user: { id: 1, email, role: 'admin', name: 'Admin' } });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.post('/api/auth/customer/login', async (req, res) => {
  const { mobile, password } = req.body;
  console.log('Login attempt - Mobile:', mobile, 'Password:', password);
  
  const customer = customers.find(c => c.mobile === mobile);
  if (!customer) {
    return res.status(401).json({ error: 'Customer not found. Please register first.' });
  }
  
  const isValid = await bcrypt.compare(password, customer.password_hash);
  console.log('Password valid?', isValid);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password. Please try again.' });
  }
  
  const token = jwt.sign({ id: customer.id, role: 'customer' }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, customer });
});

app.post('/api/auth/customer/register', async (req, res) => {
  const { name, mobile, password, referralCode } = req.body;
  console.log('Registration attempt:', { name, mobile, password, referralCode });
  
  const existing = customers.find(c => c.mobile === mobile);
  if (existing) {
    return res.status(400).json({ error: 'Mobile number already registered. Please login.' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const newCustomer = {
    id: nextCustomerId++,
    customer_id: generateCustomerId(),
    name, mobile,
    password_hash: hashedPassword,
    wallet_balance: 0,
    total_purchases: 0,
    referral_code: generateReferralCode(),
    referred_by: referralCode || null,
    address: '',
    transactions: [],
    created_at: new Date().toISOString()
  };
  customers.push(newCustomer);
  console.log('Customer registered successfully:', { id: newCustomer.id, name: newCustomer.name, mobile: newCustomer.mobile });
  
  const token = jwt.sign({ id: newCustomer.id, role: 'customer' }, 'mysecretkey', { expiresIn: '7d' });
  res.json({ token, customer: newCustomer });
});

// ============ PRODUCT ROUTES ============
app.get('/api/products', authenticateToken, (req, res) => {
  res.json(products);
});

app.post('/api/products', authenticateToken, (req, res) => {
  const { product_code, name, purchase_price, selling_price, current_stock, min_stock_level, discount_percent } = req.body;
  const newProduct = {
    id: nextProductId++,
    product_code: product_code || `P00${nextProductId}`,
    name,
    purchase_price: purchase_price || selling_price * 0.7,
    selling_price,
    current_stock: current_stock || 0,
    min_stock_level: min_stock_level || 5,
    discount_percent: discount_percent || 0
  };
  products.push(newProduct);
  res.json(newProduct);
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { product_code, name, purchase_price, selling_price, min_stock_level, discount_percent } = req.body;
  const index = products.findIndex(p => p.id == id);
  if (index !== -1) {
    products[index] = { ...products[index], product_code, name, purchase_price, selling_price, min_stock_level, discount_percent };
    res.json(products[index]);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const index = products.findIndex(p => p.id == req.params.id);
  if (index !== -1) {
    products.splice(index, 1);
    res.json({ message: 'Product deleted successfully' });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.patch('/api/products/:id/discount', authenticateToken, (req, res) => {
  const product = products.find(p => p.id == req.params.id);
  if (product) {
    product.discount_percent = req.body.discount_percent || 0;
    res.json({ success: true, product });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// ============ CUSTOMER ROUTES ============
app.get('/api/customers', authenticateToken, (req, res) => {
  const customersList = customers.map(c => ({
    id: c.id, customer_id: c.customer_id, name: c.name, mobile: c.mobile,
    referral_code: c.referral_code, referred_by: c.referred_by,
    wallet_balance: c.wallet_balance, total_purchases: c.total_purchases,
    address: c.address, created_at: c.created_at
  }));
  res.json(customersList);
});

app.get('/api/customers/profile', authenticateToken, (req, res) => {
  const customer = customers.find(c => c.id === req.user.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const { password_hash, ...customerData } = customer;
  res.json(customerData);
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  const { name, mobile, address, referred_by, password } = req.body;
  
  console.log('Admin adding customer:', { name, mobile, password });
  
  // Check if customer already exists
  const existing = customers.find(c => c.mobile === mobile);
  if (existing) {
    return res.status(400).json({ error: 'Customer with this mobile already exists' });
  }
  
  // Use provided password or default to mobile number
  const customerPassword = password || mobile;
  const hashedPassword = await bcrypt.hash(customerPassword, 10);
  
  const newCustomer = {
    id: nextCustomerId++,
    customer_id: generateCustomerId(),
    name, mobile,
    password_hash: hashedPassword,
    wallet_balance: 0,
    total_purchases: 0,
    referral_code: generateReferralCode(),
    referred_by: referred_by || null,
    address: address || '',
    transactions: [],
    created_at: new Date().toISOString()
  };
  customers.push(newCustomer);
  console.log('Admin added customer:', { id: newCustomer.id, name: newCustomer.name, mobile: newCustomer.mobile, password: customerPassword });
  
  res.json({ 
    success: true, 
    customer: newCustomer,
    message: `Customer added! They can login with Mobile: ${mobile} / Password: ${customerPassword}`
  });
});

// ============ BILL ROUTES ============
app.post('/api/bills', authenticateToken, (req, res) => {
  const { customer_id, items, payment_method } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  let totalAmount = 0;      // Customer pays FULL amount (no discount on bill)
  let totalCashback = 0;    // Discount amount goes to wallet

  for (const item of items) {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.current_stock < item.quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const cashbackAmount = (product.selling_price * (product.discount_percent || 0)) / 100;
    
    totalAmount += product.selling_price * item.quantity;
    totalCashback += cashbackAmount * item.quantity;
    product.current_stock -= item.quantity;
  }

  const billNumber = generateBillNumber();
  const newBill = {
    id: nextBillId++,
    bill_number: billNumber,
    customer_id: customer.id,
    customer_name: customer.name,
    total_amount: totalAmount,
    cashback: totalCashback,
    items: items,
    payment_method: payment_method || 'cash',
    created_at: new Date().toISOString()
  };
  bills.push(newBill);

  customer.total_purchases += totalAmount;
  
  if (totalCashback > 0) {
    customer.wallet_balance += totalCashback;
    walletTransactions.push({
      id: walletTransactions.length + 1,
      customer_id: customer.id,
      amount: totalCashback,
      transaction_type: 'CREDIT',
      description: `🎁 Cashback from bill ${billNumber}`,
      created_at: new Date().toISOString()
    });
  }

  // Referral commission (0.5% of total amount)
  if (customer.referred_by) {
    const referrer = customers.find(c => c.referral_code === customer.referred_by);
    if (referrer) {
      const commissionAmount = (totalAmount * 0.5) / 100;
      if (commissionAmount > 0) {
        referrer.wallet_balance += commissionAmount;
        walletTransactions.push({
          id: walletTransactions.length + 1,
          customer_id: referrer.id,
          amount: commissionAmount,
          transaction_type: 'CREDIT',
          description: `🎁 Referral commission from bill ${billNumber}`,
          created_at: new Date().toISOString()
        });
        commissions.push({
          id: commissions.length + 1,
          customer_id: referrer.id,
          referred_customer_id: customer.id,
          bill_id: newBill.id,
          amount: commissionAmount,
          percentage: 0.5,
          created_at: new Date().toISOString()
        });
      }
    }
  }

  res.json({ success: true, bill: newBill, cashback: totalCashback });
});

app.get('/api/bills', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    res.json(bills);
  } else {
    res.json(bills.filter(b => b.customer_id === req.user.id));
  }
});

// ============ REPORT ROUTES ============
app.get('/api/reports/dashboard', authenticateToken, (req, res) => {
  const totalSales = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
  const lowStockAlerts = products.filter(p => p.current_stock <= p.min_stock_level).length;
  
  res.json({
    total_sales: totalSales,
    total_customers: customers.length,
    total_commission: totalCommission,
    low_stock_alerts: lowStockAlerts
  });
});

app.get('/api/reports/commissions', authenticateToken, (req, res) => {
  res.json(commissions);
});

// ============ WALLET ROUTES ============
app.get('/api/wallet/balance', authenticateToken, (req, res) => {
  const customer = customers.find(c => c.id === req.user.id);
  res.json({ balance: customer?.wallet_balance || 0 });
});

app.get('/api/wallet/transactions/:customerId', authenticateToken, (req, res) => {
  res.json(walletTransactions.filter(t => t.customer_id == req.params.customerId));
});

app.post('/api/wallet/add-money', authenticateToken, (req, res) => {
  const { customer_id, amount, payment_method } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
  customer.wallet_balance += amount;
  walletTransactions.push({
    id: walletTransactions.length + 1,
    customer_id: customer.id,
    amount: amount,
    transaction_type: 'CREDIT',
    description: `Added via ${payment_method}`,
    created_at: new Date().toISOString()
  });
  res.json({ success: true, new_balance: customer.wallet_balance });
});

// ============ ADMIN WALLET CONTROL ============
app.get('/api/admin/wallet/:customerId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const customer = customers.find(c => c.id == req.params.customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer, transactions: walletTransactions.filter(t => t.customer_id == customer.id) });
});

app.post('/api/admin/wallet/add', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
  customer.wallet_balance += amount;
  walletTransactions.push({
    id: walletTransactions.length + 1,
    customer_id: customer.id,
    amount: amount,
    transaction_type: 'CREDIT',
    description: reason || `Admin added ₹${amount}`,
    created_at: new Date().toISOString()
  });
  res.json({ success: true, new_balance: customer.wallet_balance });
});

app.post('/api/admin/wallet/deduct', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { customer_id, amount, reason } = req.body;
  const customer = customers.find(c => c.id === customer_id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.wallet_balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
  
  customer.wallet_balance -= amount;
  walletTransactions.push({
    id: walletTransactions.length + 1,
    customer_id: customer.id,
    amount: amount,
    transaction_type: 'DEBIT',
    description: reason || `Admin deducted ₹${amount}`,
    created_at: new Date().toISOString()
  });
  res.json({ success: true, new_balance: customer.wallet_balance });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📋 Admin Login: admin@shop.com / MyStrongPass@0424`);
  console.log(`📋 Demo Customer: 9876543210 / 9876543210`);
  console.log(`📋 Note: Admin added customers can login with mobile number as password\n`);
});