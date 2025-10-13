-- Create employee mappings data
-- This migration creates the necessary employee mappings to link TeamOffice employees with our database users

-- Insert employee mappings based on the profiles we found
INSERT INTO employee_mappings (
  teamoffice_emp_code,
  teamoffice_name,
  our_user_id,
  our_profile_id,
  is_active
) VALUES 
  ('0005', 'Hiralal', '4d8ab840-efdf-437c-b836-242198244198', '4d8ab840-efdf-437c-b836-242198244198', true),
  ('0008', 'Jasspreet', '668618a1-1425-4c6c-8c91-872480b5696e', '668618a1-1425-4c6c-8c91-872480b5696e', true),
  ('0012', 'Dolly', '5d9bb940-0431-4b81-a7d5-7759c91c69b5', '5d9bb940-0431-4b81-a7d5-7759c91c69b5', true),
  ('0013', 'Isha', 'b7a7c54b-eeaf-47ab-bcb8-8e22bdf38dc0', 'b7a7c54b-eeaf-47ab-bcb8-8e22bdf38dc0', true),
  ('0015', 'Ayaan', '596441e8-c05d-4c81-b19f-e1cb1e8fe460', '596441e8-c05d-4c81-b19f-e1cb1e8fe460', true)
ON CONFLICT (teamoffice_emp_code) DO UPDATE SET
  teamoffice_name = EXCLUDED.teamoffice_name,
  our_user_id = EXCLUDED.our_user_id,
  our_profile_id = EXCLUDED.our_profile_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Show the created mappings
SELECT 
  'Employee mappings created' as status,
  teamoffice_emp_code,
  teamoffice_name,
  our_user_id,
  our_profile_id,
  is_active
FROM employee_mappings
ORDER BY teamoffice_emp_code;
