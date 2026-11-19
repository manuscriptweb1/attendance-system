const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const svc = require('../services/scanAttendanceService');
const { getClientIP } = require('../services/networkValidationService');
const { sendEmail, verifyEmailConnection } = require('../services/emailService');
const { logAdminActivity } = require('../services/adminActivityService');
const { getBrandingSettings } = require('../utils/brandingSettingsHelper');
const { isHrRole } = require('../middleware/auth');
const { buildIdCardPdf, dataUrlToBuffer } = require('../utils/idCardPdfGenerator');

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
    const { descriptors, photo, card_photo: cardPhoto, source } = req.body || {};
    const profile = await svc.saveFaceProfile({
      employeeId: req.params.employeeId,
      descriptors,
      photoData: photo,
      cardPhotoData: cardPhoto,
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
  const [photo, settings] = await Promise.all([svc.getCardPhoto(employee.employee_id), svc.getScanSettings()]);
  return {
    employee,
    photo,
    card: { website: settings.cardWebsite, address: settings.cardAddress },
    badge_code: badge.badge_code,
    payload: svc.badgePayload(badge.badge_code),
    last_emailed_at: badge.last_emailed_at,
    email_count: badge.email_count,
    qr: `data:image/png;base64,${qrPng.toString('base64')}`,
    barcode: `data:image/png;base64,${barcodePng.toString('base64')}`
  };
};

/* ---------------------------------------------------------------- */
/* ID card PDF                                                       */
/* ---------------------------------------------------------------- */

/**
 * Load everything needed to draw ID cards.
 * @param {string[]|null} employeeIds null = all active employees
 */
const loadIdCards = async (employeeIds = null) => {
  await svc.ensureBadgesForAllEmployees();
  const settings = await svc.getScanSettings();
  const params = [];
  let where = `e.status = 'Active'`;
  if (Array.isArray(employeeIds)) {
    params.push(employeeIds.map(String));
    where = 'e.employee_id = ANY($1)';
  }
  const r = await pool.query(
    `SELECT e.employee_id, e.name, e.job_role, b.badge_code, COALESCE(f.card_photo, f.photo_data) AS photo
     FROM employees e
     JOIN employee_scan_badges b ON b.employee_id = e.employee_id
     LEFT JOIN employee_face_profiles f ON f.employee_id = e.employee_id
     WHERE ${where}
     ORDER BY e.name ASC`,
    params
  );
  const cards = [];
  for (const row of r.rows) {
    const { qrPng, barcodePng } = await svc.renderBadgeImages(row.badge_code, { scale: 8 });
    cards.push({
      employee: { employee_id: row.employee_id, name: row.name, job_role: row.job_role },
      photo: dataUrlToBuffer(row.photo),
      qrPng,
      barcodePng,
      website: settings.cardWebsite,
      address: settings.cardAddress
    });
  }
  return cards;
};

const safeFileName = (s) => String(s || 'id-card').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);

const sendPdf = (res, buffer, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(filename)}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
};

const pdfLayout = (v) => (v === 'a4' ? 'a4' : 'card');

const downloadIdCardPdf = async (req, res) => {
  try {
    const cards = await loadIdCards([req.params.employeeId]);
    if (cards.length === 0) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const pdf = await buildIdCardPdf(cards, { layout: pdfLayout(req.query.layout) });
    sendPdf(res, pdf, `${cards[0].employee.employee_id}-id-card.pdf`);
  } catch (err) {
    sendError(res, err, 'Could not create the ID card PDF');
  }
};

const downloadAllIdCardsPdf = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.employee_ids) && req.body.employee_ids.length > 0
      ? req.body.employee_ids.slice(0, 1000)
      : null;
    const cards = await loadIdCards(ids);
    if (cards.length === 0) throw new ScanError('No active employees to print', 'EMPTY');
    const layout = pdfLayout(req.body?.layout);
    const pdf = await buildIdCardPdf(cards, { layout });
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId, adminName: actor.name, adminEmail: actor.email,
      actionType: 'ID_CARD_EXPORT', moduleName: 'Smart Attendance',
      description: `Downloaded ${cards.length} employee ID card(s) as PDF (${layout === 'a4' ? 'A4 sheets' : 'card printer'})`
    });
    sendPdf(res, pdf, `employee-id-cards-${layout}-${svc.todayIST()}.pdf`);
  } catch (err) {
    sendError(res, err, 'Could not create the ID cards PDF');
  }
};

