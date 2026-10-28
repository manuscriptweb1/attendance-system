require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Adding monthly_permission_limit_minutes to settings table...');
    await client.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS monthly_permission_limit_minutes INTEGER DEFAULT 240;
    `);
    await client.query(`
      UPDATE settings 
      SET monthly_permission_limit_minutes = 240 
      WHERE monthly_permission_limit_minutes IS NULL;
    `);
    await client.query('COMMIT');
    console.log('✓ Monthly permission limit column migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
