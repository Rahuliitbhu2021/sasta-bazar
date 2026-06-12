const pool = require('../config/database');

const generateBillNumber = async () => {
  const result = await pool.query("SELECT COUNT(*) FROM bills WHERE DATE(created_at) = CURRENT_DATE");
  const count = parseInt(result.rows[0].count) + 1;
  const date = new Date();
  const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
  return `INV${dateStr}${count.toString().padStart(4, '0')}`;
};

const createBill = async (req, res) => {
  const { customer_id, items, payment_method = 'cash' } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get commission percentage from settings
    const settings = await client.query("SELECT setting_value FROM system_settings WHERE setting_key='commission_percentage'");
    const commissionPercentage = parseFloat(settings.rows[0]?.setting_value || 5);
    
    let subtotal = 0;
    const billItems = [];
    
    // Calculate totals and check stock
    for (const item of items) {
      const product = await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE', [item.product_id]);
      
      if (product.rows[0].current_stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.rows[0].name}`);
      }
      
      const totalPrice = product.rows[0].selling_price * item.quantity;
      subtotal += totalPrice;
      
      billItems.push({
        ...item,
        unit_price: product.rows[0].selling_price,
        total_price: totalPrice
      });
      
      // Update stock
      const newStock = product.rows[0].current_stock - item.quantity;
      await client.query('UPDATE products SET current_stock=$1 WHERE id=$2', [newStock, item.product_id]);
      
      // Record stock transaction
      await client.query(
        'INSERT INTO stock_transactions (product_id, transaction_type, quantity, previous_stock, new_stock) VALUES ($1, $2, $3, $4, $5)',
        [item.product_id, 'OUT', item.quantity, product.rows[0].current_stock, newStock]
      );
    }
    
    // Calculate tax (GST)
    const taxSettings = await client.query("SELECT setting_value FROM system_settings WHERE setting_key='gst_percentage'");
    const gstPercentage = parseFloat(taxSettings.rows[0]?.setting_value || 18);
    const tax = (subtotal * gstPercentage) / 100;
    const totalAmount = subtotal + tax;
    
    // Create bill
    const billNumber = await generateBillNumber();
    const billResult = await client.query(
      'INSERT INTO bills (bill_number, customer_id, subtotal, tax, total_amount, payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [billNumber, customer_id, subtotal, tax, totalAmount, payment_method]
    );
    const bill = billResult.rows[0];
    
    // Add bill items
    for (const item of billItems) {
      await client.query(
        'INSERT INTO bill_items (bill_id, product_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [bill.id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
    }
    
    // Update customer total purchases
    await client.query(
      'UPDATE customers SET total_purchases = total_purchases + $1 WHERE id=$2',
      [totalAmount, customer_id]
    );
    
    // Handle referral commission
    const customer = await client.query('SELECT referred_by FROM customers WHERE id=$1', [customer_id]);
    
    if (customer.rows[0]?.referred_by) {
      const referrer = await client.query('SELECT id FROM customers WHERE referral_code=$1', [customer.rows[0].referred_by]);
      
      if (referrer.rows[0]) {
        const commissionAmount = (totalAmount * commissionPercentage) / 100;
        
        const commissionResult = await client.query(
          'INSERT INTO commissions (customer_id, referred_customer_id, bill_id, amount, percentage, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [referrer.rows[0].id, customer_id, bill.id, commissionAmount, commissionPercentage, 'credited']
        );
        
        // Credit to wallet
        await client.query(
          'UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id=$2',
          [commissionAmount, referrer.rows[0].id]
        );
        
        await client.query(
          'INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
          [referrer.rows[0].id, commissionAmount, 'CREDIT', `Commission from bill ${billNumber}`, commissionResult.rows[0].id.toString()]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Get complete bill with items
    const completeBill = await getBillWithItems(bill.id);
    res.json(completeBill);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

const getBillWithItems = async (billId) => {
  const billResult = await pool.query('SELECT * FROM bills WHERE id=$1', [billId]);
  const itemsResult = await pool.query(
    `SELECT bi.*, p.name, p.product_code 
     FROM bill_items bi 
     JOIN products p ON bi.product_id = p.id 
     WHERE bi.bill_id = $1`,
    [billId]
  );
  
  const customer = await pool.query('SELECT name, mobile FROM customers WHERE id=$1', [billResult.rows[0].customer_id]);
  
  return {
    ...billResult.rows[0],
    items: itemsResult.rows,
    customer: customer.rows[0]
  };
};

const getBills = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, c.name as customer_name, c.mobile 
       FROM bills b 
       JOIN customers c ON b.customer_id = c.id 
       ORDER BY b.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBillById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const bill = await getBillWithItems(id);
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomerBills = async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM bills WHERE customer_id=$1 ORDER BY created_at DESC',
      [customerId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createBill, getBills, getBillById, getCustomerBills };