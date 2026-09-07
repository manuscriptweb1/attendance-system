
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
    personal_email VARCHAR(150),
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

-- Create Paid Leaves Table
CREATE TABLE IF NOT EXISTS paid_leaves (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    office_start_time TIME NOT NULL,
    office_end_time TIME NOT NULL,
    total_hours DECIMAL(4, 2) DEFAULT 8.00,
    reason_category VARCHAR(100) NOT NULL,
    reason_notes TEXT,
    created_by INTEGER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, leave_date)
);

CREATE INDEX IF NOT EXISTS idx_paid_leaves_date ON paid_leaves(leave_date);
CREATE INDEX IF NOT EXISTS idx_paid_leaves_emp_date ON paid_leaves(employee_id, leave_date);

-- Create Offer Letter Settings Table
CREATE TABLE IF NOT EXISTS offer_letter_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL DEFAULT 'Manuscript Technomedia LLP',
    header_address TEXT DEFAULT 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India',
    header_phone VARCHAR(50) DEFAULT '+91-9686980760',
    header_email VARCHAR(100) DEFAULT 'contact@mstechnomedia.com',
    header_website VARCHAR(100) DEFAULT 'https://mstechnomedia.com',
    footer_line_1 TEXT DEFAULT 'Manuscript Technomedia LLP',
    footer_line_2 TEXT DEFAULT 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.',
    footer_line_3 TEXT DEFAULT 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV',
    default_signatory_name VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK',
    default_signatory_designation VARCHAR(150) DEFAULT 'Designated Partner',
    default_signatory_email VARCHAR(150) DEFAULT 'contact@mstechnomedia.com',
    default_probation_period VARCHAR(150) DEFAULT '3 months, extendable at the company''s discretion.',
    default_work_location VARCHAR(150) DEFAULT 'Office Premises',
    default_work_hours VARCHAR(100) DEFAULT '9:30 AM – 6:30 PM, Monday–Saturday',
    default_annual_paid_leaves INTEGER DEFAULT 12,
    default_variable_percentage NUMERIC(5, 2) DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Role & Responsibility Templates Table (Default/Master Templates)
