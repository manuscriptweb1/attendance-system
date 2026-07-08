require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update admins table
    console.log('Adding role and is_super_admin to admins table...');
    await client.query(`
      ALTER TABLE admins 
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin',
      ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'));
    `);

    console.log('Updating existing admins to super_admin...');
    await client.query(`
      UPDATE admins SET role = 'super_admin', is_super_admin = true;
    `);

    // 2. Create admin_pages table
    console.log('Creating admin_pages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_pages (
        id SERIAL PRIMARY KEY,
        page_key VARCHAR(100) UNIQUE NOT NULL,
        page_name VARCHAR(150) NOT NULL,
        route_path VARCHAR(200) NOT NULL,
        sidebar_section VARCHAR(100),
        icon_key VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create admin_permissions table
    console.log('Creating admin_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        page_key VARCHAR(100) NOT NULL,
        can_view BOOLEAN DEFAULT false,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_delete BOOLEAN DEFAULT false,
        can_export BOOLEAN DEFAULT false,
        can_clear BOOLEAN DEFAULT false,
        can_calculate BOOLEAN DEFAULT false,
        can_approve BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(admin_id, page_key)
      );
    `);

    // 4. Seed admin_pages
    console.log('Seeding admin_pages...');
    await client.query(`
      INSERT INTO admin_pages (page_key, page_name, route_path, sidebar_section, sort_order)
      VALUES
      ('dashboard', 'Dashboard', '/admin/dashboard', 'Overview', 1),
      ('employees', 'Employees', '/admin/employees', 'People', 2),
      ('departments', 'Departments', '/admin/departments', 'People', 3),
      ('admin_management', 'Admin Management', '/admin/admin-management', 'People', 4),
      ('attendance', 'Attendance', '/admin/attendance', 'Time & Attendance', 5),
      ('manual_attendance', 'Manual Attendance', '/admin/manual-attendance', 'Time & Attendance', 6),
      ('absent_reasons', 'Absent Reasons', '/admin/absent-reasons', 'Time & Attendance', 7),
      ('holidays', 'Holidays', '/admin/holidays', 'Time & Attendance', 8),
      ('payroll', 'Payroll', '/admin/payroll', 'HR & Finance', 9),
      ('expenses', 'Expenses', '/admin/expenses', 'HR & Finance', 10),
      ('reports', 'Reports', '/admin/reports', 'HR & Finance', 11),
      ('settings', 'Settings', '/admin/settings', 'System', 12),
      ('manage', 'Manage', '/admin/manage', 'System', 13),
      ('database_monitor', 'Database Monitor', '/admin/database-monitor', 'System', 14),
      ('trusted_devices', 'Trusted Devices', '/admin/trusted-devices', 'System', 15),
      ('activity_logs', 'Activity Logs', '/admin/activity-logs', 'System', 16),
      ('otp_settings', 'OTP Settings', '/admin/otp-settings', 'System', 17),
      ('security_logs', 'Security Logs', '/admin/security-logs', 'System', 18)
      ON CONFLICT (page_key) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed: ', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
