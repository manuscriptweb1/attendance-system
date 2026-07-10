const pool = require('./config/database');

async function migrate() {
  try {
    console.log('Running migration...');
    await pool.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS electron_desktop_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS electron_desktop_validation_mode VARCHAR(80) DEFAULT 'trusted_device_and_network';
    `);
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    pool.end();
  }
}

migrate();
