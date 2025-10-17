-- Add phone and address fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.phone IS 'Employee phone number';
COMMENT ON COLUMN public.profiles.address IS 'Employee address';