CREATE TABLE IF NOT EXISTS role_responsibility_templates (
    id SERIAL PRIMARY KEY,
    job_role VARCHAR(150) NOT NULL UNIQUE,
    categories JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Offer Letters Table (Individual Candidate Snapshot & Custom Responsibilities)
CREATE TABLE IF NOT EXISTS offer_letters (
    id SERIAL PRIMARY KEY,
    offer_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated')),
    offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    interview_date DATE,
    joining_date DATE NOT NULL,
    acceptance_deadline_date DATE,
    
    salutation VARCHAR(20) NOT NULL,
    employee_name_snapshot VARCHAR(150) NOT NULL,
    employee_id_snapshot VARCHAR(50) NOT NULL,
    employee_email_snapshot VARCHAR(150),
    employee_phone_snapshot VARCHAR(20),
    employee_address_snapshot TEXT,

    job_title_snapshot VARCHAR(150) NOT NULL,
    department_snapshot VARCHAR(100),
    reporting_to VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK, [Managing Director]',
    work_location VARCHAR(150) DEFAULT 'Office Premises',
    employment_type VARCHAR(50) DEFAULT 'Full-time',
    work_hours VARCHAR(100) DEFAULT '9:30 AM – 6:30 PM, Monday–Saturday',
    probation_period VARCHAR(150) DEFAULT '3 months, extendable at the company''s discretion.',

    -- Saved Responsibilities & Bullet Points JSON Snapshot
    responsibilities_snapshot JSONB NOT NULL DEFAULT '[]',

    monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    annual_fixed_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    variable_percentage NUMERIC(5, 2) DEFAULT 0,
    variable_amount NUMERIC(12, 2) DEFAULT 0,
    total_ctc NUMERIC(12, 2) NOT NULL DEFAULT 0,
    annual_paid_leaves INTEGER DEFAULT 12,
    pf_applicable VARCHAR(50) DEFAULT 'Not Applicable',
    esi_applicable VARCHAR(50) DEFAULT 'Not Applicable',
    gratuity_applicable VARCHAR(50) DEFAULT 'Not Applicable',
    other_allowances VARCHAR(50) DEFAULT 'Not Applicable',

    company_name_snapshot VARCHAR(200),
    header_address_snapshot TEXT,
    header_phone_snapshot VARCHAR(50),
    header_email_snapshot VARCHAR(100),
    header_website_snapshot VARCHAR(100),
    footer_line_1_snapshot TEXT,
    footer_line_2_snapshot TEXT,
    signatory_name VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK',
    signatory_designation VARCHAR(150) DEFAULT 'Designated Partner',
    signatory_email VARCHAR(150) DEFAULT 'contact@mstechnomedia.com',

    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    generated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_offer_letters_emp_id ON offer_letters(employee_id);
CREATE INDEX IF NOT EXISTS idx_offer_letters_status ON offer_letters(status);
CREATE INDEX IF NOT EXISTS idx_offer_letters_offer_num ON offer_letters(offer_number);

-- Create Role Responsibility & Experience Templates Table
CREATE TABLE IF NOT EXISTS role_responsibility_templates (
    id SERIAL PRIMARY KEY,
    job_role VARCHAR(150) UNIQUE NOT NULL,
    categories JSONB NOT NULL DEFAULT '[]',
    experience_work_summary TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Experience Letters Table (Individual Employee Certificate Snapshot)
CREATE TABLE IF NOT EXISTS experience_letters (
    id SERIAL PRIMARY KEY,
    letter_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    joining_date DATE NOT NULL,
    relieving_date DATE NOT NULL,

    salutation VARCHAR(20) NOT NULL DEFAULT 'Mr.',
    employee_name_snapshot VARCHAR(150) NOT NULL,
    employee_id_snapshot VARCHAR(50) NOT NULL,
    employee_email_snapshot VARCHAR(150),
    employee_phone_snapshot VARCHAR(20),
    employee_address_snapshot TEXT,

    job_title_snapshot VARCHAR(150) NOT NULL,
    department_snapshot VARCHAR(100),

    monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    salary_in_words VARCHAR(255),

    paragraph_1_snapshot TEXT,
    paragraph_2_snapshot TEXT,
    paragraph_3_snapshot TEXT,
    paragraph_4_snapshot TEXT,
    paragraph_5_snapshot TEXT,

    company_name_snapshot VARCHAR(200),
    header_address_snapshot TEXT,
    header_phone_snapshot VARCHAR(50),
    header_email_snapshot VARCHAR(100),
    header_website_snapshot VARCHAR(100),
    footer_line_1_snapshot TEXT,
    footer_line_2_snapshot TEXT,
    footer_line_3_snapshot TEXT,
    signatory_name VARCHAR(150) DEFAULT 'Dr. Mueen Ahmed KK',
    signatory_designation VARCHAR(150) DEFAULT 'Authorized Signatory',
    signatory_email VARCHAR(150) DEFAULT 'connect@mstechnomedia.com',

    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    generated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_experience_letters_emp_id ON experience_letters(employee_id);
CREATE INDEX IF NOT EXISTS idx_experience_letters_status ON experience_letters(status);
CREATE INDEX IF NOT EXISTS idx_experience_letters_num ON experience_letters(letter_number);

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
    morning_shift_start_time TIME DEFAULT '09:30',
    morning_late_after_time TIME DEFAULT '09:45',
    morning_shift_end_time TIME DEFAULT '13:30',
    lunch_start_time TIME DEFAULT '13:30',
    lunch_end_time TIME DEFAULT '14:00',
    evening_shift_start_time TIME DEFAULT '14:00',
    evening_late_after_time TIME DEFAULT '14:00',
    evening_shift_end_time TIME DEFAULT '17:30',
    admin_assistant_enabled BOOLEAN DEFAULT FALSE,
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


-- Migration: 01_add_manual_attendance_columns.sql

-- Add Manual Attendance and check-in/check-out status columns safely
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC(10,2) DEFAULT 0;


-- Migration: 01_hr_payroll_expenses.sql

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


-- Migration: 02_add_device_tracking_columns.sql

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS trusted_device_id VARCHAR(255), ADD COLUMN IF NOT EXISTS device_source VARCHAR(50), ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;

-- Migration: 02_payroll_hours_expansion.sql

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


-- Migration: 02_update_attendance_default.sql

-- Drop existing check constraint if any
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_attendance_status_check;

-- Add updated check constraint to include 'Not Mention'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_attendance_status_check 
CHECK (attendance_status IN ('Present', 'Late', 'Half Day', 'Absent', 'Work From Home', 'Not Mention'));

-- Update default attendance status
ALTER TABLE attendance 
ALTER COLUMN attendance_status SET DEFAULT 'Not Mention';

-- Safe backfill of existing default absent records that haven't been acted upon
UPDATE attendance
SET attendance_status = 'Not Mention'
WHERE LOWER(attendance_status) IN ('absent', 'a')
AND login_time IS NULL
AND logout_time IS NULL
AND (absent_reason IS NULL OR TRIM(absent_reason) = '');

SELECT 'Migration to Not Mention status completed successfully!' AS message;


-- Migration: 03_fix_attendance_not_mention.sql

-- Drop existing check constraint if any
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_attendance_status_check;

-- Add updated check constraint to include 'Not Mention'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_attendance_status_check 
CHECK (attendance_status IN ('Present', 'Late', 'Half Day', 'Absent', 'Work From Home', 'Not Mention'));

-- Update default attendance status
ALTER TABLE attendance 
ALTER COLUMN attendance_status SET DEFAULT 'Not Mention';

-- Safe backfill of existing default absent records that haven't been acted upon
UPDATE attendance
SET attendance_status = 'Not Mention'
WHERE LOWER(TRIM(attendance_status)) IN ('absent', 'a')
AND (login_time IS NULL)
AND (logout_time IS NULL)
AND (absent_reason IS NULL OR TRIM(absent_reason) = '');

SELECT 'Migration to Not Mention status completed successfully!' AS message;


-- Migration: 04_add_half_day_loss_amount.sql

-- Add half_day_loss_amount column to payroll_records
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS half_day_loss_amount DECIMAL(10,2) DEFAULT 0;


-- Migration: 05_add_admin_theme.sql

-- Add theme_preference column
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark';

-- Update existing records
UPDATE admins
SET theme_preference = 'dark'
WHERE theme_preference IS NULL
   OR theme_preference NOT IN ('dark', 'light');

-- Set not null constraint
ALTER TABLE admins
ALTER COLUMN theme_preference SET NOT NULL;

-- Add check constraint for allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admins_theme_preference_check'
  ) THEN
    ALTER TABLE admins
    ADD CONSTRAINT admins_theme_preference_check
    CHECK (theme_preference IN ('dark', 'light'));
  END IF;
END $$;


-- Migration: 06_add_employee_joining_date.sql

-- 06_add_employee_joining_date.sql
-- Description: Adds joining_date to employees table

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS joining_date DATE;


-- Migration: 07_update_expenses.sql

-- 1. Ensure default expense types exist
INSERT INTO expense_types (name, description, is_active) VALUES 
('Editorial Expenses', 'Expenses related to editorial work', true),
('Freelancer', 'Payments to freelancers', true),
('Office Staff', 'Office staff related expenses', true),
('Rent', 'Office rent', true),
('Reviewer Expenses', 'Payments to reviewers', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Add requested columns to monthly_expenses if missing
ALTER TABLE monthly_expenses
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid', NULL)),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Migrate existing data from old columns to new columns safely
UPDATE monthly_expenses
SET 
  name = COALESCE(name, title),
  payment_status = COALESCE(payment_status, status),
  payment_method = COALESCE(payment_method, payment_mode),
  notes = COALESCE(notes, description)
WHERE name IS NULL;

-- 4. Alter column constraints if necessary (make new name required)
-- We won't strictly enforce NOT NULL on new columns immediately just in case, but data should be mapped.

-- 1. Ensure default expense types exist
INSERT INTO expense_types (name, description, is_active) VALUES 
('Editorial Expenses', 'Expenses related to editorial work', true),
('Freelancer', 'Payments to freelancers', true),
('Office Staff', 'Office staff related expenses', true),
('Rent', 'Office rent', true),
('Reviewer Expenses', 'Payments to reviewers', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Add requested columns to monthly_expenses if missing
ALTER TABLE monthly_expenses
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid', NULL)),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Migrate existing data from old columns to new columns safely
UPDATE monthly_expenses
SET 
  name = COALESCE(name, title),
  payment_status = COALESCE(payment_status, status),
  payment_method = COALESCE(payment_method, payment_mode),
  notes = COALESCE(notes, description)
WHERE name IS NULL;

-- 4. Alter column constraints if necessary (make new name required)
-- We won't strictly enforce NOT NULL on new columns immediately just in case, but data should be mapped.

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS is_manual_edited BOOLEAN DEFAULT false;




-- Migration: 08_update_payroll_records.sql

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS is_manual_edited BOOLEAN DEFAULT false;


-- Migration: 09_fix_payroll_unique_constraint.sql

-- 09_fix_payroll_unique_constraint.sql

-- Drop the singular unique constraint if it accidentally exists
ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_employee_id_key;

-- Drop the composite unique constraint if it already exists, to safely re-create it
ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_employee_id_payroll_month_payroll_year_key;

-- Add the correct composite unique constraint
ALTER TABLE payroll_records ADD CONSTRAINT payroll_records_employee_id_payroll_month_payroll_year_key UNIQUE (employee_id, payroll_month, payroll_year);


-- Migration: 10_add_report_snapshots.sql

CREATE TABLE IF NOT EXISTS report_snapshots (
  id SERIAL PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  attendance_matrix JSONB,
  absent_table JSONB,
  holiday_table JSONB,
  generated_by INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, year)
);


-- Migration: add_electron_validation_mode.sql

-- Add new columns to settings for Electron Desktop Validation Mode
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS electron_desktop_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS electron_desktop_validation_mode VARCHAR(80) DEFAULT 'trusted_device_and_network';


-- Migration: electron_trusted_device_migration.sql

-- Add new columns to trusted_devices
ALTER TABLE trusted_devices
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key TEXT,
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT,
ADD COLUMN IF NOT EXISTS desktop_hostname TEXT,
ADD COLUMN IF NOT EXISTS desktop_platform TEXT,
ADD COLUMN IF NOT EXISTS electron_app_version TEXT,
ADD COLUMN IF NOT EXISTS desktop_signature_verified_at TIMESTAMP;

-- Add unique index on employee_id and desktop_public_key_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_employee_desktop_key
ON trusted_devices(employee_id, desktop_public_key_hash)
WHERE desktop_public_key_hash IS NOT NULL;

-- Add new columns to attendance
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS trusted_device_id INTEGER REFERENCES trusted_devices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;

-- Migration: 09_add_employee_personal_details.sql

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS aadhar_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone_number VARCHAR(20);


-- --- Content from 01_add_manual_attendance_columns.sql ---

-- Add Manual Attendance and check-in/check-out status columns safely
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC(10,2) DEFAULT 0;


-- --- Content from 01_hr_payroll_expenses.sql ---

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


-- --- Content from 02_add_device_tracking_columns.sql ---

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS trusted_device_id VARCHAR(255), ADD COLUMN IF NOT EXISTS device_source VARCHAR(50), ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;

-- --- Content from 02_payroll_hours_expansion.sql ---

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


-- --- Content from 02_update_attendance_default.sql ---

-- Drop existing check constraint if any
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_attendance_status_check;

-- Add updated check constraint to include 'Not Mention'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_attendance_status_check 
CHECK (attendance_status IN ('Present', 'Late', 'Half Day', 'Absent', 'Work From Home', 'Not Mention'));

-- Update default attendance status
ALTER TABLE attendance 
ALTER COLUMN attendance_status SET DEFAULT 'Not Mention';

-- Safe backfill of existing default absent records that haven't been acted upon
UPDATE attendance
SET attendance_status = 'Not Mention'
WHERE LOWER(attendance_status) IN ('absent', 'a')
AND login_time IS NULL
AND logout_time IS NULL
AND (absent_reason IS NULL OR TRIM(absent_reason) = '');

SELECT 'Migration to Not Mention status completed successfully!' AS message;


-- --- Content from 03_fix_attendance_not_mention.sql ---

-- Drop existing check constraint if any
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_attendance_status_check;

-- Add updated check constraint to include 'Not Mention'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_attendance_status_check 
CHECK (attendance_status IN ('Present', 'Late', 'Half Day', 'Absent', 'Work From Home', 'Not Mention'));

-- Update default attendance status
ALTER TABLE attendance 
ALTER COLUMN attendance_status SET DEFAULT 'Not Mention';

-- Safe backfill of existing default absent records that haven't been acted upon
UPDATE attendance
SET attendance_status = 'Not Mention'
WHERE LOWER(TRIM(attendance_status)) IN ('absent', 'a')
AND (login_time IS NULL)
AND (logout_time IS NULL)
AND (absent_reason IS NULL OR TRIM(absent_reason) = '');

SELECT 'Migration to Not Mention status completed successfully!' AS message;


-- --- Content from 04_add_half_day_loss_amount.sql ---

-- Add half_day_loss_amount column to payroll_records
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS half_day_loss_amount DECIMAL(10,2) DEFAULT 0;


-- --- Content from 05_add_admin_theme.sql ---

-- Add theme_preference column
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark';

-- Update existing records
UPDATE admins
SET theme_preference = 'dark'
WHERE theme_preference IS NULL
   OR theme_preference NOT IN ('dark', 'light');

-- Set not null constraint
ALTER TABLE admins
ALTER COLUMN theme_preference SET NOT NULL;

-- Add check constraint for allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admins_theme_preference_check'
  ) THEN
    ALTER TABLE admins
    ADD CONSTRAINT admins_theme_preference_check
    CHECK (theme_preference IN ('dark', 'light'));
  END IF;
END $$;


-- --- Content from 06_add_employee_joining_date.sql ---

-- 06_add_employee_joining_date.sql
-- Description: Adds joining_date to employees table

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS joining_date DATE;


-- --- Content from 07_update_expenses.sql ---

-- 1. Ensure default expense types exist
INSERT INTO expense_types (name, description, is_active) VALUES 
('Editorial Expenses', 'Expenses related to editorial work', true),
('Freelancer', 'Payments to freelancers', true),
('Office Staff', 'Office staff related expenses', true),
('Rent', 'Office rent', true),
('Reviewer Expenses', 'Payments to reviewers', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Add requested columns to monthly_expenses if missing
ALTER TABLE monthly_expenses
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid', NULL)),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Migrate existing data from old columns to new columns safely
UPDATE monthly_expenses
SET 
  name = COALESCE(name, title),
  payment_status = COALESCE(payment_status, status),
  payment_method = COALESCE(payment_method, payment_mode),
  notes = COALESCE(notes, description)
WHERE name IS NULL;

-- 4. Alter column constraints if necessary (make new name required)
-- We won't strictly enforce NOT NULL on new columns immediately just in case, but data should be mapped.


-- --- Content from 08_update_payroll_records.sql ---

ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS is_manual_edited BOOLEAN DEFAULT false;


-- --- Content from 09_add_employee_permissions.sql ---

-- Migration: 09_add_employee_permissions.sql
-- Description: Creates the employee_permissions table

CREATE TABLE IF NOT EXISTS employee_permissions (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    employee_name VARCHAR(150),
    department_name VARCHAR(100),
    permission_date DATE NOT NULL,
    from_time TIME NOT NULL,
    to_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'approved',
    created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_by_admin_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_time_order CHECK (to_time > from_time),
    CONSTRAINT check_duration_positive CHECK (duration_minutes > 0),
    UNIQUE(employee_id, permission_date, from_time, to_time)
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_date ON employee_permissions(permission_date);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee ON employee_permissions(employee_id);

SELECT 'Employee Permissions table created successfully!' AS message;


-- --- Content from 10_add_report_snapshots.sql ---

CREATE TABLE IF NOT EXISTS report_snapshots (
  id SERIAL PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  attendance_matrix JSONB,
  absent_table JSONB,
  holiday_table JSONB,
  generated_by INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, year)
);


-- --- Content from 11_add_employee_personal_details.sql ---

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS aadhar_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone_number VARCHAR(20);


-- --- Content from 12_add_admin_rbac.sql ---

-- 1. Update admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'));

UPDATE admins SET role = 'super_admin', is_super_admin = true;

-- 2. Create admin_pages table
CREATE TABLE IF NOT EXISTS admin_pages (
  id SERIAL PRIMARY KEY,
  page_key VARCHAR(100) UNIQUE NOT NULL,
  page_name VARCHAR(150) NOT NULL,
  route_path VARCHAR(200) NOT NULL,
  sidebar_section VARCHAR(100),
  icon_key VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  page_key VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  can_clear BOOLEAN DEFAULT false,
  can_calculate BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_id, page_key)
);

-- 4. Seed admin_pages
INSERT INTO admin_pages (page_key, page_name, route_path, sidebar_section, sort_order)
VALUES
('dashboard', 'Dashboard', '/admin/dashboard', 'Overview', 1),
('employees', 'Employees', '/admin/employees', 'People', 2),
('departments', 'Departments', '/admin/departments', 'People', 3),
('admin_management', 'Admin Management', '/admin/admin-management', 'People', 4),
('attendance', 'Attendance', '/admin/attendance', 'Time & Attendance', 5),
('manual_attendance', 'Manual Attendance', '/admin/manual-attendance', 'Time & Attendance', 6),
('absent_reasons', 'Absent Reasons', '/admin/absent-reasons', 'Time & Attendance', 7),
('holidays', 'Holidays', '/admin/holidays', 'Time & Attendance', 8),
('payroll', 'Payroll', '/admin/payroll', 'HR & Finance', 9),
('expenses', 'Expenses', '/admin/expenses', 'HR & Finance', 10),
('reports', 'Reports', '/admin/reports', 'HR & Finance', 11),
('permissions', 'Permissions', '/admin/permissions', 'Time & Attendance', 12),
('settings', 'Settings', '/admin/settings', 'System', 13),
('manage', 'Manage', '/admin/manage', 'System', 14),
('database_monitor', 'Database Monitor', '/admin/database-monitor', 'System', 15),
('trusted_devices', 'Trusted Devices', '/admin/trusted-devices', 'System', 16),
('activity_logs', 'Activity Logs', '/admin/activity-logs', 'System', 17),
('otp_settings', 'OTP Settings', '/admin/otp-settings', 'System', 18),
('security_logs', 'Security Logs', '/admin/security-logs', 'System', 19)
ON CONFLICT (page_key) DO NOTHING;


-- --- Content from add_electron_validation_mode.sql ---

-- Add new columns to settings for Electron Desktop Validation Mode
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS electron_desktop_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS electron_desktop_validation_mode VARCHAR(80) DEFAULT 'trusted_device_and_network';


-- --- Content from electron_trusted_device_migration.sql ---

-- Add new columns to trusted_devices
ALTER TABLE trusted_devices
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key TEXT,
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT,
ADD COLUMN IF NOT EXISTS desktop_hostname TEXT,
ADD COLUMN IF NOT EXISTS desktop_platform TEXT,
ADD COLUMN IF NOT EXISTS electron_app_version TEXT,
ADD COLUMN IF NOT EXISTS desktop_signature_verified_at TIMESTAMP;

-- Add unique index on employee_id and desktop_public_key_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_employee_desktop_key
ON trusted_devices(employee_id, desktop_public_key_hash)
WHERE desktop_public_key_hash IS NOT NULL;

-- Add new columns to attendance
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS trusted_device_id INTEGER REFERENCES trusted_devices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;


-- --- Content from 09_add_employee_personal_details.sql ---

-- Migration: 09_add_employee_personal_details.sql
-- Description: Adds personal, identity, and bank account details columns to the employees table.

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS aadhar_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone_number VARCHAR(20);


-- Migration: 01_add_manual_attendance_columns.sql
-- Add Manual Attendance and check-in/check-out status columns safely
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC(10,2) DEFAULT 0;


-- Migration: 01_hr_payroll_expenses.sql
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


-- Migration: 02_add_device_tracking_columns.sql
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS trusted_device_id VARCHAR(255), ADD COLUMN IF NOT EXISTS device_source VARCHAR(50), ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;

-- Migration: 02_payroll_hours_expansion.sql
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


-- Migration: 02_update_attendance_default.sql
-- Drop existing check constraint if any
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_attendance_status_check;

-- Add updated check constraint to include 'Not Mention'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_attendance_status_check 
CHECK (attendance_status IN ('Present', 'Late', 'Half Day', 'Absent', 'Work From Home', 'Not Mention'));

-- Update default attendance status
ALTER TABLE attendance 
ALTER COLUMN attendance_status SET DEFAULT 'Not Mention';

-- Safe backfill of existing default absent records that haven't been acted upon
UPDATE attendance
SET attendance_status = 'Not Mention'
WHERE LOWER(attendance_status) IN ('absent', 'a')
AND login_time IS NULL
AND logout_time IS NULL
AND (absent_reason IS NULL OR TRIM(absent_reason) = '');

SELECT 'Migration to Not Mention status completed successfully!' AS message;


-- Migration: 03_fix_attendance_not_mention.sql
-- Drop existing check constraint if any
ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_attendance_status_check;

-- Add updated check constraint to include 'Not Mention'
ALTER TABLE attendance 
ADD CONSTRAINT attendance_attendance_status_check 
CHECK (attendance_status IN ('Present', 'Late', 'Half Day', 'Absent', 'Work From Home', 'Not Mention'));

-- Update default attendance status
ALTER TABLE attendance 
ALTER COLUMN attendance_status SET DEFAULT 'Not Mention';

-- Safe backfill of existing default absent records that haven't been acted upon
UPDATE attendance
SET attendance_status = 'Not Mention'
WHERE LOWER(TRIM(attendance_status)) IN ('absent', 'a')
AND (login_time IS NULL)
AND (logout_time IS NULL)
AND (absent_reason IS NULL OR TRIM(absent_reason) = '');

SELECT 'Migration to Not Mention status completed successfully!' AS message;


-- Migration: 04_add_half_day_loss_amount.sql
-- Add half_day_loss_amount column to payroll_records
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS half_day_loss_amount DECIMAL(10,2) DEFAULT 0;


-- Migration: 05_add_admin_theme.sql
-- Add theme_preference column
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark';

-- Update existing records
UPDATE admins
SET theme_preference = 'dark'
WHERE theme_preference IS NULL
   OR theme_preference NOT IN ('dark', 'light');

-- Set not null constraint
ALTER TABLE admins
ALTER COLUMN theme_preference SET NOT NULL;

-- Add check constraint for allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admins_theme_preference_check'
  ) THEN
    ALTER TABLE admins
    ADD CONSTRAINT admins_theme_preference_check
    CHECK (theme_preference IN ('dark', 'light'));
  END IF;
END $$;


-- Migration: 06_add_employee_joining_date.sql
-- 06_add_employee_joining_date.sql
-- Description: Adds joining_date to employees table

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS joining_date DATE;


-- Migration: 07_update_expenses.sql
-- 1. Ensure default expense types exist
INSERT INTO expense_types (name, description, is_active) VALUES 
('Editorial Expenses', 'Expenses related to editorial work', true),
('Freelancer', 'Payments to freelancers', true),
('Office Staff', 'Office staff related expenses', true),
('Rent', 'Office rent', true),
('Reviewer Expenses', 'Payments to reviewers', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Add requested columns to monthly_expenses if missing
ALTER TABLE monthly_expenses
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'unpaid', NULL)),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Migrate existing data from old columns to new columns safely
UPDATE monthly_expenses
SET 
  name = COALESCE(name, title),
  payment_status = COALESCE(payment_status, status),
  payment_method = COALESCE(payment_method, payment_mode),
  notes = COALESCE(notes, description)
WHERE name IS NULL;

-- 4. Alter column constraints if necessary (make new name required)
-- We won't strictly enforce NOT NULL on new columns immediately just in case, but data should be mapped.


-- Migration: 08_update_payroll_records.sql
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS is_manual_edited BOOLEAN DEFAULT false;


-- Migration: 09_add_employee_permissions.sql
-- Migration: 09_add_employee_permissions.sql
-- Description: Creates the employee_permissions table

CREATE TABLE IF NOT EXISTS employee_permissions (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    employee_name VARCHAR(150),
    department_name VARCHAR(100),
    permission_date DATE NOT NULL,
    from_time TIME NOT NULL,
    to_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'approved',
    created_by_admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_by_admin_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_time_order CHECK (to_time > from_time),
    CONSTRAINT check_duration_positive CHECK (duration_minutes > 0),
    UNIQUE(employee_id, permission_date, from_time, to_time)
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_date ON employee_permissions(permission_date);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee ON employee_permissions(employee_id);

SELECT 'Employee Permissions table created successfully!' AS message;


-- Migration: 10_add_report_snapshots.sql
CREATE TABLE IF NOT EXISTS report_snapshots (
  id SERIAL PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  attendance_matrix JSONB,
  absent_table JSONB,
  holiday_table JSONB,
  generated_by INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, year)
);


-- Migration: 11_add_employee_personal_details.sql
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS aadhar_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone_number VARCHAR(20);


-- Migration: 12_add_admin_rbac.sql
-- 1. Update admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'));

UPDATE admins SET role = 'super_admin', is_super_admin = true;

-- 2. Create admin_pages table
CREATE TABLE IF NOT EXISTS admin_pages (
  id SERIAL PRIMARY KEY,
  page_key VARCHAR(100) UNIQUE NOT NULL,
  page_name VARCHAR(150) NOT NULL,
  route_path VARCHAR(200) NOT NULL,
  sidebar_section VARCHAR(100),
  icon_key VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  page_key VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  can_clear BOOLEAN DEFAULT false,
  can_calculate BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_id, page_key)
);

