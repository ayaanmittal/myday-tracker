-- Simple test to verify the auto-fill functionality works
-- This script can be run directly in the database

-- Test 1: Check current stats
SELECT 'Current Stats:' as test_step;
SELECT * FROM get_unified_attendance_profile_stats();

-- Test 2: Check recent records with missing data
SELECT 'Recent Missing Records:' as test_step;
SELECT * FROM v_unified_attendance_missing_profile LIMIT 5;

-- Test 3: Run backfill for recent records
SELECT 'Running Backfill:' as test_step;
SELECT * FROM backfill_unified_attendance_profile_data(
    (CURRENT_DATE - INTERVAL '7 days')::DATE,
    CURRENT_DATE::DATE
);

-- Test 4: Check stats after backfill
SELECT 'Stats After Backfill:' as test_step;
SELECT * FROM get_unified_attendance_profile_stats();



