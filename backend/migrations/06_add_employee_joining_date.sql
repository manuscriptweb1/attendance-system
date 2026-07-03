-- 06_add_employee_joining_date.sql
-- Description: Adds joining_date to employees table

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS joining_date DATE;
