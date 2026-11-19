const pool = require('../config/database');
const svc = require('../services/scanAttendanceService');
const { getClientIP } = require('../services/networkValidationService');
const { sendEmail } = require('../services/emailService');
const { logAdminActivity } = require('../services/adminActivityService');
const { getBrandingSettings } = require('../utils/brandingSettingsHelper');
const { isHrRole } = require('../middleware/auth');

const { ScanError } = svc;

/* ---------------------------------------------------------------- */
/* helpers                                                           */
/* ---------------------------------------------------------------- */

const actorFromReq = (req) => {
  const u = req.user || {};
  const superAdmin = u.is_super_admin === true || u.emergency_admin === true;
  return {
    adminId: u.id,
    name: u.username || u.name || 'Admin',
    email: u.email || '',
    role: u.role,
    roleLabel: isHrRole(u) ? 'HR' : (superAdmin ? 'Super Admin' : 'Admin')
  };
};

const sendError = (res, err, fallback = 'Server error') => {
  if (err instanceof ScanError) {
    return res.status(err.status || 400).json({ success: false, code: err.code, message: err.message, ...(err.extra || {}) });
  }
  console.error('[SmartAttendance]', err);
  return res.status(500).json({ success: false, message: fallback });
};

const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

const loadEmployee = async (employeeId) => {
  const r = await pool.query(
    `SELECT e.employee_id, e.name, e.email, e.personal_email, e.job_role, e.status, d.name AS department_name
     FROM employees e LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.employee_id = $1`,
    [employeeId]
  );
  return r.rows[0] || null;
};

/* ---------------------------------------------------------------- */
/* Scanning                                                          */
/* ---------------------------------------------------------------- */

