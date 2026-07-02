const { Client } = require('pg');
require('dotenv').config(); // Looks in the current working directory by default

async function migrate() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'attendance_db'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const query = `
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC(10,2) DEFAULT 0;
    `;
    
    await client.query(query);
    console.log('✅ Added check-in/check-out status and hours columns to attendance table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

migrate();
