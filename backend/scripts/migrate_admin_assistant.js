require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Adding admin_assistant_enabled to settings table...');
    await client.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS admin_assistant_enabled BOOLEAN DEFAULT FALSE;
    `);
    await client.query('COMMIT');
    console.log('✓ Admin Assistant setting column migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