const hrScan = async (req, res) => {
  try {
    const { method, code, descriptor } = req.body || {};
    const result = await svc.performScan({
      method,
      code,
      descriptor,
      source: 'hr_mobile',
      actor: actorFromReq(req),
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Scan failed. Please try again.');
  }
};

const kioskAuth = async (req, res, next) => {
  try {
    const key = req.headers['x-kiosk-key'];
    const kiosk = await svc.findKioskByKey(key);
    if (!kiosk) {
      return res.status(401).json({ success: false, code: 'KIOSK_KEY_INVALID', message: 'This kiosk is not registered or has been disabled. Ask an admin for a new kiosk key.' });
    }
    req.kiosk = kiosk;
    next();
  } catch (err) {
    sendError(res, err);
  }
};

const kioskSession = async (req, res) => {
  res.json({ success: true, kiosk: { id: req.kiosk.id, name: req.kiosk.name, mode: req.kiosk.mode } });
};

const kioskScan = async (req, res) => {
  try {
    const { method, code, descriptor } = req.body || {};
    const result = await svc.performScan({
      method,
      code,
      descriptor,
      source: 'kiosk',
      kiosk: req.kiosk,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Scan failed. Please try again.');
  }
};

const hrSession = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const date = svc.todayIST();
    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'success' AND action = 'check_in') AS check_ins,
         COUNT(*) FILTER (WHERE status = 'success' AND action = 'check_out') AS check_outs,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
       FROM attendance_scan_logs WHERE attendance_date = $1 AND scanned_by_admin_id = $2`,
      [date, Number.isInteger(Number(req.user.id)) ? Number(req.user.id) : null]
    );
    res.json({
      success: true,
      user: { id: req.user.id, username: req.user.username, role: req.user.role },
      date,
      stats: stats.rows[0]
    });
  } catch (err) {
    sendError(res, err);
  }
};

const getScanLogs = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const date = isValidDate(req.query.date) ? req.query.date : svc.todayIST();
    const params = [date];
    let where = 'l.attendance_date = $1';
    if (req.query.employee_id) {
      params.push(String(req.query.employee_id));
      where += ` AND l.employee_id = $${params.length}`;
    }
    if (['success', 'rejected', 'duplicate'].includes(req.query.status)) {
      params.push(req.query.status);
      where += ` AND l.status = $${params.length}`;
    }
    // HR accounts only see their own scans
    if (isHrRole(req.user) || req.query.mine === 'true') {
      params.push(Number.isInteger(Number(req.user.id)) ? Number(req.user.id) : null);
      where += ` AND l.scanned_by_admin_id = $${params.length}`;
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const result = await pool.query(
      `SELECT l.*, to_char((l.created_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_ist FROM attendance_scan_logs l WHERE ${where} ORDER BY l.created_at DESC LIMIT ${limit}`,
      params
    );
    res.json({ success: true, date, logs: result.rows });
  } catch (err) {
    sendError(res, err);
  }
};

const getScanStats = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const date = isValidDate(req.query.date) ? req.query.date : svc.todayIST();
    const scans = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'success' AND action = 'check_in') AS check_ins,
         COUNT(*) FILTER (WHERE status = 'success' AND action = 'check_out') AS check_outs,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
         COUNT(*) FILTER (WHERE status = 'success' AND method = 'face') AS face_scans,
         COUNT(*) FILTER (WHERE status = 'success' AND method <> 'face') AS card_scans
       FROM attendance_scan_logs WHERE attendance_date = $1`,
      [date]
    );
    const coverage = await pool.query(
      `SELECT
         COUNT(*) AS active_employees,
         COUNT(f.employee_id) AS faces_registered,
         COUNT(b.employee_id) AS badges_generated
       FROM employees e
       LEFT JOIN employee_face_profiles f ON f.employee_id = e.employee_id
       LEFT JOIN employee_scan_badges b ON b.employee_id = e.employee_id
       WHERE e.status = 'Active'`
    );
    res.json({ success: true, date, scans: scans.rows[0], coverage: coverage.rows[0] });
  } catch (err) {
    sendError(res, err);
  }
};

/* ---------------------------------------------------------------- */
/* Employees, faces                                                  */
/* ---------------------------------------------------------------- */

const listEmployees = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const date = svc.todayIST();
    const params = [date];
    let where = `e.status = 'Active'`;
    if (req.query.include_inactive === 'true' && !isHrRole(req.user)) where = '1=1';
    if (req.query.search) {
      params.push(`%${String(req.query.search).trim()}%`);
      where += ` AND (e.name ILIKE $${params.length} OR e.employee_id ILIKE $${params.length} OR e.email ILIKE $${params.length})`;
    }
    const hr = isHrRole(req.user);
    const result = await pool.query(
      `SELECT e.employee_id, e.name, e.status, e.job_role, d.name AS department_name,
              ${hr ? '' : 'e.email, e.personal_email, b.badge_code, b.last_emailed_at, b.email_count,'}
              (f.employee_id IS NOT NULL) AS face_registered, f.updated_at AS face_updated_at, f.source AS face_source,
              a.login_time, a.logout_time, a.attendance_status
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN employee_face_profiles f ON f.employee_id = e.employee_id
       LEFT JOIN employee_scan_badges b ON b.employee_id = e.employee_id
       LEFT JOIN attendance a ON a.employee_id = e.employee_id AND a.attendance_date = $1
       WHERE ${where}
       ORDER BY e.name ASC`,
      params
    );
    const employees = result.rows.map((r) => ({
      ...r,
      login_time: svc.toLocalTimestampString(r.login_time),
      logout_time: svc.toLocalTimestampString(r.logout_time),
      login_label: svc.toTimeLabel(svc.toLocalTimestampString(r.login_time)),
      logout_label: svc.toTimeLabel(svc.toLocalTimestampString(r.logout_time))
    }));
    res.json({ success: true, date, employees });
  } catch (err) {
    sendError(res, err);
  }
};

const getFacePhoto = async (req, res) => {
  try {
    const photo = await svc.getFacePhoto(req.params.employeeId);
    res.json({ success: true, photo });
  } catch (err) {
    sendError(res, err);
  }
};

