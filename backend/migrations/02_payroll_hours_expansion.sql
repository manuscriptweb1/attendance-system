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
