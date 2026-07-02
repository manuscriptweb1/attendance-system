const pool = require('../config/database');

/**
 * Migration Script: Change Attendance Table to Use Employee Code
 * 
 * This script will:
 * 1. Add a new column for employee_code (VARCHAR)
 * 2. Migrate existing data from employee_id (INTEGER) to employee_code
 * 3. Drop old foreign key constraint
 * 4. Drop old employee_id column
 * 5. Rename employee_code to employee_id
 * 6. Add new foreign key constraint to employees.employee_id
 * 7. Recreate indexes
 */

async function migrateAttendanceTable() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration...\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Step 1: Add new column for employee code
    console.log('Step 1: Adding new employee_code column...');
    await client.query(`
      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50)
    `);
    console.log('✓ employee_code column added\n');
    
    // Step 2: Migrate data - copy employee codes from employees table
    console.log('Step 2: Migrating data from database IDs to employee codes...');
    const updateResult = await client.query(`
      UPDATE attendance a
      SET employee_code = e.employee_id
      FROM employees e
      WHERE a.employee_id = e.id
    `);
    console.log(`✓ Migrated ${updateResult.rowCount} attendance records\n`);
    
    // Step 3: Verify migration - check for any NULL values
    console.log('Step 3: Verifying migration...');
    const nullCheck = await client.query(`
      SELECT COUNT(*) as null_count 
      FROM attendance 
      WHERE employee_code IS NULL
    `);
    
    if (parseInt(nullCheck.rows[0].null_count) > 0) {
      throw new Error(`Migration failed: ${nullCheck.rows[0].null_count} records have NULL employee_code`);
    }
    console.log('✓ All records successfully migrated\n');
    
    // Step 4: Drop old foreign key constraint
    console.log('Step 4: Dropping old foreign key constraint...');
    await client.query(`
      ALTER TABLE attendance 
      DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey
    `);
    console.log('✓ Old foreign key dropped\n');
    
    // Step 5: Drop old unique constraint if exists
    console.log('Step 5: Dropping old unique constraint...');
    await client.query(`
      ALTER TABLE attendance 
      DROP CONSTRAINT IF EXISTS attendance_employee_id_attendance_date_key
    `);
    console.log('✓ Old unique constraint dropped\n');
    
    // Step 6: Drop old employee_id column
    console.log('Step 6: Dropping old employee_id (INTEGER) column...');
    await client.query(`
      ALTER TABLE attendance 
      DROP COLUMN employee_id
    `);
    console.log('✓ Old employee_id column dropped\n');
    
    // Step 7: Rename employee_code to employee_id
    console.log('Step 7: Renaming employee_code to employee_id...');
    await client.query(`
      ALTER TABLE attendance 
      RENAME COLUMN employee_code TO employee_id
    `);
    console.log('✓ Column renamed\n');
    
    // Step 8: Add NOT NULL constraint
    console.log('Step 8: Adding NOT NULL constraint...');
    await client.query(`
      ALTER TABLE attendance 
      ALTER COLUMN employee_id SET NOT NULL
    `);
    console.log('✓ NOT NULL constraint added\n');
    
    // Step 9: Add new foreign key constraint
    console.log('Step 9: Adding new foreign key constraint to employees.employee_id...');
    await client.query(`
      ALTER TABLE attendance 
      ADD CONSTRAINT attendance_employee_id_fkey 
      FOREIGN KEY (employee_id) 
      REFERENCES employees(employee_id) 
      ON DELETE CASCADE
    `);
    console.log('✓ New foreign key constraint added\n');
    
    // Step 10: Recreate unique constraint
    console.log('Step 10: Recreating unique constraint...');
    await client.query(`
      ALTER TABLE attendance 
      ADD CONSTRAINT attendance_employee_id_attendance_date_key 
      UNIQUE (employee_id, attendance_date)
    `);
    console.log('✓ Unique constraint recreated\n');
    
    // Step 11: Recreate index
    console.log('Step 11: Recreating index...');
    await client.query(`
      DROP INDEX IF EXISTS idx_attendance_employee
    `);
    await client.query(`
      CREATE INDEX idx_attendance_employee ON attendance(employee_id)
    `);
    console.log('✓ Index recreated\n');
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Display summary
    console.log('\n========================================');
    console.log('MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('========================================\n');
    
    // Show sample of migrated data
    console.log('Sample of migrated data:');
    const sampleResult = await client.query(`
      SELECT a.id, a.employee_id, a.attendance_date, a.attendance_status
      FROM attendance a
      ORDER BY a.attendance_date DESC
      LIMIT 5
    `);
    
    console.table(sampleResult.rows);
    
    console.log('\n✓ Attendance table now uses employee codes (MTM-01, MTM-02, etc.)');
    console.log('✓ All foreign key constraints updated');
    console.log('✓ All indexes recreated');
    console.log('\nNext steps:');
    console.log('1. Update application code to use employee_id (VARCHAR) instead of id (INTEGER)');
    console.log('2. Test all attendance operations');
    console.log('3. Verify reports and exports\n');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\n❌ MIGRATION FAILED!');
    console.error('Error:', error.message);
    console.error('\nTransaction has been rolled back. No changes were made.\n');
    throw error;
  } finally {
    client.release();
  }
}