const enrollFace = async (req, res) => {
  try {
    const { descriptors, photo, source } = req.body || {};
    const profile = await svc.saveFaceProfile({
      employeeId: req.params.employeeId,
      descriptors,
      photoData: photo,
      source,
      actor: actorFromReq(req)
    });
    res.json({ success: true, message: `Face registered for ${profile.employee_name}`, profile });
  } catch (err) {
    sendError(res, err, 'Could not save face');
  }
};

const removeFace = async (req, res) => {
  try {
    const removed = await svc.deleteFaceProfile(req.params.employeeId, actorFromReq(req));
    res.json({ success: true, removed });
  } catch (err) {
    sendError(res, err);
  }
};

/* ---------------------------------------------------------------- */
/* Corrections & notes                                               */
/* ---------------------------------------------------------------- */

const getAttendanceForCorrection = async (req, res) => {
  try {
    const date = isValidDate(req.query.date) ? req.query.date : svc.todayIST();
    const data = await svc.getAttendanceWithNotes(req.params.employeeId, date);
    res.json({ success: true, date, ...data });
  } catch (err) {
    sendError(res, err);
  }
};

const createCorrection = async (req, res) => {
  try {
    const { employee_id, attendance_date, login_time, logout_time, clear_logout, note, category } = req.body || {};
    if (!employee_id) throw new ScanError('Employee is required', 'EMPLOYEE_REQUIRED');
    const result = await svc.correctAttendance({
      employeeId: String(employee_id),
      date: attendance_date,
      loginTime: login_time,
      logoutTime: logout_time,
      clearLogout: clear_logout === true,
      note,
      category,
      actor: actorFromReq(req)
    });
    res.json({ success: true, message: result.note.change_type === 'correction' ? 'Attendance corrected and note saved' : 'Note saved', ...result });
  } catch (err) {
    sendError(res, err, 'Could not save correction');
  }
};

const listNotes = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const to = isValidDate(req.query.to) ? req.query.to : svc.todayIST();
    const from = isValidDate(req.query.from) ? req.query.from : to;
    const params = [from, to];
    let where = 'n.attendance_date BETWEEN $1 AND $2';
    if (req.query.employee_id) {
      params.push(String(req.query.employee_id));
      where += ` AND n.employee_id = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT n.*, e.name AS employee_name, to_char((n.created_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_ist FROM attendance_notes n
       LEFT JOIN employees e ON e.employee_id = n.employee_id
       WHERE ${where} ORDER BY n.created_at DESC LIMIT 500`,
      params
    );
    res.json({ success: true, from, to, notes: result.rows });
  } catch (err) {
    sendError(res, err);
  }
};

/* ---------------------------------------------------------------- */
/* Badges (QR + barcode) & email                                     */
/* ---------------------------------------------------------------- */

const buildBadgeResponse = async (employee, badge) => {
  const { qrPng, barcodePng } = await svc.renderBadgeImages(badge.badge_code);
  return {
    employee,
    badge_code: badge.badge_code,
    payload: svc.badgePayload(badge.badge_code),
    last_emailed_at: badge.last_emailed_at,
    email_count: badge.email_count,
    qr: `data:image/png;base64,${qrPng.toString('base64')}`,
    barcode: `data:image/png;base64,${barcodePng.toString('base64')}`
  };
};

const getBadge = async (req, res) => {
  try {
    const employee = await loadEmployee(req.params.employeeId);
    if (!employee) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const badge = await svc.getOrCreateBadge(employee.employee_id);
    res.json({ success: true, ...(await buildBadgeResponse(employee, badge)) });
  } catch (err) {
    sendError(res, err, 'Could not generate badge');
  }
};

const generateAllBadges = async (req, res) => {
  try {
    const created = await svc.ensureBadgesForAllEmployees();
    res.json({ success: true, created, message: created > 0 ? `Generated QR codes for ${created} employee(s)` : 'All employees already have QR codes' });
  } catch (err) {
    sendError(res, err);
  }
};