-- 4. Seed admin_pages
INSERT INTO admin_pages (page_key, page_name, route_path, sidebar_section, sort_order)
VALUES
('dashboard', 'Dashboard', '/admin/dashboard', 'Overview', 1),
('employees', 'Employees', '/admin/employees', 'People', 2),
('departments', 'Departments', '/admin/departments', 'People', 3),
('admin_management', 'Admin Management', '/admin/admin-management', 'People', 4),
('attendance', 'Attendance', '/admin/attendance', 'Time & Attendance', 5),
('manual_attendance', 'Manual Attendance', '/admin/manual-attendance', 'Time & Attendance', 6),
('absent_reasons', 'Absent Reasons', '/admin/absent-reasons', 'Time & Attendance', 7),
('holidays', 'Holidays', '/admin/holidays', 'Time & Attendance', 8),
('payroll', 'Payroll', '/admin/payroll', 'HR & Finance', 9),
('expenses', 'Expenses', '/admin/expenses', 'HR & Finance', 10),
('reports', 'Reports', '/admin/reports', 'HR & Finance', 11),
('permissions', 'Permissions', '/admin/permissions', 'Time & Attendance', 12),
('settings', 'Settings', '/admin/settings', 'System', 13),
('manage', 'Manage', '/admin/manage', 'System', 14),
('database_monitor', 'Database Monitor', '/admin/database-monitor', 'System', 15),
('trusted_devices', 'Trusted Devices', '/admin/trusted-devices', 'System', 16),
('activity_logs', 'Activity Logs', '/admin/activity-logs', 'System', 17),
('otp_settings', 'OTP Settings', '/admin/otp-settings', 'System', 18),
('security_logs', 'Security Logs', '/admin/security-logs', 'System', 19)
ON CONFLICT (page_key) DO NOTHING;


