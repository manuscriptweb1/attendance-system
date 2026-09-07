-- =========================================================================================
-- SCRIPT: fix_production_payroll_breakdown.sql
-- PURPOSE: Fix existing mismatched salary breakdowns in production `payroll_records`
--          Ensures Basic (50%), HRA (20%), and Special Allowance (30%) equal Monthly Earning
-- =========================================================================================

-- 1. View mismatched pending/unfinalized records before update:
SELECT 
    id, 
    employee_code, 
    payroll_month, 
    payroll_year, 
    status,
    monthly_earning, 
    basic_salary, 
    hra, 
    special_allowance,
    (basic_salary + hra + special_allowance) as breakdown_sum,
    ROUND((monthly_earning - (basic_salary + hra + special_allowance))::numeric, 2) as discrepancy,
    net_payable
FROM payroll_records
WHERE status = 'pending' 
  AND ABS((basic_salary + hra + special_allowance) - monthly_earning) > 0.01;

-- 2. Safely fix all pending payroll records to align 50% Basic, 20% HRA, remainder Special Allowance:
UPDATE payroll_records
SET 
  basic_salary = ROUND((monthly_earning * 0.50)::numeric, 2),
  hra = ROUND((monthly_earning * 0.20)::numeric, 2),
  special_allowance = ROUND((monthly_earning - ROUND((monthly_earning * 0.50)::numeric, 2) - ROUND((monthly_earning * 0.20)::numeric, 2))::numeric, 2),
  updated_at = CURRENT_TIMESTAMP
WHERE status = 'pending' 
  AND ABS((basic_salary + hra + special_allowance) - monthly_earning) > 0.01;

-- 3. Verify that 0 mismatched pending rows remain:
SELECT COUNT(*) as remaining_mismatched_records
FROM payroll_records
WHERE status = 'pending' 
  AND ABS((basic_salary + hra + special_allowance) - monthly_earning) > 0.01;
