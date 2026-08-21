const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runSeed() {
  console.log('🔄 Seeding 10 Job Roles and Responsibilities templates into PostgreSQL...');
  
  const sqlPath = path.join(__dirname, 'seed_roles_responsibilities.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('✅ Successfully executed seed_roles_responsibilities.sql!');

    // Verify all rows
    const res = await client.query('SELECT id, job_role, jsonb_array_length(categories) as category_count FROM role_responsibility_templates ORDER BY id ASC');
    console.log('\n📋 Stored Templates in Database:');
    console.table(res.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error executing seed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runSeed();