-- Migration: 13_add_shift_settings.sql
-- Migration: 13_add_shift_settings.sql
-- Description: Adds shift late calculation columns to settings table

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS morning_shift_start_time TIME DEFAULT '09:30',
ADD COLUMN IF NOT EXISTS morning_late_after_time TIME DEFAULT '09:45',
ADD COLUMN IF NOT EXISTS morning_shift_end_time TIME DEFAULT '13:30',
ADD COLUMN IF NOT EXISTS lunch_start_time TIME DEFAULT '13:30',
ADD COLUMN IF NOT EXISTS lunch_end_time TIME DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS evening_shift_start_time TIME DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS evening_late_after_time TIME DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS evening_shift_end_time TIME DEFAULT '17:30';

SELECT 'Shift settings columns added successfully!' AS message;


-- Migration: add_electron_validation_mode.sql
-- Add new columns to settings for Electron Desktop Validation Mode
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS electron_desktop_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS electron_desktop_validation_mode VARCHAR(80) DEFAULT 'trusted_device_and_network';


-- Migration: electron_trusted_device_migration.sql
-- Add new columns to trusted_devices
ALTER TABLE trusted_devices
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key TEXT,
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT,
ADD COLUMN IF NOT EXISTS desktop_hostname TEXT,
ADD COLUMN IF NOT EXISTS desktop_platform TEXT,
ADD COLUMN IF NOT EXISTS electron_app_version TEXT,
ADD COLUMN IF NOT EXISTS desktop_signature_verified_at TIMESTAMP;

