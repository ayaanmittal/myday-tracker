-- Fix unified_attendance table to auto-fill profile_id, employee_code, and employee_name
-- This will ensure new entries have complete profile information

-- Step 1: Create function to auto-fill profile data
CREATE OR REPLACE FUNCTION auto_fill_unified_attendance_profile_data()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
    v_employee_code TEXT;
    v_employee_name TEXT;
    v_teamoffice_emp_code TEXT;
    v_teamoffice_name TEXT;
BEGIN
    -- Only process if profile_id is NULL or employee_code/employee_name are NULL
    IF NEW.profile_id IS NULL OR NEW.employee_code IS NULL OR NEW.employee_name IS NULL THEN
        
        -- Get profile_id from user_id (profiles.id = auth.users.id)
        SELECT id INTO v_profile_id
        FROM public.profiles 
        WHERE id = NEW.user_id;
        
        -- If profile exists, set profile_id
        IF v_profile_id IS NOT NULL THEN
            NEW.profile_id = v_profile_id;
            
            -- Get employee code and name from profiles table
            SELECT 
                p.name,
                te.emp_code,
                te.name
            INTO 
                v_employee_name,
                v_teamoffice_emp_code,
                v_teamoffice_name
            FROM public.profiles p
            LEFT JOIN public.teamoffice_employees te ON te.id = p.teamoffice_employees_id
            WHERE p.id = NEW.user_id;
            
            -- Set employee_code and employee_name if they're NULL
            IF NEW.employee_code IS NULL AND v_teamoffice_emp_code IS NOT NULL THEN
                NEW.employee_code = v_teamoffice_emp_code;
            END IF;
            
            IF NEW.employee_name IS NULL AND v_employee_name IS NOT NULL THEN
                NEW.employee_name = v_employee_name;
            END IF;
            
            -- If we still don't have employee_code/name, try to get from employee_mappings
            IF NEW.employee_code IS NULL OR NEW.employee_name IS NULL THEN
                SELECT 
                    em.teamoffice_emp_code,
                    em.teamoffice_name
                INTO 
                    v_teamoffice_emp_code,
                    v_teamoffice_name
                FROM public.employee_mappings em
                WHERE em.our_user_id = NEW.user_id
                AND em.is_active = true
                LIMIT 1;
                
                IF NEW.employee_code IS NULL AND v_teamoffice_emp_code IS NOT NULL THEN
                    NEW.employee_code = v_teamoffice_emp_code;
                END IF;
                
                IF NEW.employee_name IS NULL AND v_teamoffice_name IS NOT NULL THEN
                    NEW.employee_name = v_teamoffice_name;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger to auto-fill profile data on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_auto_fill_unified_attendance_profile ON public.unified_attendance;
CREATE TRIGGER trigger_auto_fill_unified_attendance_profile
  BEFORE INSERT OR UPDATE ON public.unified_attendance
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_unified_attendance_profile_data();

-- Step 3: Update existing records that are missing profile data
UPDATE public.unified_attendance ua
SET 
    profile_id = p.id,
    employee_code = COALESCE(ua.employee_code, te.emp_code, em.teamoffice_emp_code),
    employee_name = COALESCE(ua.employee_name, p.name, em.teamoffice_name)
FROM public.profiles p
LEFT JOIN public.teamoffice_employees te ON te.id = p.teamoffice_employees_id
LEFT JOIN public.employee_mappings em ON em.our_user_id = p.id AND em.is_active = true
WHERE ua.user_id = p.id
AND (ua.profile_id IS NULL OR ua.employee_code IS NULL OR ua.employee_name IS NULL);

