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
