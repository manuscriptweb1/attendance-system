/**
 * Smart (Scan) Attendance Service
 * ---------------------------------
 * Auto attendance by ID-card QR/barcode scan or face match.
 *  - Employee badges (QR + Code128) with a random, revocable badge code
 *  - Face profiles (128-d descriptors computed in the browser; matched here)
 *  - Kiosk devices (entrance PC/tablet with a USB barcode scanner or webcam)
 *  - Auto check-in on first scan of the day, check-out on the next scan
 *  - Attendance corrections / notes (HR, Admin, Super Admin) with full audit
 *
 * This module is additive: it never changes how the existing employee
 * check-in/check-out, manual attendance or reports work.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const {
  getIndiaDateTime,
  getOfficeTimes,
  calculateCheckInStatus,
  calculateCheckOutStatus,
  calculateWorkedMinutes
} = require('../utils/timeUtils');
const { getAttendanceBlockedReason } = require('./manualAttendanceService');
const { logAdminActivity } = require('./adminActivityService');

const BADGE_PREFIX = 'ATTN:';
const DESCRIPTOR_LENGTH = 128;
const MAX_FACE_SAMPLES = 5;

const DEFAULT_SCAN_SETTINGS = {
  // Max euclidean distance for a face to count as a match (lower = stricter)
  faceMatchThreshold: 0.5,
  // Ignore repeat scans of the same employee within this many seconds
  duplicateScanCooldownSeconds: 60,
  // Minimum minutes between check-in and an automatic check-out scan
  minMinutesBeforeCheckout: 5,
  // Also accept a plain employee ID (e.g. existing printed ID cards)
  allowEmployeeIdCodes: true,
  // Printed ID card
  cardWebsite: 'www.mstechnomedia.com',
  cardAddress: '22, (New No. 48), 3rd Cross, Vivekananda Nagar, Bengaluru, 560 033, Karnataka, INDIA'
};

const SCAN_METHOD_LABELS = {
  qr: 'QR Scan',
  barcode: 'Barcode Scan',
  face: 'Face Scan'
};

class ScanError extends Error {
  constructor(message, code = 'SCAN_REJECTED', status = 400, extra = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const SCAN_SCHEMA_SQL = fs.readFileSync(path.join(__dirname, '../config/scan_attendance_schema.sql'), 'utf8');

let schemaReady = null;
const ensureScanTables = async () => {
  if (!schemaReady) {
    schemaReady = pool.query(SCAN_SCHEMA_SQL).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const safeAdminId = (id) => (Number.isInteger(Number(id)) && id !== null && id !== '' ? Number(id) : null);

const todayIST = () => getIndiaDateTime().split('T')[0];

const hashKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

const generateBadgeCode = () => {
  // 12 chars from an unambiguous alphabet (no 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
};

const toTimeLabel = (ts) => {
  if (!ts) return null;
  const str = ts instanceof Date ? ts.toISOString() : String(ts);
  const match = str.match(/(\d{2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
};

/**
 * pg returns TIMESTAMP (without tz) columns as JS Dates built in the server's
 * local time zone (Asia/Kolkata). Convert back to the literal wall-clock string.
 */
const toLocalTimestampString = (value) => {
  if (!value) return null;
  if (!(value instanceof Date)) return String(value).replace(' ', 'T').slice(0, 19);
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};

const getScanSettings = async () => {
  await ensureScanTables();
  const result = await pool.query('SELECT settings FROM scan_attendance_settings WHERE id = 1');
  const stored = result.rows[0]?.settings || {};
  return { ...DEFAULT_SCAN_SETTINGS, ...stored };
};

