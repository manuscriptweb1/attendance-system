
-- ============================================
-- ATTENDANCE MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA
-- All migrations consolidated into one file
-- ============================================

-- Create Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Admin Login Logs Table
CREATE TABLE IF NOT EXISTS admin_login_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    browser_info TEXT,
    device_info TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_login_logs_admin ON admin_login_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_time ON admin_login_logs(login_time);

-- Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    job_role VARCHAR(100) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    password_changed_at TIMESTAMP,
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create WFH Permissions Table
CREATE TABLE IF NOT EXISTS wfh_permissions (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_by INTEGER REFERENCES admins(id),
    enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id)
);

-- Create Early Checkout Permissions Table
CREATE TABLE IF NOT EXISTS early_checkout_permissions (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_by INTEGER REFERENCES admins(id),
    enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id)
);

-- Create Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    login_time TIMESTAMP,
    logout_time TIMESTAMP,
    total_working_hours DECIMAL(5,2),
    latitude_login DECIMAL(10,8),
    longitude_login DECIMAL(11,8),
    latitude_logout DECIMAL(10,8),
    longitude_logout DECIMAL(11,8),
    address_login TEXT,
    address_logout TEXT,
    attendance_status VARCHAR(20) DEFAULT 'Not Mention',
    is_wfh BOOLEAN DEFAULT FALSE,
    is_auto_checkout BOOLEAN DEFAULT FALSE,
    device_info TEXT,
    browser_info TEXT,
    ip_address VARCHAR(50),
    gps_accuracy DECIMAL(10,2),
    device_fingerprint VARCHAR(255),
    session_id VARCHAR(255),
    validation_method VARCHAR(50),
    absent_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);

-- Create Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    holiday_type VARCHAR(30) NOT NULL CHECK (holiday_type IN ('Government Holiday', 'Office Holiday')),
    holiday_title VARCHAR(200) NOT NULL,
    holiday_note TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) DEFAULT 'Company Office',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    allowed_radius INTEGER NOT NULL DEFAULT 100,
    gps_accuracy_threshold INTEGER DEFAULT 100,
    office_start_time TIME NOT NULL DEFAULT '09:00',
    office_end_time TIME NOT NULL DEFAULT '18:00',
    auto_checkout_time TIME DEFAULT '18:32:00',
    late_after_time TIME NOT NULL DEFAULT '09:30',
    half_day_threshold DECIMAL(3, 1) NOT NULL DEFAULT 4.0,
    check_in_enabled BOOLEAN DEFAULT TRUE,
    check_out_enabled BOOLEAN DEFAULT TRUE,
    otp_expiry_minutes INTEGER DEFAULT 5,
    otp_resend_seconds INTEGER DEFAULT 60,
    otp_max_attempts INTEGER DEFAULT 3,
    otp_requests_per_hour INTEGER DEFAULT 5,
    office_public_ip TEXT,
    allowed_ips TEXT,
    attendance_validation_mode VARCHAR(30) DEFAULT 'location_or_network',
    attendance_rate_limit INTEGER DEFAULT 5,
    trusted_device_validation_enabled BOOLEAN DEFAULT FALSE,
    electron_desktop_enabled BOOLEAN DEFAULT TRUE,
    electron_desktop_validation_mode VARCHAR(80) DEFAULT 'trusted_device_and_network',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Password Reset OTPs Table
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('password_reset', 'password_change')),
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    used BOOLEAN DEFAULT FALSE,
    last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create OTP Rate Limits Table
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id)
);

