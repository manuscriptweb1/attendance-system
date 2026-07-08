-- Migration: 09_add_employee_personal_details.sql
-- Description: Adds personal, identity, and bank account details columns to the employees table.

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS aadhar_card_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS permanent_address TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone_number VARCHAR(20);