-- Add unique index on employee_id and desktop_public_key_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_employee_desktop_key
ON trusted_devices(employee_id, desktop_public_key_hash)
WHERE desktop_public_key_hash IS NOT NULL;

-- Add new columns to attendance
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS trusted_device_id INTEGER REFERENCES trusted_devices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS device_source VARCHAR(40) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS desktop_public_key_hash TEXT;


-- Migration: 14_add_admin_assistant_setting.sql
-- Description: Adds admin_assistant_enabled column to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS admin_assistant_enabled BOOLEAN DEFAULT FALSE;

-- Migration: 10_create_payroll_email_logs.sql
CREATE TABLE IF NOT EXISTS payroll_email_logs (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50),
  employee_name VARCHAR(255),
  employee_email VARCHAR(255),
  payroll_id INTEGER NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  subject TEXT,
  status VARCHAR(30) NOT NULL,
  provider VARCHAR(50) DEFAULT 'gmail_smtp',
  provider_message_id TEXT NULL,
  smtp_response TEXT NULL,
  accepted_recipients TEXT NULL,
  rejected_recipients TEXT NULL,
  error_message TEXT NULL,
  sent_by VARCHAR(100) NULL,
  sent_by_name VARCHAR(255) NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_employee_id ON payroll_email_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_month_year ON payroll_email_logs(month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_status ON payroll_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_email_type ON payroll_email_logs(email_type);


-- Employee Personal Details Columns
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS aadhar_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS personal_email VARCHAR(150);


-- Employee Loans System Schema
CREATE TABLE IF NOT EXISTS employee_loans (
    id SERIAL PRIMARY KEY,
    loan_code VARCHAR(50) UNIQUE NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_code VARCHAR(100) NOT NULL,
    total_loan_amount_paise BIGINT NOT NULL CHECK (total_loan_amount_paise > 0),
    repayment_months INTEGER NOT NULL CHECK (repayment_months > 0),
    monthly_scheduled_deduction_paise BIGINT NOT NULL CHECK (monthly_scheduled_deduction_paise > 0),
    total_posted_deduction_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_posted_deduction_paise >= 0),
    remaining_balance_paise BIGINT NOT NULL CHECK (remaining_balance_paise >= 0),
    loan_issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    first_deduction_month INTEGER NOT NULL CHECK (first_deduction_month BETWEEN 1 AND 12),
    first_deduction_year INTEGER NOT NULL CHECK (first_deduction_year >= 2020),
    expected_completion_month INTEGER NOT NULL CHECK (expected_completion_month BETWEEN 1 AND 12),
    expected_completion_year INTEGER NOT NULL CHECK (expected_completion_year >= 2020),
    completed_instalments INTEGER NOT NULL DEFAULT 0 CHECK (completed_instalments >= 0),
    remaining_planned_instalments INTEGER NOT NULL CHECK (remaining_planned_instalments >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Active', 'Completed', 'Cancelled')),
    calculation_mode VARCHAR(50) NOT NULL DEFAULT 'by_months',
    remarks TEXT,
    cancellation_reason TEXT,
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    last_processed_month INTEGER,
    last_processed_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_employee_loans_emp_id ON employee_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_status ON employee_loans(status);
CREATE INDEX IF NOT EXISTS idx_employee_loans_first_period ON employee_loans(first_deduction_year, first_deduction_month);

CREATE TABLE IF NOT EXISTS loan_repayment_transactions (
    id SERIAL PRIMARY KEY,
    transaction_code VARCHAR(50) UNIQUE NOT NULL,
    loan_id INTEGER NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    payroll_record_id INTEGER REFERENCES payroll_records(id) ON DELETE SET NULL,
    payroll_month INTEGER NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
    payroll_year INTEGER NOT NULL CHECK (payroll_year >= 2020),
    scheduled_deduction_paise BIGINT NOT NULL CHECK (scheduled_deduction_paise >= 0),
    actual_deducted_paise BIGINT NOT NULL CHECK (actual_deducted_paise >= 0),
    shortfall_paise BIGINT NOT NULL DEFAULT 0 CHECK (shortfall_paise >= 0),
    balance_before_paise BIGINT NOT NULL CHECK (balance_before_paise >= 0),
    balance_after_paise BIGINT NOT NULL CHECK (balance_after_paise >= 0),
    posting_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'Posted' CHECK (status IN ('Posted', 'Partially Posted', 'Skipped', 'Reversed')),
    created_by_system BOOLEAN NOT NULL DEFAULT TRUE,
    reversal_date TIMESTAMP WITH TIME ZONE,
    reversal_reason TEXT,
    reversal_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_loan_repayment_month UNIQUE (loan_id, payroll_month, payroll_year)
);

CREATE INDEX IF NOT EXISTS idx_loan_tx_loan_id ON loan_repayment_transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_tx_period ON loan_repayment_transactions(payroll_year, payroll_month);
CREATE INDEX IF NOT EXISTS idx_loan_tx_status ON loan_repayment_transactions(status);

CREATE TABLE IF NOT EXISTS loan_scheduler_batch_logs (
    id SERIAL PRIMARY KEY,
    batch_code VARCHAR(50) UNIQUE NOT NULL,
    payroll_month INTEGER NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
    payroll_year INTEGER NOT NULL CHECK (payroll_year >= 2020),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_employees_checked INTEGER DEFAULT 0,
    total_loans_processed INTEGER DEFAULT 0,
    total_posted INTEGER DEFAULT 0,
    total_partially_posted INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    failure_details JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'Running' CHECK (status IN ('Running', 'Completed', 'Completed with Errors', 'Failed'))
);

CREATE INDEX IF NOT EXISTS idx_loan_batch_period ON loan_scheduler_batch_logs(payroll_year, payroll_month);

ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_deduction_status VARCHAR(30) DEFAULT 'Not Applicable';


-- Developer Testing Settings & PIN Table
CREATE TABLE IF NOT EXISTS developer_settings (
    id SERIAL PRIMARY KEY,
    developer_pin_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO developer_settings (id, developer_pin_hash)
SELECT 1, '$2b$10$pbXAzn7gknd59XxH3gTM6uA05kdV4R2BFTtRRdOhTiTV7zVcODtQK'
WHERE NOT EXISTS (SELECT 1 FROM developer_settings WHERE id = 1);

-- Resigned / Former Employees Table
CREATE TABLE IF NOT EXISTS resigned_employees (
    id SERIAL PRIMARY KEY,
    original_id INTEGER,
    employee_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    job_role VARCHAR(100) NOT NULL,
    mobile VARCHAR(15),
    email VARCHAR(150),
    personal_email VARCHAR(150),
    password VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Resigned',
    date_of_birth DATE,
    joining_date DATE,
    resigned_date DATE DEFAULT CURRENT_DATE,
    resigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monthly_salary NUMERIC(12,2) DEFAULT 0,
    basic_salary NUMERIC(12,2) DEFAULT 0,
    hra NUMERIC(12,2) DEFAULT 0,
    special_allowance NUMERIC(12,2) DEFAULT 0,
    staff_advance NUMERIC(12,2) DEFAULT 0,
    professional_tax NUMERIC(12,2) DEFAULT 0,
    tds NUMERIC(12,2) DEFAULT 0,
    bank_name VARCHAR(150),
    bank_address TEXT,
    account_holder_name VARCHAR(150),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    pan_card_number VARCHAR(20),
    aadhar_card_number VARCHAR(20),
    permanent_address TEXT,
    alternate_phone_number VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resigned_emp_id ON resigned_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_resigned_date ON resigned_employees(resigned_date);

-- PDF Template & Company Branding Settings Table
CREATE TABLE IF NOT EXISTS pdf_template_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL DEFAULT 'Manuscript Technomedia LLP',
    logo_path VARCHAR(500),
    logo_width INTEGER NOT NULL DEFAULT 32,
    logo_height INTEGER NOT NULL DEFAULT 32,
    company_name_font_size NUMERIC(4,1) NOT NULL DEFAULT 17.0,
    registered_office_address TEXT NOT NULL DEFAULT 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pdf_template_settings (id, company_name, logo_path, logo_width, logo_height, company_name_font_size, registered_office_address)
SELECT 1, 'Manuscript Technomedia LLP', NULL, 32, 32, 17.0, 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.'
WHERE NOT EXISTS (SELECT 1 FROM pdf_template_settings WHERE id = 1);

