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
    SELECT our_user_id, teamoffice_name INTO v_user_id, v_user_name
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
