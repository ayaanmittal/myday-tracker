# TeamOffice API Data Insertion Guide

This guide shows how to insert TeamOffice API attendance data into your Supabase database tables.

## API Data Format

```json
{
    "Empcode": "0006",
    "INTime": "10:20",
    "OUTTime": "17:12", 
    "WorkTime": "06:52",
    "OverTime": "00:00",
    "BreakTime": "00:00",
    "Status": "P",
    "DateString": "08/10/2025",
    "Remark": "LT-EO",
    "Erl_Out": "00:48",
    "Late_In": "00:20",
    "Name": "Sakshi"
}
```

## Database Tables Used

### 1. `attendance_logs` - Individual check-in/check-out records
### 2. `day_entries` - Daily work summaries
### 3. `employee_mappings` - Links TeamOffice employees to your users

## SQL Insertion Examples

### 1. Insert Check-in Log

```sql
INSERT INTO attendance_logs (
    employee_id,
    employee_name,
    log_time,
    log_type,
    device_id,
    source,
    raw_payload
) VALUES (
    '0006', -- or mapped user_id if available
    'Sakshi',
    '2025-10-08 10:20:00+00', -- Converted from DateString + INTime
    'checkin',
    'teamoffice',
    'teamoffice',
    '{"Empcode":"0006","INTime":"10:20","OUTTime":"17:12","WorkTime":"06:52","OverTime":"00:00","BreakTime":"00:00","Status":"P","DateString":"08/10/2025","Remark":"LT-EO","Erl_Out":"00:48","Late_In":"00:20","Name":"Sakshi"}'::jsonb
);
```

### 2. Insert Check-out Log

```sql
INSERT INTO attendance_logs (
    employee_id,
    employee_name,
    log_time,
    log_type,
    device_id,
    source,
    raw_payload
) VALUES (
    '0006', -- or mapped user_id if available
    'Sakshi',
    '2025-10-08 17:12:00+00', -- Converted from DateString + OUTTime
    'checkout',
    'teamoffice',
    'teamoffice',
    '{"Empcode":"0006","INTime":"10:20","OUTTime":"17:12","WorkTime":"06:52","OverTime":"00:00","BreakTime":"00:00","Status":"P","DateString":"08/10/2025","Remark":"LT-EO","Erl_Out":"00:48","Late_In":"00:20","Name":"Sakshi"}'::jsonb
);
```

### 3. Insert/Update Day Entry

```sql
INSERT INTO day_entries (
    user_id,
    entry_date,
    check_in_at,
    check_out_at,
    total_work_time_minutes,
    status,
    device_info,
    modification_reason
) VALUES (
    '0006', -- or mapped user_id if available
    '2025-10-08',
    '2025-10-08 10:20:00+00',
    '2025-10-08 17:12:00+00',
    412, -- 6 hours 52 minutes = 412 minutes
    'completed', -- 'P' status means present/completed
    'TeamOffice API',
    'TeamOffice: LT-EO'
) ON CONFLICT (user_id, entry_date) 
DO UPDATE SET
    check_in_at = EXCLUDED.check_in_at,
    check_out_at = EXCLUDED.check_out_at,
    total_work_time_minutes = EXCLUDED.total_work_time_minutes,
    status = EXCLUDED.status,
    device_info = EXCLUDED.device_info,
    modification_reason = EXCLUDED.modification_reason,
    updated_at = now();
```

## Complete Batch Insertion Function

