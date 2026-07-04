-- 09_fix_payroll_unique_constraint.sql

-- Drop the singular unique constraint if it accidentally exists
ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_employee_id_key;

-- Drop the composite unique constraint if it already exists, to safely re-create it
ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_employee_id_payroll_month_payroll_year_key;

-- Add the correct composite unique constraint
ALTER TABLE payroll_records ADD CONSTRAINT payroll_records_employee_id_payroll_month_payroll_year_key UNIQUE (employee_id, payroll_month, payroll_year);
