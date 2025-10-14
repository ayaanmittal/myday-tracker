-- Function to auto-set default checkout time to 5 PM for employees who checked in but didn't check out
CREATE OR REPLACE FUNCTION auto_default_checkout()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_date_only date := CURRENT_DATE;
    default_checkout_time time := '17:00:00'; -- 5:00 PM
    default_checkout_datetime timestamp;
    record_count integer := 0;
BEGIN
    -- Set the default checkout datetime to 5 PM of the current date
    default_checkout_datetime := (current_date_only || ' ' || default_checkout_time)::timestamp;
    
    -- Update records that have check_in_time but no check_out_time for today
    UPDATE unified_attendance 
    SET 
        check_out_time = default_checkout_datetime,
        last_updated = NOW(),
        status = CASE 
            WHEN status = 'in_progress' THEN 'completed'
            ELSE status
        END
    WHERE 
        DATE(check_in_time) = current_date_only
        AND check_out_time IS NULL
        AND check_in_time IS NOT NULL;
    
    -- Get the count of updated records
    GET DIAGNOSTICS record_count = ROW_COUNT;
    
    -- Log the operation
    RAISE NOTICE 'Auto-default checkout: Updated % records for date % with checkout time %', 
        record_count, current_date_only, default_checkout_time;
    
    -- Insert a log entry
    INSERT INTO api_refresh_logs (operation, details, created_at)
    VALUES (
        'auto_default_checkout',
        json_build_object(
            'date', current_date_only,
            'default_checkout_time', default_checkout_time,
            'records_updated', record_count
        ),
        NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log any errors
        RAISE NOTICE 'Error in auto_default_checkout: %', SQLERRM;
        
        -- Insert error log
        INSERT INTO api_refresh_logs (operation, details, created_at)
        VALUES (
            'auto_default_checkout_error',
            json_build_object(
                'error', SQLERRM,
                'date', current_date_only
            ),
            NOW()
        );
        
        -- Re-raise the exception
        RAISE;
END;
$$;

-- Create a function to run this for a specific date
CREATE OR REPLACE FUNCTION auto_default_checkout_for_date(target_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    default_checkout_time time := '17:00:00'; -- 5:00 PM
    default_checkout_datetime timestamp;
    record_count integer := 0;
BEGIN
    -- Set the default checkout datetime to 5 PM of the target date
    default_checkout_datetime := (target_date || ' ' || default_checkout_time)::timestamp;
    
    -- Update records that have check_in_time but no check_out_time for the target date
    UPDATE unified_attendance 
    SET 
        check_out_time = default_checkout_datetime,
        last_updated = NOW(),
        status = CASE 
            WHEN status = 'in_progress' THEN 'completed'
            ELSE status
        END
    WHERE 
        DATE(check_in_time) = target_date
        AND check_out_time IS NULL
        AND check_in_time IS NOT NULL;
    
    -- Get the count of updated records
    GET DIAGNOSTICS record_count = ROW_COUNT;
    
    -- Log the operation
    RAISE NOTICE 'Auto-default checkout: Updated % records for date % with checkout time %', 
        record_count, target_date, default_checkout_time;
    
    -- Insert a log entry
    INSERT INTO api_refresh_logs (operation, details, created_at)
    VALUES (
        'auto_default_checkout_for_date',
        json_build_object(
            'target_date', target_date,
            'default_checkout_time', default_checkout_time,
            'records_updated', record_count
        ),
        NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log any errors
        RAISE NOTICE 'Error in auto_default_checkout_for_date: %', SQLERRM;
        
        -- Insert error log
        INSERT INTO api_refresh_logs (operation, details, created_at)
        VALUES (
            'auto_default_checkout_for_date_error',
            json_build_object(
                'error', SQLERRM,
                'target_date', target_date
            ),
            NOW()
        );
        
        -- Re-raise the exception
        RAISE;
END;
$$;

-- Create a function to run this for a date range
CREATE OR REPLACE FUNCTION auto_default_checkout_for_date_range(start_date date, end_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_date_iter date;
    default_checkout_time time := '17:00:00'; -- 5:00 PM
    default_checkout_datetime timestamp;
    record_count integer := 0;
    total_records integer := 0;
BEGIN
    -- Validate date range
    IF start_date > end_date THEN
        RAISE EXCEPTION 'Start date cannot be after end date';
    END IF;
    
    -- Iterate through each date in the range
    current_date_iter := start_date;
    
    WHILE current_date_iter <= end_date LOOP
        -- Set the default checkout datetime to 5 PM of the current iteration date
        default_checkout_datetime := (current_date_iter || ' ' || default_checkout_time)::timestamp;
        
        -- Update records that have check_in_time but no check_out_time for the current date
        UPDATE unified_attendance 
        SET 
            check_out_time = default_checkout_datetime,
            last_updated = NOW(),
            status = CASE 
                WHEN status = 'in_progress' THEN 'completed'
                ELSE status
            END
        WHERE 
            DATE(check_in_time) = current_date_iter
            AND check_out_time IS NULL
            AND check_in_time IS NOT NULL;
        
        -- Get the count of updated records for this date
        GET DIAGNOSTICS record_count = ROW_COUNT;
        total_records := total_records + record_count;
        
        -- Log the operation for this date
        RAISE NOTICE 'Auto-default checkout: Updated % records for date % with checkout time %', 
            record_count, current_date_iter, default_checkout_time;
        
        -- Move to next date
        current_date_iter := current_date_iter + INTERVAL '1 day';
    END LOOP;
    
    -- Insert a summary log entry
    INSERT INTO api_refresh_logs (operation, details, created_at)
    VALUES (
        'auto_default_checkout_for_date_range',
        json_build_object(
            'start_date', start_date,
            'end_date', end_date,
            'total_records_updated', total_records,
            'default_checkout_time', default_checkout_time
        ),
        NOW()
    );
    
    RAISE NOTICE 'Auto-default checkout completed for date range % to %. Total records updated: %', 
        start_date, end_date, total_records;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log any errors
        RAISE NOTICE 'Error in auto_default_checkout_for_date_range: %', SQLERRM;
        
        -- Insert error log
        INSERT INTO api_refresh_logs (operation, details, created_at)
        VALUES (
            'auto_default_checkout_for_date_range_error',
            json_build_object(
                'error', SQLERRM,
                'start_date', start_date,
                'end_date', end_date
            ),
            NOW()
        );
        
        -- Re-raise the exception
        RAISE;
END;
$$;

-- Create a trigger function to run this automatically at 11:59 PM daily
CREATE OR REPLACE FUNCTION trigger_auto_default_checkout()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Run the auto default checkout function
    PERFORM auto_default_checkout();
END;
$$;

-- Create a scheduled job to run this at 11:59 PM daily
-- Note: This requires pg_cron extension to be enabled
-- If pg_cron is not available, you can use a cron job or scheduled task instead

-- Example usage:
-- SELECT auto_default_checkout(); -- Run for today
-- SELECT auto_default_checkout_for_date('2025-01-15'); -- Run for specific date
-- SELECT auto_default_checkout_for_date_range('2025-01-01', '2025-01-31'); -- Run for date range

-- To create a cron job (if pg_cron is available):
-- SELECT cron.schedule('auto-default-checkout', '59 23 * * *', 'SELECT auto_default_checkout();');
