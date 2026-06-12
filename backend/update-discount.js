const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Add discount column to products
  db.run("ALTER TABLE products ADD COLUMN discount_percent REAL DEFAULT 0", (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('⚠️ Column may already exist');
    } else {
      console.log('✅ Added discount_percent to products');
    }
  });
  
  // Update sample products with discounts
  db.run("UPDATE products SET discount_percent = 10 WHERE product_code = 'P001'");
  db.run("UPDATE products SET discount_percent = 15 WHERE product_code = 'P002'");
  db.run("UPDATE products SET discount_percent = 5 WHERE product_code = 'P003'");
  
  console.log('✅ Discount setup complete!');
  console.log('📊 Products with discounts:');
  db.all("SELECT product_code, name, selling_price, discount_percent FROM products", (err, rows) => {
    rows.forEach(row => {
      console.log(`   ${row.product_code} | ${row.name} | ₹${row.selling_price} | Discount: ${row.discount_percent || 0}%`);
    });
  });
});

db.close();