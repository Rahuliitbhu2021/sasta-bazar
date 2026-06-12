const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

// For demo purposes - using OTP via console
// In production, integrate with Twilio
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTP = async (mobile) => {
  const otp = generateOTP();
  // Store OTP in memory/db with expiry
  // For demo, just console.log
  console.log(`OTP for ${mobile}: ${otp}`);
  return otp;
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const customerLogin = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    
    // Verify OTP (simplified for demo)
    // In production, verify against stored OTP
    if (otp !== '123456') { // Demo OTP
      return res.status(401).json({ error: 'Invalid OTP' });
    }
    
    let customer = await pool.query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
    
    if (customer.rows.length === 0) {
      // Auto-register new customer
      const customerId = `CUST${Date.now()}`;
      const referralCode = `REF${Math.random().toString(36).substring(7).toUpperCase()}`;
      
      const newCustomer = await pool.query(
        'INSERT INTO customers (customer_id, name, mobile, referral_code) VALUES ($1, $2, $3, $4) RETURNING *',
        [customerId, 'New Customer', mobile, referralCode]
      );
      customer = newCustomer;
    }
    
    const token = jwt.sign(
      { id: customer.rows[0].id, role: 'customer', customerId: customer.rows[0].customer_id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({ token, customer: customer.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const sendOTPCode = async (req, res) => {
  try {
    const { mobile } = req.body;
    const otp = await sendOTP(mobile);
    // In production, store OTP in database with expiry
    res.json({ message: 'OTP sent successfully', demoOtp: otp });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

module.exports = { adminLogin, customerLogin, sendOTPCode };