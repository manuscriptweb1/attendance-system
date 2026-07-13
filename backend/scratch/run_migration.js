const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const migration = `
-- Add new columns to trusted_devices
ALTER TABLE trusted_devices
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key TEXT,
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT,
ADD COLUMN IF NOT EXISTS desktop_hostname TEXT,
ADD COLUMN IF NOT EXISTS desktop_platform TEXT,
ADD COLUMN IF NOT EXISTS electron_app_version TEXT,
ADD COLUMN IF NOT EXISTS desktop_signature_verified_at TIMESTAMP;

-- Add unique index on employee_id and desktop_public_key_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_employee_desktop_key
ON trusted_devices(employee_id, desktop_public_key_hash)
WHERE desktop_public_key_hash IS NOT NULL;

-- Add new columns to attendance
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS trusted_device_id INTEGER REFERENCES trusted_devices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;
`;

const run = async () => {
  try {
    console.log('Running migration...');
    await pool.query(migration);
    console.log('Migration completed successfully!');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    pool.end();
  }
};

run();
