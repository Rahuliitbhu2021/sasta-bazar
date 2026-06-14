const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: 'postgres',  // ← Ye fix karo
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database error:', err.message);
  } else {
    console.log('✅ PostgreSQL connected');
    release();
  }
});

async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

module.exports = { pool, query };