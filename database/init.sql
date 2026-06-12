-- Drop existing database if exists (for fresh start)
DROP DATABASE IF EXISTS shop_management;
CREATE DATABASE shop_management;

\c shop_management;

-- Users table (for admin)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    referred_by VARCHAR(50),
    password_hash VARCHAR(255),
    wallet_balance DECIMAL(10,2) DEFAULT 0,
    total_purchases DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    current_stock INT DEFAULT 0,
    min_stock_level INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock transactions table
CREATE TABLE stock_transactions (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Bills table
CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Bill items table
CREATE TABLE bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Commissions table
CREATE TABLE commissions (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    referred_customer_id INT NOT NULL,
    bill_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'credited',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (referred_customer_id) REFERENCES customers(id),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- Wallet transactions table
CREATE TABLE wallet_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Password reset OTP table
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    mobile VARCHAR(20) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value) VALUES 
('commission_percentage', '0.5'),
('gst_percentage', '00');

-- Insert sample products
INSERT INTO products (product_code, name, purchase_price, selling_price, current_stock, min_stock_level) VALUES
('P001', 'Smartphone', 15000, 19999, 25, 5),
('P002', 'Laptop', 45000, 54999, 10, 3),
('P003', 'Headphones', 800, 1499, 50, 10),
('P004', 'Charger', 300, 599, 100, 20),
('P005', 'Power Bank', 500, 999, 30, 8);

-- Insert sample customers
INSERT INTO customers (customer_id, name, mobile, referral_code, password_hash, wallet_balance) VALUES
('CUST001', 'John Doe', '9876543210', 'REF123', '$2a$10$rQHjUzRZKXQZ5Z5Z5Z5ZuOZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5', 500),
('CUST002', 'Jane Smith', '9876543211', 'REF456', '$2a$10$rQHjUzRZKXQZ5Z5Z5Z5ZuOZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5', 0);

-- Update referral for Jane
UPDATE customers SET referred_by = 'REF123' WHERE mobile = '9876543211';

-- Create indexes
CREATE INDEX idx_customers_mobile ON customers(mobile);
CREATE INDEX idx_customers_referral_code ON customers(referral_code);
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_bills_customer ON bills(customer_id);
CREATE INDEX idx_bills_date ON bills(created_at);

-- Show success message
\dt


-- Add missing indexes
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_customers_mobile ON customers(mobile);
CREATE INDEX idx_bills_date ON bills(created_at);
CREATE INDEX idx_bills_customer ON bills(customer_id);

-- Composite indexes for reports
CREATE INDEX idx_bills_date_amount ON bills(created_at, total_amount);

-- Partial indexes for active data
CREATE INDEX idx_active_products ON products(id) WHERE current_stock > 0;