const myIdCardPdf = async (req, res) => {
  try {
    const employeeId = req.user.employee_id || req.user.employeeId;
    const emp = await pool.query('SELECT employee_id FROM employees WHERE employee_id = $1 OR id::text = $2', [employeeId || '', String(req.user.id || '')]);
    const code = emp.rows[0]?.employee_id;
    if (!code) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    const cards = await loadIdCards([code]);
    const pdf = await buildIdCardPdf(cards, { layout: 'card' });
    sendPdf(res, pdf, `${code}-id-card.pdf`);
  } catch (err) {
    sendError(res, err, 'Could not create your ID card PDF');
  }
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

/** Load company branding once per send (name, address, logo file) */
const loadBranding = async () => {
  const fallback = { company_name: 'Manuscript Technomedia LLP', registered_office_address: '', physical_logo_path: null };
  try {
    const b = await getBrandingSettings();
    return { ...fallback, ...(b || {}) };
  } catch (_) {
    return fallback;
  }
};

/** Professional, email-client-safe (table based, inline styles) QR badge email */
const buildBadgeEmailHtml = ({ employee, badge, companyName, address, hasLogo }) => {
  const e = escapeHtml;
  const dept = employee.department_name ? e(employee.department_name) : '';
  const step = (n, title, body) => `
    <tr>
      <td width="36" valign="top" style="padding:0 0 14px 0;">
        <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:#eef2ff;color:#4f46e5;font-weight:700;font-size:13px;text-align:center;">${n}</div>
      </td>
      <td valign="top" style="padding:3px 0 14px 8px;font-size:14px;line-height:20px;color:#334155;">
        <b style="color:#0f172a;">${title}</b><br/>${body}
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Your Employee ID Card</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your personal attendance QR code for ${e(companyName)} – scan it when you arrive and when you leave.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;background-image:linear-gradient(135deg,#1e293b 0%,#312e81 100%);padding:26px 32px;" align="left">
              ${hasLogo ? `<img src="cid:company-logo" alt="${e(companyName)}" height="40" style="display:block;height:40px;max-width:200px;margin-bottom:12px;border:0;background:#ffffff;border-radius:8px;padding:4px;" />` : ''}
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a5b4fc;font-weight:700;">${e(companyName)}</div>
              <div style="font-size:24px;line-height:30px;color:#ffffff;font-weight:700;margin-top:6px;">Your Employee ID Card</div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 32px 8px 32px;font-size:15px;line-height:23px;color:#334155;">
              Dear <b style="color:#0f172a;">${e(employee.name)}</b>,<br/><br/>
              Attendance at the office is now marked automatically. Below is your <b>personal attendance QR code</b>.
              Simply show it at the entrance scanner – no need to open the app.
            </td>
          </tr>

          <!-- ID card attachment -->
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;">
                <tr>
                  <td width="44" valign="middle" style="padding:12px 0 12px 14px;">
                    <div style="width:30px;height:38px;border-radius:4px;background:#dc2626;color:#ffffff;font-size:9px;font-weight:700;line-height:38px;text-align:center;">PDF</div>
                  </td>
                  <td valign="middle" style="padding:12px 14px;font-size:13px;line-height:19px;color:#3730a3;">
                    <b>Your employee ID card is attached</b> (${e(employee.employee_id)}-ID-Card.pdf) – front with your photo and
                    back with your attendance QR code. Save it on your phone or print it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Badge card -->
          <tr>
            <td align="center" style="padding:20px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:300px;max-width:100%;border:2px solid #e2e8f0;border-radius:18px;">
                <tr>
                  <td align="center" style="background:#4f46e5;border-radius:16px 16px 0 0;padding:12px 16px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                    Employee Attendance ID
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:18px 16px 4px 16px;">
                    <div style="font-size:19px;font-weight:700;color:#0f172a;">${e(employee.name)}</div>
                    <div style="font-size:13px;color:#64748b;margin-top:3px;">${e(employee.employee_id)}${dept ? ` &nbsp;•&nbsp; ${dept}` : ''}</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:14px 16px 6px 16px;">
                    <img src="cid:attendance-qr" alt="Attendance QR code" width="210" height="210" style="display:block;width:210px;height:210px;border:0;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:6px 20px 18px 20px;">
                    <img src="cid:attendance-barcode" alt="Attendance barcode" width="250" style="display:block;width:250px;max-width:100%;height:auto;border:0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- How to use -->
          <tr>
            <td style="padding:24px 32px 6px 32px;">
              <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:14px;">How to mark your attendance</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${step(1, 'When you arrive', 'Show this QR code (on your phone or printed ID card) to the entrance scanner or to HR. Your first scan of the day is your <b>check-in</b>.')}
                ${step(2, 'When you leave', 'Scan the same code again. Your next scan is your <b>check-out</b>.')}
                ${step(3, 'Face attendance', 'If your face photo is registered you can also just look at the face scanner. Not registered yet? Please contact HR to upload or scan your photo.')}
              </table>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding:8px 32px 26px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;line-height:20px;color:#9a3412;">
                    <b>Keep this code private.</b> It works only for you. If your card is lost or you think someone else has your code,
                    contact HR immediately – a new code will be issued and this one will stop working.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;font-size:12px;line-height:18px;color:#64748b;" align="center">
              Regards,<br/><b style="color:#334155;">HR Team, ${e(companyName)}</b>
              ${address ? `<br/><span style="color:#94a3b8;">${e(address)}</span>` : ''}
              <br/><br/><span style="color:#94a3b8;">This is an automated email from the attendance system. Please do not reply.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const emailBadgeToEmployee = async (employee, badge, target = 'official', brandingCache = null) => {
  const recipients = [];
  if ((target === 'official' || target === 'both') && employee.email) recipients.push(employee.email);
  if ((target === 'personal' || target === 'both') && employee.personal_email) recipients.push(employee.personal_email);
  if (target === 'personal' && recipients.length === 0 && employee.email) recipients.push(employee.email);
  if (recipients.length === 0) throw new ScanError(`${employee.name} has no email address on file`, 'NO_EMAIL');

  const branding = brandingCache || await loadBranding();
  const companyName = branding.company_name || process.env.MAIL_FROM_NAME || 'Attendance';
  const logoPath = branding.physical_logo_path && fs.existsSync(branding.physical_logo_path) ? branding.physical_logo_path : null;

  const { qrPng, barcodePng } = await svc.renderBadgeImages(badge.badge_code, { scale: 8 });
  const html = buildBadgeEmailHtml({
    employee,
    badge,
    companyName,
    address: branding.registered_office_address,
    hasLogo: !!logoPath
  });

  const attachments = [
    { filename: `${employee.employee_id}-attendance-qr.png`, content: qrPng, cid: 'attendance-qr', contentType: 'image/png' },
    { filename: `${employee.employee_id}-attendance-barcode.png`, content: barcodePng, cid: 'attendance-barcode', contentType: 'image/png' }
  ];
  if (logoPath) attachments.push({ filename: 'logo' + path.extname(logoPath), path: logoPath, cid: 'company-logo', contentDisposition: 'inline' });

  // The employee's ID card (front + back) as a PDF
  const idCards = await loadIdCards([employee.employee_id]);
  if (idCards.length > 0) {
    attachments.push({
      filename: `${employee.employee_id}-ID-Card.pdf`,
      content: await buildIdCardPdf(idCards, { layout: 'card' }),
      contentType: 'application/pdf'
    });
  }

  const text = [
    `Dear ${employee.name},`,
    '',
    `Your employee ID card (PDF) and personal attendance QR code for ${companyName} are attached (${employee.employee_id}).`,
    'Show it at the entrance scanner when you arrive (check-in) and again when you leave (check-out).',
    'If your face photo is not registered yet, please contact HR to upload or scan your photo.',
    'Keep this code private. If your card is lost, contact HR for a new code.',
    '',
    `Regards,`,
    `HR Team, ${companyName}`
  ].join('\n');

  // Uses the existing system email service (same Gmail SMTP sender as payslips and OTPs)
  for (const to of recipients) {
    await sendEmail({
      toEmail: to,
      toName: employee.name,
      subject: `Your Employee ID Card & Attendance QR – ${employee.name} (${employee.employee_id})`,
      html,
      text,
      attachments
    });
  }
  await pool.query(
    `UPDATE employee_scan_badges SET last_emailed_at = CURRENT_TIMESTAMP, email_count = COALESCE(email_count,0) + 1 WHERE employee_id = $1`,
    [employee.employee_id]
  );
  return recipients;
};

/** Gmail login / connection problems: stop instead of retrying every employee */
const isSmtpAuthOrConfigError = (err) => {
  const m = String(err?.message || '');
  return err?.code === 'EAUTH' || /Invalid login|Username and Password not accepted|535|SMTP configuration is missing|authentication failed/i.test(m);
};

const friendlySmtpError = (err) => {
  const m = String(err?.message || '');
  if (/SMTP configuration is missing/i.test(m)) {
    return 'Email is not configured on the server (SMTP_HOST / SMTP_USER / SMTP_PASSWORD are missing).';
  }
  if (isSmtpAuthOrConfigError(err)) {
    return 'Gmail rejected the login (535 Username and Password not accepted). On the server, SMTP_USER must be the full Gmail address and SMTP_PASSWORD must be a valid 16-character Google App Password (2-Step Verification on). This affects all system emails, including payslips and OTPs.';
  }
  return `Email could not be sent: ${m}`;
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
    res.json({ success: true, message: `ID card sent to ${recipients.join(', ')}`, recipients });
  } catch (err) {
    if (!(err instanceof ScanError)) {
      console.error('[SmartAttendance] email badge failed:', err.message);
      return res.status(502).json({ success: false, code: 'EMAIL_FAILED', message: friendlySmtpError(err) });
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
    if (employees.length === 0) {
      return res.json({ success: true, message: 'Nobody to email – every active employee has already received their ID card.', job: bulkEmailJob });
    }

    // Check the Gmail login once before sending to everyone
    try {
      await verifyEmailConnection();
    } catch (smtpErr) {
      return res.status(502).json({ success: false, code: 'EMAIL_NOT_READY', message: friendlySmtpError(smtpErr) });
    }

    bulkEmailJob = { running: true, total: employees.length, sent: 0, failed: 0, errors: [], stoppedReason: null, startedAt: new Date().toISOString(), finishedAt: null };
    const actor = actorFromReq(req);

    res.json({ success: true, message: `Sending ID cards to ${employees.length} employee(s)…`, job: bulkEmailJob });

    (async () => {
      const branding = await loadBranding();
      for (const emp of employees) {
        try {
          const badge = await svc.getOrCreateBadge(emp.employee_id);
          await emailBadgeToEmployee(emp, badge, target, branding);
          bulkEmailJob.sent += 1;
        } catch (e) {
          bulkEmailJob.failed += 1;
          if (bulkEmailJob.errors.length < 50) {
            bulkEmailJob.errors.push({ employee_id: emp.employee_id, name: emp.name, error: e instanceof ScanError ? e.message : friendlySmtpError(e) });
          }
          if (isSmtpAuthOrConfigError(e)) {
            // Repeated bad logins can get the Gmail account temporarily locked – stop now
            bulkEmailJob.stoppedReason = friendlySmtpError(e);
            break;
          }
        }
        // Gentle pacing so Gmail does not throttle the account
        await new Promise((r) => setTimeout(r, 800));
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
/* HR Scanner accounts (admins rows with role = 'hr')                */
/* ---------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const listHrAccounts = async (req, res) => {
  try {
    await svc.ensureScanTables();
    const r = await pool.query(
      `SELECT a.id, a.username, a.email, COALESCE(a.status, 'Active') AS status, a.created_at,
              (SELECT to_char((MAX(l.login_time) AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS')
                 FROM admin_login_logs l WHERE l.admin_id = a.id) AS last_login,
              (SELECT COUNT(*) FROM attendance_scan_logs s WHERE s.scanned_by_admin_id = a.id AND s.status = 'success') AS total_scans
       FROM admins a WHERE a.role = 'hr' ORDER BY a.created_at DESC`
    );
    res.json({ success: true, accounts: r.rows });
  } catch (err) {
    sendError(res, err);
  }
};

const createHrAccount = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[A-Za-z0-9._@-]{3,60}$/.test(username)) throw new ScanError('Username must be 3–60 characters (letters, numbers, . _ - @)', 'INVALID_USERNAME');
    if (!EMAIL_RE.test(email)) throw new ScanError('Enter a valid email address', 'INVALID_EMAIL');
    if (password.length < 6) throw new ScanError('Password must be at least 6 characters', 'WEAK_PASSWORD');

    const dup = await pool.query('SELECT username FROM admins WHERE LOWER(username) = LOWER($1) OR LOWER(email) = $2', [username, email]);
    if (dup.rows.length > 0) {
      const taken = dup.rows.some((d) => d.username.toLowerCase() === username.toLowerCase()) ? 'Username' : 'Email';
      throw new ScanError(`${taken} already exists`, 'DUPLICATE', 409);
    }

    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO admins (username, email, password, role, is_super_admin, status)
       VALUES ($1, $2, $3, 'hr', false, 'Active') RETURNING id, username, email, status, created_at`,
      [username, email, hash]
    );
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId, adminName: actor.name, adminEmail: actor.email,
      actionType: 'HR_ACCOUNT_CREATE', moduleName: 'Smart Attendance',
      description: `Created HR Scanner account "${username}" (${email})`
    });
    res.json({ success: true, message: `HR Scanner account "${username}" created`, account: r.rows[0] });
  } catch (err) {
    sendError(res, err);
  }
};