// Also migrate WFH and Early Checkout permissions tables
async function migratePermissionsTables() {
  const client = await pool.connect();
  
  try {
    console.log('\n========================================');
    console.log('MIGRATING PERMISSIONS TABLES');
    console.log('========================================\n');
    
    await client.query('BEGIN');
    
    // Migrate WFH Permissions
    console.log('Migrating wfh_permissions table...');
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50)
    `);
    
    await client.query(`
      UPDATE wfh_permissions w
      SET employee_code = e.employee_id
      FROM employees e
      WHERE w.employee_id = e.id
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      DROP CONSTRAINT IF EXISTS wfh_permissions_employee_id_fkey
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      DROP CONSTRAINT IF EXISTS wfh_permissions_employee_id_key
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      DROP COLUMN employee_id
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      RENAME COLUMN employee_code TO employee_id
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      ALTER COLUMN employee_id SET NOT NULL
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      ADD CONSTRAINT wfh_permissions_employee_id_fkey 
      FOREIGN KEY (employee_id) 
      REFERENCES employees(employee_id) 
      ON DELETE CASCADE
    `);
    
    await client.query(`
      ALTER TABLE wfh_permissions 
      ADD CONSTRAINT wfh_permissions_employee_id_key 
      UNIQUE (employee_id)
    `);
    
    await client.query(`
      DROP INDEX IF EXISTS idx_wfh_permissions_employee
    `);
    
    await client.query(`
      CREATE INDEX idx_wfh_permissions_employee ON wfh_permissions(employee_id)
    `);
    
    console.log('✓ wfh_permissions migrated\n');
    
    // Migrate Early Checkout Permissions
    console.log('Migrating early_checkout_permissions table...');
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50)
    `);
    
    await client.query(`
      UPDATE early_checkout_permissions ec
      SET employee_code = e.employee_id
      FROM employees e
      WHERE ec.employee_id = e.id
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      DROP CONSTRAINT IF EXISTS early_checkout_permissions_employee_id_fkey
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      DROP CONSTRAINT IF EXISTS early_checkout_permissions_employee_id_key
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      DROP COLUMN employee_id
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      RENAME COLUMN employee_code TO employee_id
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      ALTER COLUMN employee_id SET NOT NULL
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      ADD CONSTRAINT early_checkout_permissions_employee_id_fkey 
      FOREIGN KEY (employee_id) 
      REFERENCES employees(employee_id) 
      ON DELETE CASCADE
    `);
    
    await client.query(`
      ALTER TABLE early_checkout_permissions 
      ADD CONSTRAINT early_checkout_permissions_employee_id_key 
      UNIQUE (employee_id)
    `);
    
    await client.query(`
      DROP INDEX IF EXISTS idx_early_checkout_permissions_employee
    `);
    
    await client.query(`
      CREATE INDEX idx_early_checkout_permissions_employee ON early_checkout_permissions(employee_id)
    `);
    
    console.log('✓ early_checkout_permissions migrated\n');
    
    await client.query('COMMIT');
    
    console.log('✓ All permissions tables migrated successfully!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Permissions tables migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
async function runMigration() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   ATTENDANCE SYSTEM DATABASE MIGRATION                ║');
    console.log('║   Migrating from Database ID to Employee Code         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // Migrate attendance table
    await migrateAttendanceTable();
    
    // Migrate permissions tables
    await migratePermissionsTables();
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   ALL MIGRATIONS COMPLETED SUCCESSFULLY!              ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\nMigration aborted due to errors.\n');
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateAttendanceTable, migratePermissionsTables };
