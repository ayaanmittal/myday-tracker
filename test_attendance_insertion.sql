-- Test the TeamOffice attendance processing function
-- Run this after creating the function above

-- Example 1: Process Sakshi's record
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

-- Example 2: Process another employee record
SELECT * FROM process_teamoffice_attendance(
    '0007', -- Empcode
    'John Doe', -- Name
    '09:30', -- INTime
    '18:00', -- OUTTime
    '08:30', -- WorkTime
    '00:00', -- OverTime
    '01:00', -- BreakTime
    'P', -- Status
    '08/10/2025', -- DateString
    '', -- Remark
    '00:00', -- Erl_Out
    '00:00', -- Late_In
    '{"Empcode":"0007","INTime":"09:30","OUTTime":"18:00","WorkTime":"08:30","OverTime":"00:00","BreakTime":"01:00","Status":"P","DateString":"08/10/2025","Remark":"","Erl_Out":"00:00","Late_In":"00:00","Name":"John Doe"}'::jsonb
);

-- Check the results
SELECT 
    'attendance_logs' as table_name,
    COUNT(*) as record_count
FROM attendance_logs 
WHERE source = 'teamoffice' 
AND log_time >= '2025-10-08'::date
UNION ALL
SELECT 
    'day_entries' as table_name,
    COUNT(*) as record_count
FROM day_entries 
WHERE entry_date = '2025-10-08';

-- View the inserted data
SELECT 
    employee_id,
    employee_name,
    log_time,
    log_type,
    source
FROM attendance_logs 
WHERE source = 'teamoffice' 
AND log_time >= '2025-10-08'::date
ORDER BY employee_id, log_time;

SELECT 
    user_id,
    entry_date,
    check_in_at,
    check_out_at,
    total_work_time_minutes,
    status
FROM day_entries 
WHERE entry_date = '2025-10-08'
ORDER BY user_id;


















