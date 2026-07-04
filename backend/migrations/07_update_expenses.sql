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


