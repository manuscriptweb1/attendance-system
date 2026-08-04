-- Migration: 10_create_payroll_email_logs.sql
-- Description: Creates payroll_email_logs table to store email logs for payslip and transactional emails.

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
  sent_by INTEGER NULL,
  sent_by_name VARCHAR(255) NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_employee_id ON payroll_email_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_month_year ON payroll_email_logs(month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_status ON payroll_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_email_type ON payroll_email_logs(email_type);
