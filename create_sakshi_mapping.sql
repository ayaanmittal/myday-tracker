-- Create mapping for Sakshi (TeamOffice) to Sakshi Saglotia (our user)
-- Run this in Supabase SQL Editor

-- First, let's find Sakshi Saglotia's user ID
SELECT id, name, email 
FROM profiles 
WHERE name ILIKE '%sakshi%' 
AND is_active = true;

-- If you found the user, note their ID and run the mapping creation below
-- Replace 'USER_ID_HERE' with the actual user ID from the query above

-- Create the employee mapping
INSERT INTO employee_mappings (
    teamoffice_emp_code,
    teamoffice_name,
    our_user_id,
    our_profile_id,
    is_active
) VALUES (
    '0006', -- TeamOffice employee code
    'Sakshi', -- TeamOffice name
    'USER_ID_HERE', -- Replace with actual user ID from profiles table
    'USER_ID_HERE', -- Same user ID (profiles.id = auth.users.id)
    true
) ON CONFLICT (teamoffice_emp_code) 
DO UPDATE SET
    teamoffice_name = EXCLUDED.teamoffice_name,
    our_user_id = EXCLUDED.our_user_id,
    our_profile_id = EXCLUDED.our_profile_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Verify the mapping was created
SELECT 
    em.*,
    p.name as our_user_name,
    p.email as our_user_email
FROM employee_mappings em
LEFT JOIN profiles p ON p.id = em.our_user_id
WHERE em.teamoffice_emp_code = '0006';

-- Test the mapping by processing Sakshi's attendance record
SELECT * FROM process_teamoffice_attendance(
    '0006', -- Empcode
    'Sakshi', -- Name
    '10:20', -- INTime
    '17:12', -- OUTTime
    '06:52', -- WorkTime
    '00:00', -- OverTime
    '00:00', -- BreakTime
    'P', -- Status
    '08/10/2025', -- DateString
    'LT-EO', -- Remark
    '00:48', -- Erl_Out
    '00:20', -- Late_In
    '{"Empcode":"0006","INTime":"10:20","OUTTime":"17:12","WorkTime":"06:52","OverTime":"00:00","BreakTime":"00:00","Status":"P","DateString":"08/10/2025","Remark":"LT-EO","Erl_Out":"00:48","Late_In":"00:20","Name":"Sakshi"}'::jsonb
);

-- Check if the data was inserted with the correct user mapping
SELECT 
    al.employee_id,
    al.employee_name,
    al.log_time,
    al.log_type,
    p.name as mapped_user_name
FROM attendance_logs al
LEFT JOIN profiles p ON p.id::text = al.employee_id
WHERE al.source = 'teamoffice' 
AND al.employee_id = 'USER_ID_HERE' -- Replace with actual user ID
ORDER BY al.log_time;

SELECT 
    de.user_id,
    de.entry_date,
    de.check_in_at,
    de.check_out_at,
    de.total_work_time_minutes,
    de.status,
    p.name as mapped_user_name
FROM day_entries de
LEFT JOIN profiles p ON p.id::text = de.user_id
WHERE de.user_id = 'USER_ID_HERE' -- Replace with actual user ID
ORDER BY de.entry_date;




