
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Cloud SQL public IP connections need SSL in production; DBeaver-style
 
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

module.exports = { pool };
