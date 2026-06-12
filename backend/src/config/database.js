const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA cache_size = -20000');

// Create tables and sample data
db.serialize(() => {
  // Users table (admin)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'admin'
  )`);

  // Customers table
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE,
    name TEXT,
    mobile TEXT UNIQUE,
    address TEXT,
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    password_hash TEXT,
    wallet_balance REAL DEFAULT 0,
    total_purchases REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE,
    name TEXT,
    purchase_price REAL,
    selling_price REAL,
    current_stock INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Bills table
  db.run(`CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE,
    customer_id INTEGER,
    subtotal REAL,
    tax REAL,
    total_amount REAL,
    payment_method TEXT DEFAULT 'cash',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Bill items table
  db.run(`CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price REAL,
    total_price REAL
  )`);

  // Commissions table
  db.run(`CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    referred_customer_id INTEGER,
    bill_id INTEGER,
    amount REAL,
    percentage REAL,
    status TEXT DEFAULT 'credited',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Wallet transactions table
  db.run(`CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    amount REAL,
    transaction_type TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Password resets table
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile TEXT,
    otp TEXT,
    expires_at DATETIME,
    used INTEGER DEFAULT 0
  )`);

  // System settings table
  db.run(`CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE,
    setting_value TEXT
  )`);

  // Insert default settings
  db.run(`INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES 
    ('commission_percentage', '10'),
    ('gst_percentage', '18')`);

  // Insert sample products
  db.run(`INSERT OR IGNORE INTO products (product_code, name, purchase_price, selling_price, current_stock) VALUES
    ('P001', 'Smartphone', 15000, 19999, 25),
    ('P002', 'Laptop', 45000, 54999, 10),
    ('P003', 'Headphones', 800, 1499, 50),
    ('P004', 'Charger', 300, 599, 100),
    ('P005', 'Power Bank', 500, 999, 30)`);

  // Insert sample customers
  const defaultPassword = bcrypt.hashSync('9876543210', 10);
  db.run(`INSERT OR IGNORE INTO customers (customer_id, name, mobile, referral_code, password_hash, wallet_balance) VALUES
    ('CUST001', 'John Doe', '9876543210', 'REF123', ?, 500)`, [defaultPassword]);
  
  db.run(`INSERT OR IGNORE INTO customers (customer_id, name, mobile, referral_code, referred_by, password_hash) VALUES
    ('CUST002', 'Jane Smith', '9876543211', 'REF456', 'REF123', ?)`, [defaultPassword]);

  // Create admin user
  const adminHash = bcrypt.hashSync('Admin@123', 10);
  db.run(`INSERT OR IGNORE INTO users (email, password_hash, role) VALUES 
    ('admin@shop.com', ?, 'admin')`, [adminHash]);

  console.log('✅ SQLite Database created and initialized successfully');
});
db.serialize(() => {
  db.run("CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code)");
  db.run("CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)");
  db.run("CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile)");
  db.run("CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(created_at)");
  console.log('✅ Database indexes created');
});
module.exports = db;