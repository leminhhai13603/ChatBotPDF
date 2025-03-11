const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error acquiring client:', err.stack);
    return;
  }
  console.log('✅ Database connected successfully');
  
  // Log database info
  client.query('SELECT current_database(), current_user, version()', (err, result) => {
    release();
    if (err) {
      console.error('❌ Error executing query:', err.stack);
      return;
    }
    console.log('📊 Database Info:', result.rows[0]);
  });
});

module.exports = pool;
