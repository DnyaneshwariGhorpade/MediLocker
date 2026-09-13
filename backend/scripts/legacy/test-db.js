require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Exists (starts with " + process.env.DATABASE_URL.substring(0, 15) + ")" : "Not found");
  
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log("Using URL:", connectionString ? "Exists" : "Not found");

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT current_database();");
    console.log("Connected to database:", res.rows[0].current_database);
    pool.end();
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
}

testConnection();
