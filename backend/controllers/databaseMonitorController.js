const pool = require('../config/database');

const getDatabaseMonitorDetails = async (req, res) => {
  try {
    // 1. Get database size
    const dbSizeResult = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size, pg_database_size(current_database()) AS size_bytes`);
    const dbSizeStr = dbSizeResult.rows[0]?.size || '0 MB';
    const dbSizeBytes = parseInt(dbSizeResult.rows[0]?.size_bytes || 0, 10);

    // 2. Get total public tables
    const tableCountResult = await pool.query(`
      SELECT COUNT(*) AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    const tableCount = parseInt(tableCountResult.rows[0]?.table_count || 0, 10);

    // 3. Get all table sizes
    const tablesResult = await pool.query(`
      SELECT
        u.schemaname,
        u.relname AS table_name,
        u.n_live_tup AS estimated_rows,
        pg_size_pretty(pg_relation_size(u.relid)) AS table_size,
        pg_size_pretty(pg_indexes_size(u.relid)) AS index_size,
        pg_size_pretty(pg_total_relation_size(u.relid)) AS total_size_str,
        pg_total_relation_size(u.relid) AS total_size_bytes
      FROM pg_catalog.pg_statio_user_tables io
      JOIN pg_stat_user_tables u ON io.relid = u.relid
      WHERE u.schemaname = 'public'
      ORDER BY pg_total_relation_size(u.relid) DESC
    `);
    const tableStats = tablesResult.rows;

    // Build the specific row counts summary safely using a helper
    const getRowCount = async (tableName) => {
      try {
        const resCount = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        return parseInt(resCount.rows[0].count, 10);
      } catch (err) {
        return 0; // Table might not exist yet
      }
    };
    
    const getActiveEmployees = async () => {
      try {
        const resCount = await pool.query(`SELECT COUNT(*) FROM employees WHERE status = 'Active'`);
        return parseInt(resCount.rows[0].count, 10);
      } catch (err) {
        return 0;
      }
    };

    const summary = {
      employees: await getRowCount('employees'),
      activeEmployees: await getActiveEmployees(),
      attendanceRecords: await getRowCount('attendance'),
      manualAttendanceLogs: await getRowCount('manual_attendance_logs'),
      activityLogs: await getRowCount('admin_activity_logs'),
      securityLogs: await getRowCount('security_logs'),
      payrollRecords: await getRowCount('payroll_records'),
      expenseRecords: await getRowCount('expenses')
    };

    // Construct table response array
    const tables = tableStats.map(t => ({
      tableName: t.table_name,
      estimatedRows: parseInt(t.estimated_rows || 0, 10),
      tableSize: t.table_size,
      indexSize: t.index_size,
      totalSize: t.total_size_str,
      totalSizeBytes: parseInt(t.total_size_bytes || 0, 10)
    }));

    // Warnings
    const warnings = [];
    const sizeMb = dbSizeBytes / (1024 * 1024);
    
    if (sizeMb > 480) {
      warnings.push({ type: 'error', message: 'Database storage is near limit. Please clean old logs or upgrade plan.' });
    } else if (sizeMb > 400) {
      warnings.push({ type: 'warning', message: 'Database storage is getting high.' });
    } else {
      warnings.push({ type: 'info', message: 'Database storage is healthy.' });
    }

    // Large table warnings (e.g., table over 50MB)
    const largeTables = tables.filter(t => t.totalSizeBytes > 50 * 1024 * 1024);
    largeTables.forEach(t => {
      warnings.push({ type: 'warning', message: `${t.tableName} table is using high storage.` });
    });

    if (summary.activityLogs > 50000 || summary.securityLogs > 50000) {
      warnings.push({ type: 'warning', message: 'Consider clearing old logs using Clear Date Range.' });
    }

    // Index verification
    const indexesCheck = await pool.query(`
      SELECT t.relname AS table_name, a.attname AS column_name
      FROM pg_class t, pg_class i, pg_index ix, pg_attribute a
      WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
    `);
    
    const existingIndexMap = {};
    indexesCheck.rows.forEach(row => {
      if (!existingIndexMap[row.table_name]) {
        existingIndexMap[row.table_name] = new Set();
      }
      existingIndexMap[row.table_name].add(row.column_name);
    });

    const verifyIndex = (tableName, columnName) => {
      const tableCheck = tables.find(t => t.tableName === tableName);
      // Only warn if the table actually exists
      if (tableCheck) {
        const hasIndex = existingIndexMap[tableName] && existingIndexMap[tableName].has(columnName);
        if (!hasIndex) {
          warnings.push({ type: 'warning', message: `Missing index: ${tableName}(${columnName})` });
        }
      }
    };

    verifyIndex('attendance', 'employee_id');
    verifyIndex('attendance', 'attendance_date');
    verifyIndex('manual_attendance_logs', 'employee_id');
    verifyIndex('manual_attendance_logs', 'attendance_date');

    res.json({
      success: true,
      database: {
        size: dbSizeStr,
        sizeBytes: dbSizeBytes,
        tableCount: tableCount
      },
      summary,
      tables,
      warnings
    });
    
  } catch (error) {
    console.error('Database Monitor Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch database monitor data' });
  }
};

module.exports = {
  getDatabaseMonitorDetails
};
