-- Add Manual Attendance and check-in/check-out status columns safely
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS checkin_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS checkout_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_working_hours NUMERIC(10,2) DEFAULT 0;
