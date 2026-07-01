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
