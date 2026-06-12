const pool = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    // Total sales
    const salesResult = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM bills');
    
    // Total profit (simplified - based on purchase vs selling)
    const profitResult = await pool.query(`
      SELECT COALESCE(SUM((bi.unit_price - p.purchase_price) * bi.quantity), 0) as total_profit
      FROM bill_items bi
      JOIN products p ON bi.product_id = p.id
    `);
    
    // Total customers
    const customersResult = await pool.query('SELECT COUNT(*) as total FROM customers');
    
    // Total commission paid
    const commissionResult = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM commissions WHERE status="credited"');
    
    // Low stock alerts
    const lowStockResult = await pool.query('SELECT COUNT(*) as total FROM products WHERE current_stock <= min_stock_level');
    
    res.json({
      total_sales: parseFloat(salesResult.rows[0].total),
      total_profit: parseFloat(profitResult.rows[0].total_profit),
      total_customers: parseInt(customersResult.rows[0].total),
      total_commission: parseFloat(commissionResult.rows[0].total),
      low_stock_alerts: parseInt(lowStockResult.rows[0].total)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDailySales = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE(created_at) as date, 
             COUNT(*) as bill_count,
             SUM(total_amount) as total_sales,
             SUM(tax) as total_tax
      FROM bills
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMonthlySales = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE_TRUNC('month', created_at) as month,
             COUNT(*) as bill_count,
             SUM(total_amount) as total_sales
      FROM bills
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomerWiseSales = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.mobile, 
             COUNT(b.id) as bill_count,
             COALESCE(SUM(b.total_amount), 0) as total_purchases,
             COALESCE(SUM(wt.amount), 0) as wallet_earned
      FROM customers c
      LEFT JOIN bills b ON c.id = b.customer_id
      LEFT JOIN wallet_transactions wt ON c.id = wt.customer_id AND wt.transaction_type = 'CREDIT'
      GROUP BY c.id, c.name, c.mobile
      ORDER BY total_purchases DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCommissionReport = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.referral_code,
             COUNT(DISTINCT ref.id) as total_referrals,
             COALESCE(SUM(comm.amount), 0) as total_commission,
             c.wallet_balance
      FROM customers c
      LEFT JOIN customers ref ON c.referral_code = ref.referred_by
      LEFT JOIN commissions comm ON c.id = comm.customer_id
      GROUP BY c.id, c.name, c.referral_code, c.wallet_balance
      ORDER BY total_commission DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStockReport = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
             COALESCE(SUM(CASE WHEN st.transaction_type = 'IN' THEN st.quantity ELSE 0 END), 0) as total_in,
             COALESCE(SUM(CASE WHEN st.transaction_type = 'OUT' THEN st.quantity ELSE 0 END), 0) as total_out
      FROM products p
      LEFT JOIN stock_transactions st ON p.id = st.product_id
      GROUP BY p.id
      ORDER BY p.current_stock ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDashboardStats, getDailySales, getMonthlySales, getCustomerWiseSales, getCommissionReport, getStockReport };