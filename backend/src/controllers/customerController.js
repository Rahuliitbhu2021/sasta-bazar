const pool = require('../config/database');

const getCustomers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM customers ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomerById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id=$1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createCustomer = async (req, res) => {
  const { name, mobile, address, referred_by } = req.body;
  
  try {
    // Check if mobile already exists
    const existing = await pool.query('SELECT * FROM customers WHERE mobile=$1', [mobile]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Customer with this mobile already exists' });
    }
    
    const customerId = `CUST${Date.now()}`;
    const referralCode = `REF${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    const result = await pool.query(
      'INSERT INTO customers (customer_id, name, mobile, address, referral_code, referred_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [customerId, name, mobile, address, referralCode, referred_by || null]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, mobile, address } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE customers SET name=$1, mobile=$2, address=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *',
      [name, mobile, address, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomerProfile = async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const result = await pool.query('SELECT * FROM customers WHERE customer_id=$1', [customerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get referred customers
    const referrals = await pool.query(
      'SELECT name, mobile, total_purchases, created_at FROM customers WHERE referred_by=$1',
      [result.rows[0].referral_code]
    );
    
    const customer = result.rows[0];
    customer.referred_customers = referrals.rows;
    
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getReferrals = async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const customer = await pool.query('SELECT referral_code FROM customers WHERE customer_id=$1', [customerId]);
    
    const referrals = await pool.query(
      'SELECT * FROM customers WHERE referred_by=$1 ORDER BY created_at DESC',
      [customer.rows[0].referral_code]
    );
    
    res.json(referrals.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, getCustomerProfile, getReferrals };