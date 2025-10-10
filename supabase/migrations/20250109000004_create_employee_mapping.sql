-- Create employee mapping table to link TeamOffice employees with our database users
CREATE TABLE IF NOT EXISTS employee_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teamoffice_emp_code TEXT NOT NULL UNIQUE,
  teamoffice_name TEXT,
  teamoffice_email TEXT,
  our_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  our_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_employee_mappings_teamoffice_code 
ON employee_mappings (teamoffice_emp_code);

CREATE INDEX IF NOT EXISTS idx_employee_mappings_our_user_id 
ON employee_mappings (our_user_id);

-- Create table to store TeamOffice employee data
CREATE TABLE IF NOT EXISTS teamoffice_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_code TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  department TEXT,
  designation TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE employee_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teamoffice_employees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employee_mappings
CREATE POLICY "Users can view own mapping"
  ON employee_mappings FOR SELECT
  USING (our_user_id = auth.uid());

CREATE POLICY "Admins can manage all mappings"
  ON employee_mappings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create RLS policies for teamoffice_employees
CREATE POLICY "Admins can view all teamoffice employees"
  ON teamoffice_employees FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage teamoffice employees"
  ON teamoffice_employees FOR ALL
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_employee_mappings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_teamoffice_employees_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER update_employee_mappings_updated_at
  BEFORE UPDATE ON employee_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_mappings_updated_at();

CREATE TRIGGER update_teamoffice_employees_updated_at
  BEFORE UPDATE ON teamoffice_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_teamoffice_employees_updated_at();

-- Create function to get employee mapping
CREATE OR REPLACE FUNCTION get_employee_mapping(p_teamoffice_emp_code TEXT)
RETURNS TABLE (
  our_user_id UUID,
  our_profile_id UUID,
  teamoffice_name TEXT,
  our_name TEXT,
  our_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.our_user_id,
    em.our_profile_id,
    em.teamoffice_name,
    p.name as our_name,
    p.email as our_email
  FROM employee_mappings em
  LEFT JOIN profiles p ON em.our_profile_id = p.id
  WHERE em.teamoffice_emp_code = p_teamoffice_emp_code
    AND em.is_active = true;
END;
$$;

-- Create function to sync TeamOffice employees
CREATE OR REPLACE FUNCTION sync_teamoffice_employees(p_employees JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  emp JSONB;
  inserted_count INTEGER := 0;
BEGIN
  -- Loop through each employee in the JSON array
  FOR emp IN SELECT * FROM jsonb_array_elements(p_employees)
  LOOP
    -- Insert or update employee
    INSERT INTO teamoffice_employees (
      emp_code,
      name,
      email,
      department,
      designation,
      is_active,
      last_synced_at
    )
    VALUES (
      COALESCE(emp->>'EmpCode', ''),
      emp->>'Name',
      emp->>'Email',
      emp->>'Department',
      emp->>'Designation',
      COALESCE((emp->>'IsActive')::boolean, true),
      now()
    )
    ON CONFLICT (emp_code) 
    DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      department = EXCLUDED.department,
      designation = EXCLUDED.designation,
      is_active = EXCLUDED.is_active,
      last_synced_at = now(),
      updated_at = now();
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$;

-- Create function to create employee mapping
CREATE OR REPLACE FUNCTION create_employee_mapping(
  p_teamoffice_emp_code TEXT,
  p_our_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  mapping_id UUID;
  profile_id UUID;
BEGIN
  -- Get profile ID for the user
  SELECT id INTO profile_id FROM profiles WHERE id = p_our_user_id;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', p_our_user_id;
  END IF;
  
  -- Create mapping
  INSERT INTO employee_mappings (
    teamoffice_emp_code,
    our_user_id,
    our_profile_id,
    is_active
  )
  VALUES (
    p_teamoffice_emp_code,
    p_our_user_id,
    profile_id,
    true
  )
  ON CONFLICT (teamoffice_emp_code) 
  DO UPDATE SET
    our_user_id = EXCLUDED.our_user_id,
    our_profile_id = EXCLUDED.our_profile_id,
    is_active = true,
    updated_at = now()
  RETURNING id INTO mapping_id;
  
  RETURN mapping_id;
END;
$$;
