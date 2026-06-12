const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Check if discount_percent column exists
  db.get("PRAGMA table_info(products)", (err, rows) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
  });
  
  // Add discount_percent column if not exists
  db.run("ALTER TABLE products ADD COLUMN discount_percent REAL DEFAULT 0", (err) => {
    if (err && err.message.includes('duplicate column')) {
      console.log('✅ discount_percent column already exists');
    } else if (err) {
      console.log('⚠️ Error:', err.message);
    } else {
      console.log('✅ Added discount_percent column');
    }
  });
  
  // Update some products with sample discounts
  db.run("UPDATE products SET discount_percent = 10 WHERE product_code = 'P001'");
  db.run("UPDATE products SET discount_percent = 15 WHERE product_code = 'P002'");
  db.run("UPDATE products SET discount_percent = 5 WHERE product_code = 'P003'");
  
  // Check results
  db.all("SELECT id, name, selling_price, discount_percent FROM products", (err, rows) => {
    console.log('\n📊 Products with discounts:');
    rows.forEach(row => {
      console.log(`   ${row.name}: ₹${row.selling_price} - Discount: ${row.discount_percent || 0}%`);
    });
  });
});

db.close();