-- Step 4: Create function to backfill missing profile data for existing records
CREATE OR REPLACE FUNCTION backfill_unified_attendance_profile_data(
    start_date_param DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date_param DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    processed_count INTEGER,
    updated_count INTEGER,
    error_count INTEGER
) AS $$
DECLARE
    attendance_record RECORD;
    v_profile_id UUID;
    v_employee_code TEXT;
    v_employee_name TEXT;
    v_teamoffice_emp_code TEXT;
    v_teamoffice_name TEXT;
    processed_count INTEGER := 0;
    updated_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Loop through attendance records that need profile data
    FOR attendance_record IN
        SELECT ua.id, ua.user_id, ua.profile_id, ua.employee_code, ua.employee_name
        FROM public.unified_attendance ua
        WHERE ua.entry_date BETWEEN start_date_param AND end_date_param
        AND (ua.profile_id IS NULL OR ua.employee_code IS NULL OR ua.employee_name IS NULL)
    LOOP
        processed_count := processed_count + 1;
        
        BEGIN
            -- Get profile data
            SELECT 
                p.id,
                p.name,
                te.emp_code,
                te.name
            INTO 
                v_profile_id,
                v_employee_name,
                v_teamoffice_emp_code,
                v_teamoffice_name
            FROM public.profiles p
            LEFT JOIN public.teamoffice_employees te ON te.id = p.teamoffice_employees_id
            WHERE p.id = attendance_record.user_id;
            
            -- If no profile found, try employee_mappings
            IF v_profile_id IS NULL THEN
                SELECT 
                    em.our_profile_id,
                    em.teamoffice_name,
                    em.teamoffice_emp_code
                INTO 
                    v_profile_id,
                    v_teamoffice_name,
                    v_teamoffice_emp_code
                FROM public.employee_mappings em
                WHERE em.our_user_id = attendance_record.user_id
                AND em.is_active = true
                LIMIT 1;
            END IF;
            
            -- Update the record
            UPDATE public.unified_attendance
            SET 
                profile_id = COALESCE(profile_id, v_profile_id),
                employee_code = COALESCE(employee_code, v_teamoffice_emp_code),
                employee_name = COALESCE(employee_name, v_employee_name, v_teamoffice_name)
            WHERE id = attendance_record.id;
            
            updated_count := updated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING 'Error processing attendance record %: %', attendance_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT processed_count, updated_count, error_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Run the backfill function for recent records
SELECT * FROM backfill_unified_attendance_profile_data(
    (CURRENT_DATE - INTERVAL '30 days')::DATE,
    CURRENT_DATE::DATE
);

-- Step 6: Create a view for easy monitoring of missing profile data
CREATE OR REPLACE VIEW v_unified_attendance_missing_profile AS
SELECT 
    ua.id,
    ua.user_id,
    ua.entry_date,
    ua.check_in_at,
    ua.profile_id,
    ua.employee_code,
    ua.employee_name,
    ua.source,
    ua.created_at,
    CASE 
        WHEN ua.profile_id IS NULL THEN 'Missing profile_id'
        WHEN ua.employee_code IS NULL THEN 'Missing employee_code'
        WHEN ua.employee_name IS NULL THEN 'Missing employee_name'
        ELSE 'Complete'
    END as missing_field
FROM public.unified_attendance ua
WHERE ua.profile_id IS NULL 
   OR ua.employee_code IS NULL 
   OR ua.employee_name IS NULL
ORDER BY ua.created_at DESC;

-- Step 7: Create function to monitor profile data completeness
CREATE OR REPLACE FUNCTION get_unified_attendance_profile_stats()
RETURNS TABLE(
    total_records BIGINT,
    complete_records BIGINT,
    missing_profile_id BIGINT,
    missing_employee_code BIGINT,
    missing_employee_name BIGINT,
    completion_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE profile_id IS NOT NULL AND employee_code IS NOT NULL AND employee_name IS NOT NULL) as complete_records,
        COUNT(*) FILTER (WHERE profile_id IS NULL) as missing_profile_id,
        COUNT(*) FILTER (WHERE employee_code IS NULL) as missing_employee_code,
        COUNT(*) FILTER (WHERE employee_name IS NULL) as missing_employee_name,
        ROUND(
            (COUNT(*) FILTER (WHERE profile_id IS NOT NULL AND employee_code IS NOT NULL AND employee_name IS NOT NULL)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as completion_rate
    FROM public.unified_attendance;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Show current stats
SELECT * FROM get_unified_attendance_profile_stats();
