ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS is_manual_edited BOOLEAN DEFAULT false;
