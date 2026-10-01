import 'dotenv/config'; // This loads and configures dotenv immediately
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
  // ssl: false
});

async function testConnection() {
  console.log('--- Database Connection Test (ESM) ---');
  try {
    const client = await pool.connect();
    console.log('✅ Success: Connected to the pool.');

    const res = await client.query('SELECT NOW() as current_time');
    console.log('✅ Success: Database time is:', res.rows[0].current_time);

    client.release();
  } catch (err) {
    console.error('❌ Connection Error:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();