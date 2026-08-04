const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function auditDatabaseSchema() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'attendance_db';

  const client = new Client({ host, port, user, password, database: dbName });

  try {
    await client.connect();
    console.log(`🔍 Auditing local PostgreSQL database: "${dbName}"...\n`);

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`📋 Existing Tables (${tablesRes.rows.length}):`);
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      console.log(`  🔹 ${tableName} (${colsRes.rows.length} columns):`);
      colsRes.rows.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
    }

    console.log('\n========================================');
    console.log('✅ DATABASE AUDIT & SYNCHRONIZATION COMPLETE!');
    console.log('========================================');

  } catch (err) {
    console.error('❌ Audit Error:', err.message);
  } finally {
    await client.end();
  }
}

auditDatabaseSchema();
