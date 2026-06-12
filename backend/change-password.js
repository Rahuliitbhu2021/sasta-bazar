const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n========================================');
console.log('   CHANGE ADMIN PASSWORD');
console.log('========================================\n');

// Current admin dekhna hai?
db.get('SELECT email FROM users WHERE role = ?', ['admin'], (err, row) => {
  if (err) {
    console.error('Error:', err.message);
    db.close();
    return;
  }
  
  if (row) {
    console.log(`📧 Current Admin Email: ${row.email}\n`);
  }
  
  rl.question('Enter NEW password (min 6 characters): ', async (newPassword) => {
    if (newPassword.length < 6) {
      console.log('❌ Password must be at least 6 characters!');
      rl.close();
      db.close();
      return;
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    db.run('UPDATE users SET password_hash = ? WHERE role = ?', [hashedPassword, 'admin'], function(err) {
      if (err) {
        console.error('❌ Error:', err.message);
      } else {
        console.log('\n✅ Password changed successfully!\n');
        console.log('🔑 NEW PASSWORD:', newPassword);
        console.log('📧 Email: admin@shop.com\n');
        console.log('You can now login with this new password!\n');
      }
      rl.close();
      db.close();
    });
  });
});