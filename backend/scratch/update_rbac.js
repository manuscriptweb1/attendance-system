const pool = require('../config/database');

async function updateRbac() {
  try {
    console.log('Adding permissions page to admin_pages...');
    
    const checkPage = await pool.query("SELECT * FROM admin_pages WHERE page_key = 'permissions'");
    if (checkPage.rows.length === 0) {
      await pool.query(
        "INSERT INTO admin_pages (page_key, page_name, module_group, sort_order) VALUES ('permissions', 'Permissions', 'Time & Attendance', 25)"
      );
      console.log('Inserted permissions page');
    } else {
      console.log('Permissions page already exists');
    }

    console.log('Adding can_clear to admin_permissions...');
    await pool.query('ALTER TABLE admin_permissions ADD COLUMN IF NOT EXISTS can_clear BOOLEAN DEFAULT false');
    console.log('Added can_clear to admin_permissions');

  } catch (error) {
    console.error('Error updating RBAC:', error);
  } finally {
    process.exit(0);
  }
}

updateRbac();
