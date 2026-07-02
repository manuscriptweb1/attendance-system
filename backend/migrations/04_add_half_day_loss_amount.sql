-- Add half_day_loss_amount column to payroll_records
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS half_day_loss_amount DECIMAL(10,2) DEFAULT 0;