const updateHrAccount = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await pool.query(`SELECT id, username FROM admins WHERE id = $1 AND role = 'hr'`, [id]);
    if (!existing.rows[0]) throw new ScanError('HR Scanner account not found', 'NOT_FOUND', 404);

    const { status, password, email } = req.body || {};
    const sets = [];
    const params = [];
    const changes = [];
    if (status !== undefined) {
      if (!['Active', 'Inactive'].includes(status)) throw new ScanError('Status must be Active or Inactive', 'INVALID_STATUS');
      params.push(status); sets.push(`status = $${params.length}`); changes.push(`status → ${status}`);
    }
    if (email !== undefined) {
      const clean = String(email).trim().toLowerCase();
      if (!EMAIL_RE.test(clean)) throw new ScanError('Enter a valid email address', 'INVALID_EMAIL');
      const dup = await pool.query('SELECT 1 FROM admins WHERE LOWER(email) = $1 AND id <> $2', [clean, id]);
      if (dup.rows.length) throw new ScanError('Email already exists', 'DUPLICATE', 409);
      params.push(clean); sets.push(`email = $${params.length}`); changes.push('email changed');
    }
    if (password !== undefined && password !== '') {
      if (String(password).length < 6) throw new ScanError('Password must be at least 6 characters', 'WEAK_PASSWORD');
      params.push(await bcrypt.hash(String(password), 10)); sets.push(`password = $${params.length}`); changes.push('password reset');
    }
    if (sets.length === 0) throw new ScanError('Nothing to update', 'NO_CHANGES');

    params.push(id);
    const r = await pool.query(
      `UPDATE admins SET ${sets.join(', ')} WHERE id = $${params.length} AND role = 'hr' RETURNING id, username, email, status, created_at`,
      params
    );
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId, adminName: actor.name, adminEmail: actor.email,
      actionType: 'HR_ACCOUNT_UPDATE', moduleName: 'Smart Attendance',
      description: `Updated HR Scanner account "${existing.rows[0].username}": ${changes.join(', ')}`
    });
    res.json({ success: true, message: 'HR Scanner account updated', account: r.rows[0] });
  } catch (err) {
    sendError(res, err);
  }
};

const deleteHrAccount = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query(`DELETE FROM admins WHERE id = $1 AND role = 'hr' RETURNING username`, [id]);
    if (!r.rows[0]) throw new ScanError('HR Scanner account not found', 'NOT_FOUND', 404);
    const actor = actorFromReq(req);
    await logAdminActivity({
      adminId: actor.adminId, adminName: actor.name, adminEmail: actor.email,
      actionType: 'HR_ACCOUNT_DELETE', moduleName: 'Smart Attendance',
      description: `Deleted HR Scanner account "${r.rows[0].username}"`
    });
    res.json({ success: true, message: 'HR Scanner account deleted' });
  } catch (err) {
    sendError(res, err);
  }
};

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
    const data = await buildBadgeResponse({ employee_id: employee.employee_id, name: employee.name, job_role: employee.job_role, department_name: employee.department_name }, badge);
    res.json({ success: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
};

module.exports = {
  downloadIdCardPdf,
  downloadAllIdCardsPdf,
  myIdCardPdf,
  listHrAccounts,
  createHrAccount,
  updateHrAccount,
  deleteHrAccount,
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
