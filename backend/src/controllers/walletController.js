const pool = require('../config/database');

const getWalletBalance = async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const result = await pool.query('SELECT wallet_balance FROM customers WHERE customer_id=$1', [customerId]);
    res.json({ balance: parseFloat(result.rows[0]?.wallet_balance || 0) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const customer = await pool.query('SELECT id FROM customers WHERE customer_id=$1', [customerId]);
    
    const transactions = await pool.query(
      'SELECT * FROM wallet_transactions WHERE customer_id=$1 ORDER BY created_at DESC',
      [customer.rows[0].id]
    );
    
    res.json(transactions.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCommissions = async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const customer = await pool.query('SELECT id FROM customers WHERE customer_id=$1', [customerId]);
    
    const commissions = await pool.query(
      `SELECT c.*, cus.name as referred_customer_name, b.bill_number, b.total_amount
       FROM commissions c
       JOIN customers cus ON c.referred_customer_id = cus.id
       JOIN bills b ON c.bill_id = b.id
       WHERE c.customer_id=$1
       ORDER BY c.created_at DESC`,
      [customer.rows[0].id]
    );
    
    res.json(commissions.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const redeemWallet = async (req, res) => {
  const { amount } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const customerId = req.user.customerId;
    const customer = await client.query('SELECT id, wallet_balance FROM customers WHERE customer_id=$1 FOR UPDATE', [customerId]);
    
    if (customer.rows.length === 0) {
      throw new Error('Customer not found');
    }
    
    const currentBalance = parseFloat(customer.rows[0].wallet_balance);
    
    if (amount > currentBalance) {
      throw new Error('Insufficient wallet balance');
    }
    
    const newBalance = currentBalance - amount;
    await client.query('UPDATE customers SET wallet_balance=$1 WHERE id=$2', [newBalance, customer.rows[0].id]);
    
    await client.query(
      'INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description) VALUES ($1, $2, $3, $4)',
      [customer.rows[0].id, amount, 'DEBIT', 'Wallet redemption']
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'Amount redeemed successfully', new_balance: newBalance });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = { getWalletBalance, getTransactions, getCommissions, redeemWallet };