-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('employee', 'admin')),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Admin Activity Logs Table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    admin_name VARCHAR(100),
    admin_email VARCHAR(150),
    action_type VARCHAR(100) NOT NULL,
    module_name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    device_info TEXT,
    browser_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Trusted Devices Table (Device Approval System)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    employee_name VARCHAR(150),
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_alias VARCHAR(255),
    browser_name VARCHAR(100),
    browser_version VARCHAR(50),
    operating_system VARCHAR(100),
    device_type VARCHAR(50) DEFAULT 'Unknown' CHECK (device_type IN ('Desktop', 'Laptop', 'Mobile', 'Tablet', 'Unknown')),
    screen_resolution VARCHAR(50),
    platform VARCHAR(100),
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_status VARCHAR(20) DEFAULT 'Pending' CHECK (approved_status IN ('Pending', 'Approved', 'Rejected')),
    approved_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejected_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, device_fingerprint)
);

-- Create Device Fingerprints Table (Legacy - Keep for backward compatibility)
CREATE TABLE IF NOT EXISTS device_fingerprints (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_alias VARCHAR(255),
    device_type VARCHAR(50) DEFAULT 'Unknown' CHECK (device_type IN ('Desktop', 'Laptop', 'Mobile', 'Tablet', 'Unknown')),
    browser VARCHAR(100),
    browser_version VARCHAR(50),
    operating_system VARCHAR(100),
    screen_resolution VARCHAR(50),
    timezone VARCHAR(50),
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, device_fingerprint)
);

-- Create Attendance Rate Limits Table
CREATE TABLE IF NOT EXISTS attendance_rate_limits (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    ip_address VARCHAR(50),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, ip_address)
);