const regenerateBadge = async (req, res) => {
  try {
    const employee = await loadEmployee(req.params.employeeId);
    if (!employee) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const badge = await svc.regenerateBadge(employee.employee_id);
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId,
      adminName: actor.name,
      adminEmail: actor.email,
      actionType: 'BADGE_REGENERATE',
      moduleName: 'Smart Attendance',
      description: `Regenerated attendance QR/barcode for ${employee.employee_id} (${employee.name}). The old card no longer works.`
    });
    res.json({ success: true, message: 'New QR code generated. The old card will no longer work.', ...(await buildBadgeResponse(employee, badge)) });
  } catch (err) {
    sendError(res, err);
  }
};

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const emailBadgeToEmployee = async (employee, badge, target = 'official') => {
  const recipients = [];
  if ((target === 'official' || target === 'both') && employee.email) recipients.push(employee.email);
  if ((target === 'personal' || target === 'both') && employee.personal_email) recipients.push(employee.personal_email);
  if (target === 'personal' && recipients.length === 0 && employee.email) recipients.push(employee.email);
  if (recipients.length === 0) throw new ScanError(`${employee.name} has no email address on file`, 'NO_EMAIL');

  let companyName = process.env.MAIL_FROM_NAME || 'Attendance';
  try {
    const branding = await getBrandingSettings();
    if (branding?.company_name) companyName = branding.company_name;
  } catch (_) { /* fall back to MAIL_FROM_NAME */ }

  const { qrPng, barcodePng } = await svc.renderBadgeImages(badge.badge_code, { scale: 6 });
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="margin:0 0 8px">Your Attendance QR Code</h2>
    <p style="margin:0 0 16px;color:#475569">Hello ${escapeHtml(employee.name)},</p>
    <p style="margin:0 0 16px;color:#475569">
      This is your personal attendance code for <b>${escapeHtml(companyName)}</b>. Show it at the entrance scanner
      (or to HR) when you <b>arrive</b> and again when you <b>leave</b>. Your first scan of the day is your check-in;
      the next scan is your check-out.
    </p>
    <div style="border:1px solid #e2e8f0;border-radius:16px;padding:20px;text-align:center">
      <div style="font-size:18px;font-weight:bold">${escapeHtml(employee.name)}</div>
      <div style="color:#64748b;margin-bottom:12px">${escapeHtml(employee.employee_id)}${employee.department_name ? ` · ${escapeHtml(employee.department_name)}` : ''}</div>
      <img src="cid:attendance-qr" alt="QR code" width="220" height="220" style="display:block;margin:0 auto" />
      <img src="cid:attendance-barcode" alt="Barcode" style="display:block;margin:12px auto 0;max-width:100%" />
    </div>
    <p style="margin:16px 0 0;color:#64748b;font-size:12px">
      Keep this code private. If you lose your card or think someone else has your code, contact HR to issue a new one —
      the old code stops working immediately. If your face photo is not registered yet, please contact HR to upload or scan your photo.
    </p>
  </div>`;

  const attachments = [
    { filename: `${employee.employee_id}-qr.png`, content: qrPng, cid: 'attendance-qr', contentType: 'image/png' },
    { filename: `${employee.employee_id}-barcode.png`, content: barcodePng, cid: 'attendance-barcode', contentType: 'image/png' }
  ];

  for (const to of recipients) {
    await sendEmail({
      toEmail: to,
      toName: employee.name,
      subject: `Your Attendance QR Code – ${companyName}`,
      html,
      text: `Hello ${employee.name}, your attendance QR code is attached. Scan it when you arrive and when you leave. Badge code: ${badge.badge_code}`,
      attachments
    });
  }
  await pool.query(
    `UPDATE employee_scan_badges SET last_emailed_at = CURRENT_TIMESTAMP, email_count = COALESCE(email_count,0) + 1 WHERE employee_id = $1`,
    [employee.employee_id]
  );
  return recipients;
};

const emailBadge = async (req, res) => {
  try {
    const employee = await loadEmployee(req.params.employeeId);
    if (!employee) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const badge = await svc.getOrCreateBadge(employee.employee_id);
    const target = ['official', 'personal', 'both'].includes(req.body?.target) ? req.body.target : 'official';
    const recipients = await emailBadgeToEmployee(employee, badge, target);
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId,
      adminName: actor.name,
      adminEmail: actor.email,
      actionType: 'BADGE_EMAIL',
      moduleName: 'Smart Attendance',
      description: `Emailed attendance QR to ${employee.employee_id} (${employee.name})`
    });
    res.json({ success: true, message: `QR code sent to ${recipients.join(', ')}`, recipients });
  } catch (err) {
    if (!(err instanceof ScanError)) {
      console.error('[SmartAttendance] email badge failed:', err);
      return res.status(502).json({ success: false, message: `Email could not be sent: ${err.message}` });
    }
    sendError(res, err);
  }
};

// In-memory status for the "email all" background job (single server instance)
let bulkEmailJob = { running: false, total: 0, sent: 0, failed: 0, errors: [], startedAt: null, finishedAt: null };

const emailAllBadges = async (req, res) => {
  try {
    if (bulkEmailJob.running) {
      return res.status(409).json({ success: false, message: 'Bulk email is already running', job: bulkEmailJob });
    }
    await svc.ensureBadgesForAllEmployees();
    const onlyNotSent = req.body?.only_not_sent === true;
    const target = ['official', 'personal', 'both'].includes(req.body?.target) ? req.body.target : 'official';
    const result = await pool.query(
      `SELECT e.employee_id, e.name, e.email, e.personal_email, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       JOIN employee_scan_badges b ON b.employee_id = e.employee_id
       WHERE e.status = 'Active' ${onlyNotSent ? 'AND b.last_emailed_at IS NULL' : ''}
       ORDER BY e.name`
    );
    const employees = result.rows;
    bulkEmailJob = { running: true, total: employees.length, sent: 0, failed: 0, errors: [], startedAt: new Date().toISOString(), finishedAt: null };
    const actor = actorFromReq(req);

    res.json({ success: true, message: `Sending QR codes to ${employees.length} employee(s)…`, job: bulkEmailJob });

    (async () => {
      for (const emp of employees) {
        try {
          const badge = await svc.getOrCreateBadge(emp.employee_id);
          await emailBadgeToEmployee(emp, badge, target);
          bulkEmailJob.sent += 1;
        } catch (e) {
          bulkEmailJob.failed += 1;
          if (bulkEmailJob.errors.length < 50) bulkEmailJob.errors.push({ employee_id: emp.employee_id, name: emp.name, error: e.message });
        }
      }
      bulkEmailJob.running = false;
      bulkEmailJob.finishedAt = new Date().toISOString();
      await logAdminActivity({
        adminId: actor.adminId,
        adminName: actor.name,
        adminEmail: actor.email,
        actionType: 'BADGE_EMAIL_ALL',
        moduleName: 'Smart Attendance',
        description: `Emailed attendance QR codes to all employees. Sent: ${bulkEmailJob.sent}, Failed: ${bulkEmailJob.failed}`
      });
    })().catch((e) => {
      bulkEmailJob.running = false;
      bulkEmailJob.finishedAt = new Date().toISOString();
      console.error('[SmartAttendance] bulk email crashed:', e);
    });
  } catch (err) {
    sendError(res, err);
  }
};

const emailAllStatus = async (req, res) => res.json({ success: true, job: bulkEmailJob });

/* ---------------------------------------------------------------- */
/* Kiosks & settings                                                 */
/* ---------------------------------------------------------------- */

const listKiosks = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const r = await pool.query('SELECT id, name, mode, key_hint, is_active, last_seen_at, created_at FROM scan_kiosk_devices ORDER BY created_at DESC');
    res.json({ success: true, kiosks: r.rows });
  } catch (err) {
    sendError(res, err);
  }
};

const createKiosk = async (req, res) => {
  try {
    const kiosk = await svc.createKiosk({ name: req.body?.name, mode: req.body?.mode, actor: actorFromReq(req) });
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId,
      adminName: actor.name,
      adminEmail: actor.email,
      actionType: 'KIOSK_CREATE',
      moduleName: 'Smart Attendance',
      description: `Registered scan kiosk "${kiosk.name}" (${kiosk.mode})`
    });
    res.json({ success: true, message: 'Kiosk registered. Copy the key now – it will not be shown again.', kiosk });
  } catch (err) {
    sendError(res, err);
  }
};

const updateKiosk = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const { name, mode, is_active } = req.body || {};
    const r = await pool.query(
      `UPDATE scan_kiosk_devices SET
         name = COALESCE($1, name),
         mode = COALESCE($2, mode),
         is_active = COALESCE($3, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING id, name, mode, key_hint, is_active, last_seen_at, created_at`,
      [
        name ? String(name).trim().slice(0, 100) : null,
        ['card', 'face', 'both'].includes(mode) ? mode : null,
        typeof is_active === 'boolean' ? is_active : null,
        parseInt(req.params.id, 10)
      ]
    );
    if (!r.rows[0]) throw new ScanError('Kiosk not found', 'NOT_FOUND', 404);
    res.json({ success: true, kiosk: r.rows[0] });
  } catch (err) {
    sendError(res, err);
  }
};

const deleteKiosk = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const r = await pool.query('DELETE FROM scan_kiosk_devices WHERE id = $1 RETURNING name', [parseInt(req.params.id, 10)]);
    if (!r.rows[0]) throw new ScanError('Kiosk not found', 'NOT_FOUND', 404);
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
};

const getSettings = async (req, res) => {
  try {
    res.json({ success: true, settings: await svc.getScanSettings() });
  } catch (err) {
    sendError(res, err);
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await svc.updateScanSettings(req.body || {});
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId,
      adminName: actor.name,
      adminEmail: actor.email,
      actionType: 'SETTINGS_UPDATE',
      moduleName: 'Smart Attendance',
      description: 'Updated smart attendance scan settings',
      newData: settings
    });
    res.json({ success: true, settings });
  } catch (err) {
    sendError(res, err);
  }
};

/* ---------------------------------------------------------------- */
/* Employee self-service                                             */
/* ---------------------------------------------------------------- */

const myStatus = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const employeeId = req.user.employee_id || req.user.employeeId;
    const emp = await pool.query('SELECT employee_id FROM employees WHERE employee_id = $1 OR id::text = $2', [employeeId || '', String(req.user.id || '')]);
    const code = emp.rows[0]?.employee_id;
    if (!code) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const face = await pool.query('SELECT updated_at FROM employee_face_profiles WHERE employee_id = $1', [code]);
    res.json({ success: true, employee_id: code, face_registered: face.rows.length > 0, face_updated_at: face.rows[0]?.updated_at || null });
  } catch (err) {
    sendError(res, err);
  }
};

const myBadge = async (req, res) => {
  try {
    const employeeId = req.user.employee_id || req.user.employeeId;
    const emp = await pool.query('SELECT employee_id FROM employees WHERE employee_id = $1 OR id::text = $2', [employeeId || '', String(req.user.id || '')]);
    const code = emp.rows[0]?.employee_id;
    if (!code) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const employee = await loadEmployee(code);
    const badge = await svc.getOrCreateBadge(code);
    const data = await buildBadgeResponse({ employee_id: employee.employee_id, name: employee.name, department_name: employee.department_name }, badge);
    res.json({ success: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
};

module.exports = {
  hrScan,
  hrSession,
  kioskAuth,
  kioskSession,
  kioskScan,
  getScanLogs,
  getScanStats,
  listEmployees,
  getFacePhoto,
  enrollFace,
  removeFace,
  getAttendanceForCorrection,
  createCorrection,
  listNotes,
  getBadge,
  generateAllBadges,
  regenerateBadge,
  emailBadge,
  emailAllBadges,
  emailAllStatus,
  listKiosks,
  createKiosk,
  updateKiosk,
  deleteKiosk,
  getSettings,
  updateSettings,
  myStatus,
  myBadge
};