const updateScanSettings = async (patch = {}) => {
  await ensureScanTables();
  const current = await getScanSettings();
  const next = { ...current };

  if (patch.faceMatchThreshold !== undefined) {
    const v = Number(patch.faceMatchThreshold);
    if (!Number.isFinite(v) || v < 0.3 || v > 0.7) throw new ScanError('Face match threshold must be between 0.30 and 0.70', 'INVALID_SETTING');
    next.faceMatchThreshold = v;
  }
  if (patch.duplicateScanCooldownSeconds !== undefined) {
    const v = parseInt(patch.duplicateScanCooldownSeconds, 10);
    if (!Number.isFinite(v) || v < 0 || v > 3600) throw new ScanError('Duplicate scan cooldown must be between 0 and 3600 seconds', 'INVALID_SETTING');
    next.duplicateScanCooldownSeconds = v;
  }
  if (patch.minMinutesBeforeCheckout !== undefined) {
    const v = parseInt(patch.minMinutesBeforeCheckout, 10);
    if (!Number.isFinite(v) || v < 0 || v > 600) throw new ScanError('Minimum minutes before check-out must be between 0 and 600', 'INVALID_SETTING');
    next.minMinutesBeforeCheckout = v;
  }
  if (patch.cardWebsite !== undefined) next.cardWebsite = String(patch.cardWebsite || '').trim().slice(0, 80);
  if (patch.cardAddress !== undefined) next.cardAddress = String(patch.cardAddress || '').trim().slice(0, 200);
  if (patch.allowEmployeeIdCodes !== undefined) {
    next.allowEmployeeIdCodes = patch.allowEmployeeIdCodes === true || patch.allowEmployeeIdCodes === 'true';
  }

  await pool.query(
    `INSERT INTO scan_attendance_settings (id, settings, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(next)]
  );
  return next;
};

/* ------------------------------------------------------------------ */
/* Badges (QR / barcode)                                               */
/* ------------------------------------------------------------------ */

const getOrCreateBadge = async (employeeId) => {
  await ensureScanTables();
  const existing = await pool.query('SELECT * FROM employee_scan_badges WHERE employee_id = $1', [employeeId]);
  if (existing.rows[0]) return existing.rows[0];

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const inserted = await pool.query(
        `INSERT INTO employee_scan_badges (employee_id, badge_code) VALUES ($1, $2)
         ON CONFLICT (employee_id) DO NOTHING RETURNING *`,
        [employeeId, generateBadgeCode()]
      );
      if (inserted.rows[0]) return inserted.rows[0];
      const again = await pool.query('SELECT * FROM employee_scan_badges WHERE employee_id = $1', [employeeId]);
      if (again.rows[0]) return again.rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err; // retry on badge_code collision only
    }
  }
  throw new Error('Could not generate a unique badge code');
};

const regenerateBadge = async (employeeId) => {
  await ensureScanTables();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await pool.query(
        `INSERT INTO employee_scan_badges (employee_id, badge_code) VALUES ($1, $2)
         ON CONFLICT (employee_id) DO UPDATE SET badge_code = EXCLUDED.badge_code, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [employeeId, generateBadgeCode()]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('Could not generate a unique badge code');
};

const ensureBadgesForAllEmployees = async () => {
  await ensureScanTables();
  const missing = await pool.query(
    `SELECT e.employee_id FROM employees e
     LEFT JOIN employee_scan_badges b ON b.employee_id = e.employee_id
     WHERE b.employee_id IS NULL`
  );
  for (const row of missing.rows) {
    await getOrCreateBadge(row.employee_id);
  }
  return missing.rows.length;
};

const badgePayload = (badgeCode) => `${BADGE_PREFIX}${badgeCode}`;

/** Lazy-load bwip-js so the server still boots if the package is missing */
const renderBadgeImages = async (badgeCode, { scale = 4 } = {}) => {
  const bwipjs = require('bwip-js');
  const qrPng = await bwipjs.toBuffer({
    bcid: 'qrcode',
    text: badgePayload(badgeCode),
    scale,
    eclevel: 'M',
    paddingwidth: 2,
    paddingheight: 2,
    backgroundcolor: 'FFFFFF'
  });
  const barcodePng = await bwipjs.toBuffer({
    bcid: 'code128',
    text: badgeCode,
    scale: 3,
    height: 12,
    includetext: true,
    textyoffset: 2,
    textxalign: 'center',
    paddingwidth: 6,
    paddingheight: 4,
    backgroundcolor: 'FFFFFF'
  });
  return { qrPng, barcodePng };
};

/* ------------------------------------------------------------------ */
/* Face profiles                                                       */
/* ------------------------------------------------------------------ */

let faceCache = { loadedAt: 0, profiles: [] };
const FACE_CACHE_TTL_MS = 60 * 1000;

const invalidateFaceCache = () => { faceCache = { loadedAt: 0, profiles: [] }; };

const validateDescriptor = (d) => {
  if (!Array.isArray(d) || d.length !== DESCRIPTOR_LENGTH) return false;
  return d.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 10);
};

const normaliseDescriptors = (input) => {
  if (!Array.isArray(input) || input.length === 0) return null;
  // Accept either a single descriptor or a list of descriptors
  const list = typeof input[0] === 'number' ? [input] : input;
  const valid = list.filter(validateDescriptor).slice(0, MAX_FACE_SAMPLES)
    .map((d) => d.map((v) => Math.round(v * 1e6) / 1e6));
  return valid.length > 0 ? valid : null;
};

const loadFaceProfiles = async () => {
  if (Date.now() - faceCache.loadedAt < FACE_CACHE_TTL_MS && faceCache.loadedAt > 0) return faceCache.profiles;
  await ensureScanTables();
  const result = await pool.query(
    `SELECT f.employee_id, f.descriptors, e.name
     FROM employee_face_profiles f
     JOIN employees e ON e.employee_id = f.employee_id
     WHERE e.status = 'Active'`
  );
  faceCache = {
    loadedAt: Date.now(),
    profiles: result.rows.map((r) => ({ employeeId: r.employee_id, name: r.name, descriptors: r.descriptors || [] }))
  };
  return faceCache.profiles;
};

