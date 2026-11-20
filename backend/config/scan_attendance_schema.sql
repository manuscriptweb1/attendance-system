-- Smart Attendance (QR / barcode / face scan, HR Scanner role, attendance notes)
-- Safe to run repeatedly. Also executed automatically on server start.

CREATE TABLE IF NOT EXISTS employee_scan_badges (
  employee_id VARCHAR(50) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
  badge_code VARCHAR(64) NOT NULL UNIQUE,
  last_emailed_at TIMESTAMP,
  email_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_face_profiles (
  employee_id VARCHAR(50) PRIMARY KEY REFERENCES employees(employee_id) ON DELETE CASCADE,
  descriptors JSONB NOT NULL,
  photo_data TEXT,
  source VARCHAR(20) DEFAULT 'camera',
  enrolled_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  enrolled_by_name VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Passport-style portrait used on the printed ID card
ALTER TABLE employee_face_profiles ADD COLUMN IF NOT EXISTS card_photo TEXT;

CREATE TABLE IF NOT EXISTS scan_kiosk_devices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'card' CHECK (mode IN ('card', 'face', 'both')),
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  key_hint VARCHAR(12),
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMP,
  created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_scan_logs (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50),
  employee_name VARCHAR(150),
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
  attendance_date DATE,
  action VARCHAR(20),
  method VARCHAR(20),
  source VARCHAR(20),
  status VARCHAR(20) NOT NULL,
  message TEXT,
  match_distance NUMERIC(6,4),
  scanned_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  scanned_by_name VARCHAR(150),
  kiosk_id INTEGER REFERENCES scan_kiosk_devices(id) ON DELETE SET NULL,
  kiosk_name VARCHAR(100),
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scan_logs_date ON attendance_scan_logs(attendance_date);
CREATE INDEX IF NOT EXISTS idx_scan_logs_employee ON attendance_scan_logs(employee_id, created_at);

CREATE TABLE IF NOT EXISTS attendance_notes (
  id SERIAL PRIMARY KEY,
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
  employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  category VARCHAR(80),
  note TEXT NOT NULL,
  change_type VARCHAR(20) NOT NULL DEFAULT 'note',
  old_values JSONB,
  new_values JSONB,
  created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_by_name VARCHAR(150),
  created_by_role VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attendance_notes_emp_date ON attendance_notes(employee_id, attendance_date);

CREATE TABLE IF NOT EXISTS scan_attendance_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF to_regclass('public.admin_pages') IS NOT NULL THEN
    INSERT INTO admin_pages (page_key, page_name, route_path, sidebar_section, sort_order)
    VALUES ('attendance_scanner', 'Smart Attendance', '/admin/smart-attendance', 'Time & Attendance', 6)
    ON CONFLICT (page_key) DO NOTHING;
  END IF;
END $$;

-- Correct the office address on ID cards if the old default was saved in settings
UPDATE scan_attendance_settings
SET settings = jsonb_set(settings, '{cardAddress}', to_jsonb('22, (New No. 40), 3rd Cross, Vivekananda Nagar, Bengaluru, 560 033, INDIA'::text)), updated_at = CURRENT_TIMESTAMP
WHERE settings->>'cardAddress' = '22, (New No. 48), 3rd Cross, Vivekananda Nagar, Bengaluru, 560 033, Karnataka, INDIA';

-- Special leave (short unpaid leave during the day, e.g. 11 AM – 3 PM).
-- Started and ended by a scan in "Special Leave" mode. Closed minutes are LOP.
CREATE TABLE IF NOT EXISTS attendance_special_leaves (
  id SERIAL PRIMARY KEY,
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  -- open: employee is out · closed: came back (minutes count as LOP)
  -- converted: never came back, start time became the check-out · cancelled: removed by HR/Admin
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'converted', 'cancelled')),
  start_method VARCHAR(20),
  end_method VARCHAR(20),
  source VARCHAR(20),
  started_by_name VARCHAR(150),
  ended_by_name VARCHAR(150),
  cancel_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_special_leaves_emp_date ON attendance_special_leaves(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_special_leaves_attendance ON attendance_special_leaves(attendance_id);
-- Only one open special leave per employee per day
CREATE UNIQUE INDEX IF NOT EXISTS uq_special_leaves_open ON attendance_special_leaves(employee_id, attendance_date) WHERE status = 'open';

-- Denormalised on attendance so every existing attendance screen/report gets it without extra joins
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS special_leave_minutes INTEGER DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS special_leave_summary TEXT;
