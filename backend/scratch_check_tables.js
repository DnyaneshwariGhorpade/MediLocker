require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('[', '').replace(']', '');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log("Tables found:", res.rows.length);
    console.log(res.rows.map(r => r.table_name));
    pool.end();
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
}

testConnection();