const euclidean = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

/** Returns { employeeId, name, distance } of the best match, or a reason it failed */
const matchFace = async (descriptor, threshold) => {
  const profiles = await loadFaceProfiles();
  if (profiles.length === 0) {
    return { matched: false, reason: 'NO_PROFILES' };
  }
  const scored = profiles.map((p) => ({
    employeeId: p.employeeId,
    name: p.name,
    distance: Math.min(...p.descriptors.map((d) => euclidean(descriptor, d)))
  })).sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.distance > threshold) {
    return { matched: false, reason: 'NO_MATCH', distance: best ? best.distance : null };
  }
  // Two different people both very close → refuse rather than guess
  if (second && second.distance <= threshold && second.distance - best.distance < 0.04) {
    return { matched: false, reason: 'AMBIGUOUS', distance: best.distance };
  }
  return { matched: true, ...best };
};

const saveFaceProfile = async ({ employeeId, descriptors, photoData, cardPhotoData, source, actor }) => {
  await ensureScanTables();
  const valid = normaliseDescriptors(descriptors);
  if (!valid) throw new ScanError('A valid face could not be read. Please retake the photo with the face clearly visible.', 'INVALID_FACE');

  if (photoData && (typeof photoData !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(photoData) || photoData.length > 400000)) {
    throw new ScanError('Photo must be a JPEG/PNG/WebP image under 300 KB', 'INVALID_PHOTO');
  }
  if (cardPhotoData && (typeof cardPhotoData !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(cardPhotoData) || cardPhotoData.length > 700000)) {
    throw new ScanError('ID card photo must be a JPEG/PNG/WebP image under 500 KB', 'INVALID_PHOTO');
  }

  const emp = await pool.query('SELECT employee_id, name FROM employees WHERE employee_id = $1', [employeeId]);
  if (!emp.rows[0]) throw new ScanError('Employee not found', 'NOT_FOUND', 404);

  // Warn if this face already belongs to someone else
  const settings = await getScanSettings();
  const profiles = await loadFaceProfiles();
  for (const p of profiles) {
    if (p.employeeId === employeeId) continue;
    const dist = Math.min(...p.descriptors.map((d) => euclidean(valid[0], d)));
    if (dist < Math.min(0.4, settings.faceMatchThreshold)) {
      throw new ScanError(`This face looks like ${p.name} (${p.employeeId}) who is already registered. Please check you selected the right employee.`, 'DUPLICATE_FACE', 409);
    }
  }

  const result = await pool.query(
    `INSERT INTO employee_face_profiles (employee_id, descriptors, photo_data, source, enrolled_by_admin_id, enrolled_by_name, card_photo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (employee_id) DO UPDATE SET
       descriptors = EXCLUDED.descriptors,
       photo_data = COALESCE(EXCLUDED.photo_data, employee_face_profiles.photo_data),
       card_photo = COALESCE(EXCLUDED.card_photo, employee_face_profiles.card_photo),
       source = EXCLUDED.source,
       enrolled_by_admin_id = EXCLUDED.enrolled_by_admin_id,
       enrolled_by_name = EXCLUDED.enrolled_by_name,
       updated_at = CURRENT_TIMESTAMP
     RETURNING employee_id, source, enrolled_by_name, created_at, updated_at`,
    [employeeId, JSON.stringify(valid), photoData || null, source === 'upload' ? 'upload' : 'camera', safeAdminId(actor?.adminId), actor?.name || null, cardPhotoData || null]
  );
  invalidateFaceCache();

  await logAdminActivity({
    adminId: actor?.adminId,
    adminName: actor?.name,
    adminEmail: actor?.email,
    actionType: 'FACE_ENROLL',
    moduleName: 'Smart Attendance',
    description: `Registered face for ${employeeId} (${emp.rows[0].name}) via ${source === 'upload' ? 'photo upload' : 'camera'}`
  });

  return { ...result.rows[0], employee_name: emp.rows[0].name };
};

const deleteFaceProfile = async (employeeId, actor) => {
  await ensureScanTables();
  const result = await pool.query('DELETE FROM employee_face_profiles WHERE employee_id = $1 RETURNING employee_id', [employeeId]);
  invalidateFaceCache();
  if (result.rowCount > 0) {
    await logAdminActivity({
      adminId: actor?.adminId,
      adminName: actor?.name,
      adminEmail: actor?.email,
      actionType: 'FACE_DELETE',
      moduleName: 'Smart Attendance',
      description: `Removed registered face for ${employeeId}`
    });
  }
  return result.rowCount > 0;
};

/* ------------------------------------------------------------------ */
/* Kiosk devices                                                       */
/* ------------------------------------------------------------------ */

