-- Bulk Employee Mapping SQL Script
-- This script helps you map TeamOffice employees to your users

-- Step 1: View all TeamOffice employees that need mapping
SELECT 
    te.emp_code,
    te.name as teamoffice_name,
    te.email as teamoffice_email,
    te.department,
    te.designation,
    CASE 
        WHEN em.teamoffice_emp_code IS NOT NULL THEN 'MAPPED'
        ELSE 'UNMAPPED'
    END as mapping_status
FROM teamoffice_employees te
LEFT JOIN employee_mappings em ON em.teamoffice_emp_code = te.emp_code
WHERE te.is_active = true
ORDER BY mapping_status, te.name;

-- Step 2: View all your users for matching
SELECT 
    id,
    name,
    email,
    designation,
    team
FROM profiles 
WHERE is_active = true
ORDER BY name;

-- Step 3: Find potential matches using name similarity
-- This uses a simple name matching approach
WITH potential_matches AS (
    SELECT 
        te.emp_code,
        te.name as teamoffice_name,
        p.id as our_user_id,
        p.name as our_user_name,
        p.email as our_user_email,
        -- Simple name similarity calculation
        CASE 
            WHEN LOWER(te.name) = LOWER(p.name) THEN 1.0
            WHEN LOWER(te.name) LIKE '%' || LOWER(p.name) || '%' THEN 0.8
            WHEN LOWER(p.name) LIKE '%' || LOWER(te.name) || '%' THEN 0.8
            WHEN LENGTH(te.name) > 3 AND LENGTH(p.name) > 3 AND 
                 LOWER(SUBSTRING(te.name, 1, 3)) = LOWER(SUBSTRING(p.name, 1, 3)) THEN 0.6
            WHEN LOWER(te.name) LIKE LOWER(p.name) || '%' THEN 0.7
            WHEN LOWER(p.name) LIKE LOWER(te.name) || '%' THEN 0.7
            ELSE 0.0
        END as match_score
    FROM teamoffice_employees te
    CROSS JOIN profiles p
    WHERE te.is_active = true 
    AND p.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM employee_mappings em 
        WHERE em.teamoffice_emp_code = te.emp_code
    )
)
SELECT 
    emp_code,
    teamoffice_name,
    our_user_id,
    our_user_name,
    our_user_email,
    match_score,
    CASE 
        WHEN match_score >= 0.9 THEN 'HIGH_CONFIDENCE'
        WHEN match_score >= 0.6 THEN 'MEDIUM_CONFIDENCE'
        WHEN match_score >= 0.3 THEN 'LOW_CONFIDENCE'
        ELSE 'NO_MATCH'
    END as confidence_level
FROM potential_matches
WHERE match_score > 0.3
ORDER BY emp_code, match_score DESC;

-- Step 4: Create mappings for high confidence matches (90%+)
-- WARNING: Review the results above before running this!
INSERT INTO employee_mappings (
    teamoffice_emp_code,
    teamoffice_name,
    our_user_id,
    our_profile_id,
    is_active
)
SELECT 
    pm.emp_code,
    pm.teamoffice_name,
    pm.our_user_id,
    pm.our_user_id, -- profiles.id = auth.users.id
    true
FROM (
    WITH potential_matches AS (
        SELECT 
            te.emp_code,
            te.name as teamoffice_name,
            p.id as our_user_id,
            p.name as our_user_name,
            CASE 
                WHEN LOWER(te.name) = LOWER(p.name) THEN 1.0
                WHEN LOWER(te.name) LIKE '%' || LOWER(p.name) || '%' THEN 0.8
                WHEN LOWER(p.name) LIKE '%' || LOWER(te.name) || '%' THEN 0.8
                WHEN LENGTH(te.name) > 3 AND LENGTH(p.name) > 3 AND 
                     LOWER(SUBSTRING(te.name, 1, 3)) = LOWER(SUBSTRING(p.name, 1, 3)) THEN 0.6
                WHEN LOWER(te.name) LIKE LOWER(p.name) || '%' THEN 0.7
                WHEN LOWER(p.name) LIKE LOWER(te.name) || '%' THEN 0.7
                ELSE 0.0
            END as match_score
        FROM teamoffice_employees te
        CROSS JOIN profiles p
        WHERE te.is_active = true 
        AND p.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM employee_mappings em 
            WHERE em.teamoffice_emp_code = te.emp_code
        )
    )
    SELECT 
        emp_code,
        teamoffice_name,
        our_user_id,
        ROW_NUMBER() OVER (PARTITION BY emp_code ORDER BY match_score DESC) as rn
    FROM potential_matches
    WHERE match_score >= 0.9
) pm
WHERE pm.rn = 1 -- Only take the best match for each employee
ON CONFLICT (teamoffice_emp_code) 
DO UPDATE SET
    teamoffice_name = EXCLUDED.teamoffice_name,
    our_user_id = EXCLUDED.our_user_id,
    our_profile_id = EXCLUDED.our_profile_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Step 5: Verify the mappings were created
SELECT 
    em.teamoffice_emp_code,
    em.teamoffice_name,
    p.name as our_user_name,
    p.email as our_user_email,
    em.created_at
FROM employee_mappings em
LEFT JOIN profiles p ON p.id = em.our_user_id
WHERE em.is_active = true
ORDER BY em.teamoffice_name;

-- Step 6: Show remaining unmapped employees
SELECT 
    te.emp_code,
    te.name as teamoffice_name,
    te.email as teamoffice_email,
    te.department,
    te.designation
FROM teamoffice_employees te
WHERE te.is_active = true
AND NOT EXISTS (
    SELECT 1 FROM employee_mappings em 
    WHERE em.teamoffice_emp_code = te.emp_code
    AND em.is_active = true
)
ORDER BY te.name;

-- Step 7: Manual mapping template
-- Use this template to manually create mappings for specific employees
-- Replace the values with actual data
/*
INSERT INTO employee_mappings (
    teamoffice_emp_code,
    teamoffice_name,
    our_user_id,
    our_profile_id,
    is_active
) VALUES (
    'EMP_CODE_HERE',        -- TeamOffice employee code
    'TEAMOFFICE_NAME',      -- TeamOffice employee name
    'USER_ID_HERE',         -- Your user's ID from profiles table
    'USER_ID_HERE',         -- Same user ID (profiles.id = auth.users.id)
    true
) ON CONFLICT (teamoffice_emp_code) 
DO UPDATE SET
    teamoffice_name = EXCLUDED.teamoffice_name,
    our_user_id = EXCLUDED.our_user_id,
    our_profile_id = EXCLUDED.our_profile_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();
*/

-- Step 8: Test the mapping by processing attendance data
-- This will use the new mappings to process TeamOffice attendance records
SELECT 
    'Testing attendance processing with new mappings...' as status;

-- You can now run your attendance processing function
-- SELECT * FROM process_teamoffice_attendance(...);
