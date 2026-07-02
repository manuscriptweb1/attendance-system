const { Client } = require('pg');
require('dotenv').config();
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'attendance_db'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance';");
  console.log('Columns:', res.rows.map(r => r.column_name));



  await client.end();
}
run();
