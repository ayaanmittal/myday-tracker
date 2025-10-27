-- Add computed columns for remaining_days and probation_remaining_days

-- First, drop the existing columns if they exist
ALTER TABLE leave_balances DROP COLUMN IF EXISTS remaining_days;
ALTER TABLE leave_balances DROP COLUMN IF EXISTS probation_remaining_days;

-- Add computed columns that automatically calculate remaining days
ALTER TABLE leave_balances 
ADD COLUMN remaining_days INTEGER GENERATED ALWAYS AS (allocated_days - used_days) STORED;

ALTER TABLE leave_balances 
ADD COLUMN probation_remaining_days INTEGER GENERATED ALWAYS AS (probation_allocated_days - probation_used_days) STORED;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_leave_type ON leave_balances(leave_type_id);
