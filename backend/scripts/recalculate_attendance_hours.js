/**
 * Recalculate Attendance Hours Script
 * 
 * Safely recalculates total_working_hours, total_hours, and total_minutes
 * for attendance records using the updated minute-precision calculation.
 * 
 * Usage:
 *   node backend/scripts/recalculate_attendance_hours.js --dry-run
 *   node backend/scripts/recalculate_attendance_hours.js --apply
 *   node backend/scripts/recalculate_attendance_hours.js --from 2026-10-01 --apply
 */

require('dotenv').config({ path: __dirname + '/../.env' });
process.env.TZ = 'Asia/Kolkata';

const pool = require('../config/database');
const { calculateWorkedMinutes, getOfficeTimes } = require('../utils/timeUtils');
const { getSettingsFromDB } = require('../utils/settingsHelper');

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply || args.includes('--dry-run');

  const fromIndex = args.indexOf('--from');
  const fromDate = fromIndex !== -1 && args[fromIndex + 1] ? args[fromIndex + 1] : '2026-10-01';

  const toIndex = args.indexOf('--to');
  const toDate = toIndex !== -1 && args[toIndex + 1] ? args[toIndex + 1] : null;

  console.log(`\n======================================================`);
  console.log(` Attendance Hours Recalculation Tool`);
  console.log(` Mode: ${isApply ? '🚀 APPLY CHANGES' : '🔍 DRY RUN (No database updates)'}`);
  console.log(` Date range: from ${fromDate} ${toDate ? 'to ' + toDate : 'onwards'}`);
  console.log(`======================================================\n`);

  const settings = await getSettingsFromDB();
  const officeTimes = getOfficeTimes(settings);
  const officeStartTimeMins = officeTimes.startTime || 540; // Default 09:00 AM

  let query = `
    SELECT a.id, a.employee_id, e.name, a.attendance_date, a.login_time, a.logout_time,
           a.total_working_hours, a.total_hours, a.total_minutes
    FROM attendance a
    JOIN employees e ON a.employee_id = e.employee_id
    WHERE a.login_time IS NOT NULL 
      AND a.logout_time IS NOT NULL
      AND a.attendance_date >= $1
  `;
  const params = [fromDate];

  if (toDate) {
    query += ` AND a.attendance_date <= $2`;
    params.push(toDate);
  }

  query += ` ORDER BY a.attendance_date ASC, e.name ASC`;

  const client = await pool.connect();

  try {
    const { rows } = await client.query(query, params);
    console.log(`Found ${rows.length} completed attendance records in date range.\n`);

    const updates = [];

    for (const r of rows) {
      const correctMinutes = calculateWorkedMinutes(r.login_time, r.logout_time, officeStartTimeMins);
      const correctHours = parseFloat((correctMinutes / 60).toFixed(2));

      const oldMins = Number(r.total_minutes || 0);
      const oldHours = Number(r.total_working_hours || 0);

      if (correctMinutes !== oldMins || Math.abs(correctHours - oldHours) > 0.001) {
        updates.push({
          id: r.id,
          employee_id: r.employee_id,
          name: r.name,
          date: r.attendance_date,
          old_mins: oldMins,
          new_mins: correctMinutes,
          old_hours: oldHours,
          new_hours: correctHours
        });
      }
    }

    console.log(`Identified ${updates.length} records requiring correction.`);

    if (updates.length > 0) {
      console.log(`\nSample records to be updated (up to 15):`);
      console.table(updates.slice(0, 15).map(u => ({
        ID: u.id,
        Date: typeof u.date === 'string' ? u.date : u.date.toISOString().split('T')[0],
        Name: u.name,
        'Old Mins': u.old_mins,
        'New Mins': u.new_mins,
        'Old Hrs': u.old_hours,
        'New Hrs': u.new_hours
      })));
    }

    if (isApply && updates.length > 0) {
      console.log(`\nApplying updates within transaction...`);
      await client.query('BEGIN');

      for (const u of updates) {
        await client.query(
          `UPDATE attendance 
           SET total_working_hours = $1,
               total_hours = $2,
               total_minutes = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [u.new_hours, u.new_hours, u.new_mins, u.id]
        );
      }

      await client.query('COMMIT');
      console.log(`✅ Successfully updated ${updates.length} attendance records in database!`);
    } else if (!isApply) {
      console.log(`\nℹ️ This was a DRY RUN. No changes were made to the database.`);
      console.log(`To apply these changes, run with: node backend/scripts/recalculate_attendance_hours.js --apply`);
    }

  } catch (err) {
    if (isApply) {
      await client.query('ROLLBACK');
      console.error(`❌ Error occurred during update. Changes rolled back.`, err);
    } else {
      console.error(`❌ Error occurred:`, err);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run();