const createKiosk = async ({ name, mode, actor }) => {
  await ensureScanTables();
  const cleanName = String(name || '').trim().slice(0, 100);
  if (!cleanName) throw new ScanError('Kiosk name is required', 'INVALID_KIOSK');
  const cleanMode = ['card', 'face', 'both'].includes(mode) ? mode : 'card';
  const rawKey = `KSK-${crypto.randomBytes(18).toString('base64url')}`;
  const result = await pool.query(
    `INSERT INTO scan_kiosk_devices (name, mode, key_hash, key_hint, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, name, mode, key_hint, is_active, created_at`,
    [cleanName, cleanMode, hashKey(rawKey), rawKey.slice(-4), safeAdminId(actor?.adminId)]
  );
  return { ...result.rows[0], kiosk_key: rawKey };
};

const findKioskByKey = async (rawKey) => {
  if (!rawKey || typeof rawKey !== 'string' || rawKey.length > 200) return null;
  await ensureScanTables();
  const result = await pool.query('SELECT * FROM scan_kiosk_devices WHERE key_hash = $1', [hashKey(rawKey.trim())]);
  const kiosk = result.rows[0];
  if (!kiosk || !kiosk.is_active) return null;
  pool.query('UPDATE scan_kiosk_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [kiosk.id]).catch(() => {});
  return kiosk;
};

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

const resolveEmployeeFromCode = async (rawCode, settings) => {
  let code = String(rawCode || '').trim();
  if (!code) throw new ScanError('Empty scan. Please scan the ID card again.', 'EMPTY_CODE');
  if (code.length > 200) throw new ScanError('Unrecognised card', 'UNKNOWN_CARD', 404);

  if (code.toUpperCase().startsWith(BADGE_PREFIX)) code = code.slice(BADGE_PREFIX.length).trim();

  const badge = await pool.query(
    `SELECT e.employee_id, e.name, e.status FROM employee_scan_badges b
     JOIN employees e ON e.employee_id = b.employee_id
     WHERE UPPER(b.badge_code) = UPPER($1)`,
    [code]
  );
  if (badge.rows[0]) return badge.rows[0];

  if (settings.allowEmployeeIdCodes) {
    const emp = await pool.query(
      'SELECT employee_id, name, status FROM employees WHERE UPPER(employee_id) = UPPER($1)',
      [code]
    );
    if (emp.rows[0]) return emp.rows[0];
  }

  throw new ScanError('Card not recognised. This ID card is not registered or has been replaced. Please contact HR.', 'UNKNOWN_CARD', 404);
};

const writeScanLog = async (entry) => {
  try {
    await pool.query(
      `INSERT INTO attendance_scan_logs (
        employee_id, employee_name, attendance_id, attendance_date, action, method, source, status, message,
        match_distance, scanned_by_admin_id, scanned_by_name, kiosk_id, kiosk_name, ip_address, user_agent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        entry.employeeId || null, entry.employeeName || null, entry.attendanceId || null, entry.date || todayIST(),
        entry.action || null, entry.method || null, entry.source || null, entry.status, entry.message || null,
        entry.distance !== undefined && entry.distance !== null ? Number(entry.distance.toFixed(4)) : null,
        safeAdminId(entry.actor?.adminId), entry.actor?.name || null,
        entry.kiosk?.id || null, entry.kiosk?.name || null,
        entry.ipAddress || null, entry.userAgent ? String(entry.userAgent).slice(0, 500) : null
      ]
    );
  } catch (err) {
    console.error('Scan log write failed:', err.message);
  }
};

const hasFaceProfile = async (employeeId) => {
  const r = await pool.query('SELECT 1 FROM employee_face_profiles WHERE employee_id = $1', [employeeId]);
  return r.rows.length > 0;
};

/** Portrait for the printed ID card (falls back to the face thumbnail) */
const getCardPhoto = async (employeeId) => {
  await ensureScanTables();
  const r = await pool.query('SELECT COALESCE(card_photo, photo_data) AS photo FROM employee_face_profiles WHERE employee_id = $1', [employeeId]);
  return r.rows[0]?.photo || null;
};

const getFacePhoto = async (employeeId) => {
  await ensureScanTables();
  const r = await pool.query('SELECT photo_data FROM employee_face_profiles WHERE employee_id = $1', [employeeId]);
  return r.rows[0]?.photo_data || null;
};

/**
 * Main entry point for every scan (HR mobile or kiosk).
 * @param {object} p
 * @param {'qr'|'barcode'|'face'} p.method
 * @param {string} [p.code]        QR / barcode text
 * @param {number[]} [p.descriptor] 128-d face descriptor
 * @param {'hr_mobile'|'kiosk'} p.source
 * @param {object} [p.actor]       { adminId, name, email, role } for HR scans
 * @param {object} [p.kiosk]       kiosk device row for kiosk scans
 */
const performScan = async ({ method, code, descriptor, source, actor, kiosk, ipAddress, userAgent }) => {
  await ensureScanTables();
  const settings = await getScanSettings();
  const date = todayIST();
  const scanMethod = ['qr', 'barcode', 'face'].includes(method) ? method : 'qr';
  const logBase = { method: scanMethod, source, actor, kiosk, ipAddress, userAgent, date };

  let employee;
  let distance = null;

  try {
    if (kiosk) {
      const allowed = kiosk.mode === 'both' || (kiosk.mode === 'face' ? scanMethod === 'face' : scanMethod !== 'face');
      if (!allowed) throw new ScanError(`This kiosk is set up for ${kiosk.mode === 'face' ? 'face' : 'ID card'} scanning only.`, 'MODE_NOT_ALLOWED', 403);
    }

    if (scanMethod === 'face') {
      if (!validateDescriptor(descriptor)) {
        throw new ScanError('No clear face detected. Please look straight at the camera.', 'INVALID_FACE');
      }
      const match = await matchFace(descriptor, settings.faceMatchThreshold);
      if (!match.matched) {
        distance = match.distance ?? null;
        if (match.reason === 'AMBIGUOUS') {
          throw new ScanError('Face match is not certain. Please try again or scan your ID card.', 'FACE_AMBIGUOUS', 404);
        }
        throw new ScanError(
          'Face not recognised. If your photo is not registered yet, please contact HR to upload or scan your photo.',
          match.reason === 'NO_PROFILES' ? 'NO_FACE_PROFILES' : 'FACE_NOT_RECOGNISED',
          404
        );
      }
      distance = match.distance;
      const emp = await pool.query('SELECT employee_id, name, status FROM employees WHERE employee_id = $1', [match.employeeId]);
      employee = emp.rows[0];
    } else {
      employee = await resolveEmployeeFromCode(code, settings);
    }

    if (!employee) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
    if (employee.status !== 'Active') {
      throw new ScanError(`${employee.name} (${employee.employee_id}) is not an active employee.`, 'INACTIVE_EMPLOYEE', 403);
    }

    const blocked = await getAttendanceBlockedReason(date, 'mark attendance');
    if (blocked.blocked) throw new ScanError(blocked.message, 'HOLIDAY', 400);

    // Duplicate-scan protection
    if (settings.duplicateScanCooldownSeconds > 0) {
      const recent = await pool.query(
        `SELECT action, created_at FROM attendance_scan_logs
         WHERE employee_id = $1 AND status = 'success'
           AND created_at > NOW() - ($2 || ' seconds')::interval
         ORDER BY created_at DESC LIMIT 1`,
        [employee.employee_id, String(settings.duplicateScanCooldownSeconds)]
      );
      if (recent.rows[0]) {
        const what = recent.rows[0].action === 'check_out' ? 'checked out' : 'checked in';
        throw new ScanError(`${employee.name} was already ${what} a moment ago.`, 'DUPLICATE_SCAN', 409, { duplicate: true });
      }
    }

    const existingRes = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
      [employee.employee_id, date]
    );
    const existing = existingRes.rows[0];

    if (existing && existing.validation_method === 'Paid Leave') {
      throw new ScanError(`${employee.name} is on paid leave today. Contact HR/Admin to change it.`, 'ON_LEAVE', 409);
    }

    const officeSettings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(officeSettings);
    const now = getIndiaDateTime();
    const methodLabel = SCAN_METHOD_LABELS[scanMethod];
    const deviceInfo = kiosk ? `Kiosk: ${kiosk.name}` : `HR Scanner: ${actor?.name || 'HR'}`;
    const deviceSource = kiosk ? 'kiosk' : 'hr_mobile';

    let action;
    let record;

    if (!existing || !existing.login_time) {
      // ---------- CHECK-IN ----------
      action = 'check_in';
      const inStatus = calculateCheckInStatus(now, officeTimes.startTime, officeTimes.lateTime);
      const isLate = inStatus.checkin_status === 'Late';
      const checkinStatus = isLate ? 'late' : 'on_time';
      const lateMinutes = Number(inStatus.late_minutes || 0);
      const attendanceStatus = isLate ? 'Late' : 'Present';

      if (existing) {
        const upd = await pool.query(
          `UPDATE attendance SET
             login_time = $1, attendance_status = $2, checkin_status = $3, late_minutes = $4,
             validation_method = $5, device_source = $6, device_info = $7, ip_address = $8,
             absent_reason = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = $9 AND login_time IS NULL RETURNING *`,
          [now, attendanceStatus, checkinStatus, lateMinutes, methodLabel, deviceSource, deviceInfo, ipAddress || null, existing.id]
        );
        record = upd.rows[0];
        if (!record) throw new ScanError(`${employee.name} was just checked in by another scan.`, 'DUPLICATE_SCAN', 409, { duplicate: true });
      } else {
        const ins = await pool.query(
          `INSERT INTO attendance (
             employee_id, attendance_date, login_time, attendance_status, checkin_status, late_minutes,
             validation_method, device_source, device_info, ip_address
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (employee_id, attendance_date) DO NOTHING
           RETURNING *`,
          [employee.employee_id, date, now, attendanceStatus, checkinStatus, lateMinutes, methodLabel, deviceSource, deviceInfo, ipAddress || null]
        );
        record = ins.rows[0];
        if (!record) throw new ScanError(`${employee.name} was just checked in by another scan.`, 'DUPLICATE_SCAN', 409, { duplicate: true });
      }
    } else if (!existing.logout_time) {
      // ---------- CHECK-OUT ----------
      const loginStr = toLocalTimestampString(existing.login_time);
      const minutesSinceIn = Math.floor((new Date(now) - new Date(loginStr)) / 60000);
      if (minutesSinceIn < settings.minMinutesBeforeCheckout) {
        throw new ScanError(
          `${employee.name} checked in at ${toTimeLabel(loginStr)}. Check-out is allowed after ${settings.minMinutesBeforeCheckout} minutes.`,
          'TOO_SOON',
          409,
          { duplicate: true }
        );
      }

      action = 'check_out';
      const outStatus = calculateCheckOutStatus(now, officeTimes.endTime);
      const checkoutStatus = outStatus.checkout_status === 'Late Check-Out' ? 'late' : (outStatus.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
      const earlyMinutes = outStatus.early_minutes || 0;
      const totalMinutes = calculateWorkedMinutes(loginStr, now, officeTimes.startTime);
      const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

      let attendanceStatus = existing.attendance_status;
      let lateMinutes = existing.late_minutes || 0;
      let checkinStatus = existing.checkin_status;
      if (attendanceStatus !== 'Absent' && attendanceStatus !== 'Half Day' && totalHours <= officeTimes.halfDayThreshold) {
        attendanceStatus = 'Half Day';
      }
      if (attendanceStatus === 'Half Day') {
        // Half day attendance is exempt from the late arrival penalty
        lateMinutes = 0;
        checkinStatus = 'on_time';
      }

      const upd = await pool.query(
        `UPDATE attendance SET
           logout_time = $1, total_working_hours = $2, total_hours = $3, total_minutes = $4,
           checkout_status = $5, early_minutes = $6, attendance_status = $7,
           late_minutes = $8, checkin_status = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 AND logout_time IS NULL RETURNING *`,
        [now, totalHours, totalHours, totalMinutes, checkoutStatus, earlyMinutes, attendanceStatus, lateMinutes, checkinStatus, existing.id]
      );
      record = upd.rows[0];
      if (!record) throw new ScanError(`${employee.name} was just checked out by another scan.`, 'DUPLICATE_SCAN', 409, { duplicate: true });
    } else {
      throw new ScanError(
        `${employee.name} has already completed attendance today (in ${toTimeLabel(toLocalTimestampString(existing.login_time))}, out ${toTimeLabel(toLocalTimestampString(existing.logout_time))}). Ask HR/Admin to correct it if needed.`,
        'ALREADY_COMPLETED',
        409,
        { duplicate: true }
      );
    }

    const faceRegistered = scanMethod === 'face' ? true : await hasFaceProfile(employee.employee_id);
    const loginStr = toLocalTimestampString(record.login_time);
    const logoutStr = toLocalTimestampString(record.logout_time);
    const message = action === 'check_in'
      ? `${employee.name} checked in at ${toTimeLabel(loginStr)}${record.attendance_status === 'Late' ? ` (late by ${record.late_minutes} min)` : ''}`
      : `${employee.name} checked out at ${toTimeLabel(logoutStr)} · worked ${Math.floor((record.total_minutes || 0) / 60)}h ${(record.total_minutes || 0) % 60}m`;

    await writeScanLog({
      ...logBase,
      employeeId: employee.employee_id,
      employeeName: employee.name,
      attendanceId: record.id,
      action,
      status: 'success',
      message,
      distance
    });

    return {
      success: true,
      action,
      message,
      employee: {
        employee_id: employee.employee_id,
        name: employee.name,
        face_registered: faceRegistered
      },
      attendance: {
        id: record.id,
        date,
        login_time: loginStr,
        logout_time: logoutStr,
        login_label: toTimeLabel(loginStr),
        logout_label: toTimeLabel(logoutStr),
        attendance_status: record.attendance_status,
        late_minutes: record.late_minutes,
        total_minutes: record.total_minutes
      },
      match_distance: distance
    };
  } catch (err) {
    const isScanError = err instanceof ScanError;
    await writeScanLog({
      ...logBase,
      employeeId: employee?.employee_id,
      employeeName: employee?.name,
      action: 'none',
      status: isScanError && err.extra?.duplicate ? 'duplicate' : 'rejected',
      message: isScanError ? err.message : `Server error: ${err.message}`,
      distance
    });
    if (isScanError) {
      err.extra = {
        ...err.extra,
        employee: employee ? { employee_id: employee.employee_id, name: employee.name } : null
      };
    }
    throw err;
  }
};

/* ------------------------------------------------------------------ */
/* Corrections & notes                                                 */
/* ------------------------------------------------------------------ */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getAttendanceWithNotes = async (employeeId, date) => {
  await ensureScanTables();
  const emp = await pool.query(
    `SELECT e.employee_id, e.name, d.name AS department_name FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id WHERE e.employee_id = $1`,
    [employeeId]
  );
  if (!emp.rows[0]) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
  const att = await pool.query('SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2', [employeeId, date]);
  const notes = await pool.query(
    `SELECT *, to_char((created_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_ist FROM attendance_notes WHERE employee_id = $1 AND attendance_date = $2 ORDER BY created_at DESC`,
    [employeeId, date]
  );
  const a = att.rows[0];
  return {
    employee: emp.rows[0],
    attendance: a ? {
      id: a.id,
      attendance_status: a.attendance_status,
      login_time: toLocalTimestampString(a.login_time),
      logout_time: toLocalTimestampString(a.logout_time),
      login_label: toTimeLabel(toLocalTimestampString(a.login_time)),
      logout_label: toTimeLabel(toLocalTimestampString(a.logout_time)),
      late_minutes: a.late_minutes,
      total_minutes: a.total_minutes,
      validation_method: a.validation_method,
      absent_reason: a.absent_reason
    } : null,
    notes: notes.rows
  };
};

/**
 * Correct check-in / check-out times (or just add a note) with a mandatory reason.
 * loginTime / logoutTime are "HH:mm" (IST). Pass null/'' to keep the current value.
 * clearLogout=true removes the check-out time.
 */
const correctAttendance = async ({ employeeId, date, loginTime, logoutTime, clearLogout, note, category, actor }) => {
  await ensureScanTables();
  const cleanNote = String(note || '').trim();
  if (cleanNote.length < 3) throw new ScanError('A note / reason is required (e.g. "Scanner machine was not working").', 'NOTE_REQUIRED');
  if (cleanNote.length > 1000) throw new ScanError('Note is too long (max 1000 characters)', 'NOTE_TOO_LONG');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new ScanError('A valid date is required', 'INVALID_DATE');
  if (date > todayIST()) throw new ScanError('Cannot correct attendance for a future date', 'FUTURE_DATE');
  const cleanCategory = String(category || 'Other').trim().slice(0, 80) || 'Other';

  const wantsLogin = loginTime !== undefined && loginTime !== null && loginTime !== '';
  const wantsLogout = logoutTime !== undefined && logoutTime !== null && logoutTime !== '';
  if (wantsLogin && !TIME_RE.test(loginTime)) throw new ScanError('Check-in time must be HH:mm', 'INVALID_TIME');
  if (wantsLogout && !TIME_RE.test(logoutTime)) throw new ScanError('Check-out time must be HH:mm', 'INVALID_TIME');

  const emp = await pool.query('SELECT employee_id, name FROM employees WHERE employee_id = $1', [employeeId]);
  if (!emp.rows[0]) throw new ScanError('Employee not found', 'NOT_FOUND', 404);
  const empName = emp.rows[0].name;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingRes = await client.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2 FOR UPDATE',
      [employeeId, date]
    );
    const existing = existingRes.rows[0];
    const oldValues = existing ? {
      login_time: toLocalTimestampString(existing.login_time),
      logout_time: toLocalTimestampString(existing.logout_time),
      attendance_status: existing.attendance_status,
      late_minutes: existing.late_minutes,
      total_minutes: existing.total_minutes
    } : null;

    const changesTimes = wantsLogin || wantsLogout || clearLogout === true;
    let record = existing;
    let newValues = null;

    if (changesTimes) {
      const loginStr = wantsLogin ? `${date}T${loginTime}:00` : (existing ? toLocalTimestampString(existing.login_time) : null);
      let logoutStr = wantsLogout ? `${date}T${logoutTime}:00` : (existing ? toLocalTimestampString(existing.logout_time) : null);
      if (clearLogout === true && !wantsLogout) logoutStr = null;

      if (!loginStr) throw new ScanError('Check-in time is required before a check-out time can be set', 'LOGIN_REQUIRED');
      if (logoutStr && logoutStr <= loginStr) throw new ScanError('Check-out time must be after check-in time', 'INVALID_TIME');
      const nowStr = getIndiaDateTime();
      if (loginStr > nowStr || (logoutStr && logoutStr > nowStr)) throw new ScanError('Times cannot be in the future', 'FUTURE_TIME');

      const officeSettings = await getSettingsFromDB();
      const officeTimes = getOfficeTimes(officeSettings);
      const inStatus = calculateCheckInStatus(loginStr, officeTimes.startTime, officeTimes.lateTime);
      let checkinStatus = inStatus.checkin_status === 'Late' ? 'late' : 'on_time';
      let lateMinutes = Number(inStatus.late_minutes || 0);
      let attendanceStatus = inStatus.checkin_status === 'Late' ? 'Late' : 'Present';
      if (existing && existing.attendance_status === 'Work From Home') attendanceStatus = 'Work From Home';

      let checkoutStatus = null;
      let earlyMinutes = 0;
      let totalMinutes = 0;
      let totalHours = 0;
      if (logoutStr) {
        const outStatus = calculateCheckOutStatus(logoutStr, officeTimes.endTime);
        checkoutStatus = outStatus.checkout_status === 'Late Check-Out' ? 'late' : (outStatus.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
        earlyMinutes = outStatus.early_minutes || 0;
        totalMinutes = calculateWorkedMinutes(loginStr, logoutStr, officeTimes.startTime);
        totalHours = parseFloat((totalMinutes / 60).toFixed(2));
        if (attendanceStatus !== 'Work From Home' && totalHours <= officeTimes.halfDayThreshold) {
          attendanceStatus = 'Half Day';
          lateMinutes = 0;
          checkinStatus = 'on_time';
        }
      }

      // Keep the original method (e.g. "QR Scan") when only adjusting times; new rows are "Manual"
      const validationMethod = existing && existing.login_time && existing.validation_method && existing.validation_method !== 'Paid Leave'
        ? existing.validation_method
        : 'Manual';

      if (existing) {
        const upd = await client.query(
          `UPDATE attendance SET
             login_time = $1, logout_time = $2, attendance_status = $3, checkin_status = $4, late_minutes = $5,
             checkout_status = $6, early_minutes = $7, total_minutes = $8, total_hours = $9, total_working_hours = $9,
             validation_method = $10, absent_reason = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = $11 RETURNING *`,
          [loginStr, logoutStr, attendanceStatus, checkinStatus, lateMinutes, checkoutStatus, earlyMinutes, totalMinutes, totalHours, validationMethod, existing.id]
        );
        record = upd.rows[0];
      } else {
        const ins = await client.query(
          `INSERT INTO attendance (
             employee_id, attendance_date, login_time, logout_time, attendance_status, checkin_status, late_minutes,
             checkout_status, early_minutes, total_minutes, total_hours, total_working_hours, validation_method, device_info
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,'Manual',$12) RETURNING *`,
          [employeeId, date, loginStr, logoutStr, attendanceStatus, checkinStatus, lateMinutes, checkoutStatus, earlyMinutes, totalMinutes, totalHours, `Correction by ${actor?.name || 'Admin'}`]
        );
        record = ins.rows[0];
      }

      newValues = {
        login_time: loginStr,
        logout_time: logoutStr,
        attendance_status: attendanceStatus,
        late_minutes: lateMinutes,
        total_minutes: totalMinutes
      };
    }

    const noteRes = await client.query(
      `INSERT INTO attendance_notes (
         attendance_id, employee_id, attendance_date, category, note, change_type, old_values, new_values,
         created_by_admin_id, created_by_name, created_by_role
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        record?.id || null, employeeId, date, cleanCategory, cleanNote, changesTimes ? 'correction' : 'note',
        oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null,
        safeAdminId(actor?.adminId), actor?.name || null, actor?.roleLabel || actor?.role || null
      ]
    );

    await client.query('COMMIT');

    await logAdminActivity({
      adminId: actor?.adminId,
      adminName: actor?.name,
      adminEmail: actor?.email,
      actionType: changesTimes ? 'ATTENDANCE_CORRECTION' : 'ATTENDANCE_NOTE',
      moduleName: 'Smart Attendance',
      description: `${changesTimes ? 'Corrected attendance' : 'Added attendance note'} for ${employeeId} (${empName}) on ${date}. ${cleanCategory}: ${cleanNote}`,
      oldData: oldValues,
      newData: newValues
    });

    return { note: noteRes.rows[0], ...(await getAttendanceWithNotes(employeeId, date)) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  ScanError,
  BADGE_PREFIX,
  DEFAULT_SCAN_SETTINGS,
  ensureScanTables,
  getScanSettings,
  updateScanSettings,
  getOrCreateBadge,
  regenerateBadge,
  ensureBadgesForAllEmployees,
  badgePayload,
  renderBadgeImages,
  saveFaceProfile,
  deleteFaceProfile,
  getFacePhoto,
  getCardPhoto,
  createKiosk,
  findKioskByKey,
  performScan,
  getAttendanceWithNotes,
  correctAttendance,
  toLocalTimestampString,
  toTimeLabel,
  todayIST
};