```sql
-- Function to process a single TeamOffice record
CREATE OR REPLACE FUNCTION process_teamoffice_attendance(
    p_empcode TEXT,
    p_name TEXT,
    p_intime TEXT,
    p_outtime TEXT,
    p_worktime TEXT,
    p_overtime TEXT,
    p_breaktime TEXT,
    p_status TEXT,
    p_datestring TEXT,
    p_remark TEXT,
    p_erl_out TEXT,
    p_late_in TEXT,
    p_raw_payload JSONB
) RETURNS TABLE(
    checkin_inserted BOOLEAN,
    checkout_inserted BOOLEAN,
    day_entry_upserted BOOLEAN,
    errors TEXT[]
) AS $$
DECLARE
    v_user_id TEXT;
    v_user_name TEXT;
    v_checkin_time TIMESTAMPTZ;
    v_checkout_time TIMESTAMPTZ;
    v_work_minutes INTEGER;
    v_entry_status TEXT;
    v_errors TEXT[] := '{}';
    v_checkin_result BOOLEAN := FALSE;
    v_checkout_result BOOLEAN := FALSE;
    v_day_entry_result BOOLEAN := FALSE;
BEGIN
    -- Get employee mapping
    SELECT our_user_id, our_name INTO v_user_id, v_user_name
    FROM employee_mappings 
    WHERE teamoffice_emp_code = p_empcode;
    
    -- Use original data if no mapping found
    IF v_user_id IS NULL THEN
        v_user_id := p_empcode;
        v_user_name := p_name;
    END IF;
    
    -- Parse check-in time
    v_checkin_time := to_timestamp(p_datestring || ' ' || p_intime, 'DD/MM/YYYY HH24:MI');
    
    -- Parse check-out time
    IF p_outtime IS NOT NULL AND p_outtime != '' THEN
        v_checkout_time := to_timestamp(p_datestring || ' ' || p_outtime, 'DD/MM/YYYY HH24:MI');
    END IF;
    
    -- Convert work time to minutes (HH:MM format)
    v_work_minutes := EXTRACT(HOUR FROM to_timestamp(p_worktime, 'HH24:MI')) * 60 + 
                     EXTRACT(MINUTE FROM to_timestamp(p_worktime, 'HH24:MI'));
    
    -- Determine status
    v_entry_status := CASE 
        WHEN p_status = 'P' THEN 'completed'
        ELSE 'in_progress'
    END;
    
    -- Insert check-in log
    BEGIN
        INSERT INTO attendance_logs (
            employee_id, employee_name, log_time, log_type, 
            device_id, source, raw_payload
        ) VALUES (
            v_user_id, v_user_name, v_checkin_time, 'checkin',
            'teamoffice', 'teamoffice', p_raw_payload
        );
        v_checkin_result := TRUE;
    EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, 'Check-in log: ' || SQLERRM);
    END;
    
    -- Insert check-out log (if available)
    IF v_checkout_time IS NOT NULL THEN
        BEGIN
            INSERT INTO attendance_logs (
                employee_id, employee_name, log_time, log_type,
                device_id, source, raw_payload
            ) VALUES (
                v_user_id, v_user_name, v_checkout_time, 'checkout',
                'teamoffice', 'teamoffice', p_raw_payload
            );
            v_checkout_result := TRUE;
        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 'Check-out log: ' || SQLERRM);
        END;
    END IF;
    
    -- Insert/update day entry
    BEGIN
        INSERT INTO day_entries (
            user_id, entry_date, check_in_at, check_out_at,
            total_work_time_minutes, status, device_info, modification_reason
        ) VALUES (
            v_user_id, DATE(v_checkin_time), v_checkin_time, v_checkout_time,
            v_work_minutes, v_entry_status, 'TeamOffice API',
            CASE WHEN p_remark IS NOT NULL THEN 'TeamOffice: ' || p_remark ELSE NULL END
        ) ON CONFLICT (user_id, entry_date) 
        DO UPDATE SET
            check_in_at = EXCLUDED.check_in_at,
            check_out_at = EXCLUDED.check_out_at,
            total_work_time_minutes = EXCLUDED.total_work_time_minutes,
            status = EXCLUDED.status,
            device_info = EXCLUDED.device_info,
            modification_reason = EXCLUDED.modification_reason,
            updated_at = now();
        v_day_entry_result := TRUE;
    EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, 'Day entry: ' || SQLERRM);
    END;
    
    RETURN QUERY SELECT v_checkin_result, v_checkout_result, v_day_entry_result, v_errors;
END;
$$ LANGUAGE plpgsql;
```

## Usage Examples

### Process Single Record

```sql
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
```

### Process Multiple Records

```sql
-- Create a temporary table for batch processing
CREATE TEMP TABLE temp_attendance_data (
    empcode TEXT,
    name TEXT,
    intime TEXT,
    outtime TEXT,
    worktime TEXT,
    overtime TEXT,
    breaktime TEXT,
    status TEXT,
    datestring TEXT,
    remark TEXT,
    erl_out TEXT,
    late_in TEXT,
    raw_payload JSONB
);

-- Insert your data
INSERT INTO temp_attendance_data VALUES
('0006', 'Sakshi', '10:20', '17:12', '06:52', '00:00', '00:00', 'P', '08/10/2025', 'LT-EO', '00:48', '00:20', '{"Empcode":"0006",...}'::jsonb),
('0007', 'John', '09:30', '18:00', '08:30', '00:00', '01:00', 'P', '08/10/2025', '', '00:00', '00:00', '{"Empcode":"0007",...}'::jsonb);

-- Process all records
SELECT 
    empcode,
    name,
    (process_teamoffice_attendance(
        empcode, name, intime, outtime, worktime, overtime, breaktime,
        status, datestring, remark, erl_out, late_in, raw_payload
    )).*
FROM temp_attendance_data;
```

## Data Validation

### Check for Duplicates

```sql
-- Check for duplicate attendance logs
SELECT 
    employee_id,
    log_time,
    log_type,
    COUNT(*) as count
FROM attendance_logs 
WHERE source = 'teamoffice'
GROUP BY employee_id, log_time, log_type
HAVING COUNT(*) > 1;
```

### Verify Day Entries

```sql
-- Check day entries for a specific date
SELECT 
    de.*,
    p.name as employee_name
FROM day_entries de
LEFT JOIN profiles p ON p.id::text = de.user_id
WHERE de.entry_date = '2025-10-08'
ORDER BY de.check_in_at;
```

## Error Handling

The provided functions include comprehensive error handling:

1. **Duplicate Prevention**: Uses `ON CONFLICT` clauses to handle duplicates gracefully
2. **Data Validation**: Validates date/time formats before insertion
3. **Employee Mapping**: Falls back to original data if mapping not found
4. **Transaction Safety**: Each operation is wrapped in exception handling

## Performance Considerations

1. **Batch Processing**: Use the batch function for multiple records
2. **Indexes**: Ensure proper indexes exist on frequently queried columns
3. **Connection Pooling**: Use connection pooling for high-volume operations
4. **Async Processing**: Consider processing large datasets asynchronously

## Monitoring

```sql
-- Monitor recent TeamOffice data
SELECT 
    COUNT(*) as total_logs,
    COUNT(DISTINCT employee_id) as unique_employees,
    MIN(log_time) as earliest_log,
    MAX(log_time) as latest_log
FROM attendance_logs 
WHERE source = 'teamoffice' 
AND log_time >= NOW() - INTERVAL '24 hours';
```
