-- Create Manual Attendance Logs Table
CREATE TABLE IF NOT EXISTS manual_attendance_logs (
    id SERIAL PRIMARY KEY,
    attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    action VARCHAR(50) NOT NULL,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for device fingerprints
CREATE OR REPLACE FUNCTION update_device_fingerprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_device_fingerprints_updated_at ON device_fingerprints;

CREATE TRIGGER trigger_device_fingerprints_updated_at
BEFORE UPDATE ON device_fingerprints
FOR EACH ROW
WHEN (OLD.device_alias IS DISTINCT FROM NEW.device_alias)
EXECUTE FUNCTION update_device_fingerprints_updated_at();

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_wfh_permissions_employee ON wfh_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_early_checkout_permissions_employee ON early_checkout_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_enabled ON holidays(is_enabled);
CREATE INDEX IF NOT EXISTS idx_settings_id ON settings(id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_employee ON password_reset_otps(employee_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON password_reset_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_used ON password_reset_otps(used);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_employee ON otp_rate_limits(employee_id);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_window ON otp_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_admin ON admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action ON admin_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_module ON admin_activity_logs(module_name);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created ON admin_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_employee ON device_fingerprints(employee_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_fingerprint ON device_fingerprints(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_alias ON device_fingerprints(device_alias);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_employee ON trusted_devices(employee_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_status ON trusted_devices(approved_status);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_last_used ON trusted_devices(last_used);
CREATE INDEX IF NOT EXISTS idx_attendance_rate_limits_employee ON attendance_rate_limits(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_rate_limits_window ON attendance_rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_manual_attendance_logs_emp ON manual_attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_manual_attendance_logs_date ON manual_attendance_logs(attendance_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_singleton ON settings ((id IS NOT NULL));

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert Default Settings
INSERT INTO settings (
    company_name, latitude, longitude, allowed_radius,
    gps_accuracy_threshold, office_start_time, office_end_time,
    auto_checkout_time, late_after_time, half_day_threshold, 
    check_in_enabled, check_out_enabled,
    otp_expiry_minutes, otp_resend_seconds, otp_max_attempts, otp_requests_per_hour,
    office_public_ip, allowed_ips, attendance_validation_mode, attendance_rate_limit, trusted_device_validation_enabled
) VALUES (
    'Company Office', 13.015837, 77.721172, 100, 100,
    '09:00', '18:00', '18:32', '09:30', 4.0, true, true,
    5, 60, 3, 5,
    NULL, NULL, 'location_or_network', 5, FALSE
) ON CONFLICT DO NOTHING;

-- Insert Sample Departments
INSERT INTO departments (name) VALUES 
    ('IT'),
    ('HR'),
    ('Finance'),
    ('Marketing'),
    ('Operations')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SCHEMA SETUP COMPLETE
-- ============================================


-- ============================================
-- HR, PAYROLL & EXPENSES MODULES
-- ============================================
-- Part 2: Employee Table additions
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hra NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS staff_advance NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS professional_tax NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Part 3: Attendance Late/Early additions
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0;

-- Part 4: Payroll Records Table
CREATE TABLE IF NOT EXISTS payroll_records (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
  employee_code VARCHAR(50),
  payroll_month INTEGER NOT NULL,
  payroll_year INTEGER NOT NULL,

  total_days INTEGER DEFAULT 0,
  working_days INTEGER DEFAULT 0,
  paid_days NUMERIC(6,2) DEFAULT 0,
  half_days NUMERIC(6,2) DEFAULT 0,
  half_day_loss_amount NUMERIC(12,2) DEFAULT 0,

  monthly_earning NUMERIC(12,2) DEFAULT 0,
  per_day_salary NUMERIC(12,2) DEFAULT 0,

  lop_days NUMERIC(6,2) DEFAULT 0,
  lop_amount NUMERIC(12,2) DEFAULT 0,

  net_earning NUMERIC(12,2) DEFAULT 0,

  basic_salary NUMERIC(12,2) DEFAULT 0,
  hra NUMERIC(12,2) DEFAULT 0,
  special_allowance NUMERIC(12,2) DEFAULT 0,
  staff_advance NUMERIC(12,2) DEFAULT 0,
  professional_tax NUMERIC(12,2) DEFAULT 0,
  tds NUMERIC(12,2) DEFAULT 0,

  net_payable NUMERIC(12,2) DEFAULT 0,

  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  paid_by INTEGER NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(employee_id, payroll_month, payroll_year)
);

-- Part 5: Expenses Tables
CREATE TABLE IF NOT EXISTS expense_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monthly_expenses (
  id SERIAL PRIMARY KEY,
  expense_type_id INTEGER REFERENCES expense_types(id),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  expense_month INTEGER NOT NULL,
  expense_year INTEGER NOT NULL,
  payment_mode VARCHAR(30) DEFAULT 'cash',
  status VARCHAR(20) DEFAULT 'paid',
  paid_to VARCHAR(150),
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- FINAL ATTENDANCE HOURS & PAYROLL EXPANSION
-- ============================================
-- 1. ATTENDANCE REPORT & TOTAL HOURS MIGRATION
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS total_hours NUMERIC(8,2) DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0;

UPDATE attendance
SET 
  total_minutes = EXTRACT(EPOCH FROM (logout_time - login_time)) / 60,
  total_hours = ROUND((EXTRACT(EPOCH FROM (logout_time - login_time)) / 3600)::numeric, 2)
WHERE login_time IS NOT NULL
  AND logout_time IS NOT NULL
  AND (total_hours IS NULL OR total_hours = 0);

-- 2. PAYROLL SCHEMA EXPANSION
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS present_days NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_days NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS absent_days NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS blank_unmarked_days NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS holiday_days NUMERIC(6,2) DEFAULT 0;

-- 3. EMPLOYEES SALARY BACKFILL (If needed)
UPDATE employees
SET
  basic_salary = ROUND((monthly_salary * 0.50)::numeric, 2),
  hra = ROUND((monthly_salary * 0.20)::numeric, 2),
  special_allowance = ROUND((monthly_salary - (monthly_salary * 0.50) - (monthly_salary * 0.20))::numeric, 2)
WHERE monthly_salary IS NOT NULL
  AND monthly_salary > 0
  AND (basic_salary IS NULL OR basic_salary = 0)
  AND (hra IS NULL OR hra = 0)
  AND (special_allowance IS NULL OR special_allowance = 0);


-- ============================================
-- SCHEMA SETUP COMPLETE
-- ============================================
SELECT 'Database schema created successfully!' AS message;
