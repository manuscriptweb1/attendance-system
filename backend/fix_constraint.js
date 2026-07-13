const pool = require('./config/database');
const fixConstraint = async () => {
  try {
    await pool.query(`ALTER TABLE trusted_devices DROP CONSTRAINT trusted_devices_approved_status_check;`);
    await pool.query(`ALTER TABLE trusted_devices ADD CONSTRAINT trusted_devices_approved_status_check CHECK (approved_status IN ('Pending', 'Approved', 'Rejected', 'Blocked'));`);
    console.log("Constraint updated successfully");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};
fixConstraint();
