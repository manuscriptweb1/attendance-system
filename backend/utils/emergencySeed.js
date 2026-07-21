const pool = require('../config/database');
const bcrypt = require('bcrypt');

const seedEmergencyAdmin = async () => {
  try {
    const isEnabled = process.env.EMERGENCY_ADMIN_ENABLED === 'true';
    const isAutoSeed = process.env.EMERGENCY_ADMIN_AUTO_SEED === 'true';

    if (!isEnabled || !isAutoSeed) {
      return;
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM admins');
    const count = parseInt(countResult.rows[0].count);

    if (count > 0) {
      return;
    }

    const username = process.env.EMERGENCY_ADMIN_USERNAME;
    const email = process.env.EMERGENCY_ADMIN_EMAIL;
    const password = process.env.EMERGENCY_ADMIN_PASSWORD;
    const role = process.env.EMERGENCY_ADMIN_ROLE || 'Super Admin';

    if (!username || !email || !password) {
      console.log('Emergency auto-seed skipped: Missing required environment variables');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO admins (
        username, email, password, role, is_super_admin, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [username, email, hashedPassword, role, true, 'Active']
    );

    console.log('Emergency Super Admin seeded from env');
  } catch (error) {
    console.error('Error in emergency auto-seed:', error.message);
  }
};

module.exports = { seedEmergencyAdmin };
