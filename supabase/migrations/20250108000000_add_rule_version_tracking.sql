-- Add version tracking to office_rules table
ALTER TABLE public.office_rules 
ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add last_updated_by to track who modified the rule
ALTER TABLE public.office_rules 
ADD COLUMN last_updated_by UUID REFERENCES auth.users(id);

-- Add a flag to track if rule was recently updated
ALTER TABLE public.office_rules 
ADD COLUMN recently_updated BOOLEAN NOT NULL DEFAULT false;

-- Create function to reset all acknowledgments when rules change
CREATE OR REPLACE FUNCTION reset_rule_acknowledgments()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all existing acknowledgments for active rules
  DELETE FROM public.rule_acknowledgments 
  WHERE rule_id IN (
    SELECT id FROM public.office_rules WHERE is_active = true
  );
  
  -- Delete all existing contracts (users need to re-sign)
  DELETE FROM public.rule_contracts;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rule updates
CREATE OR REPLACE TRIGGER trigger_reset_acknowledgments_on_rule_update
  AFTER UPDATE ON public.office_rules
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description)
  EXECUTE FUNCTION reset_rule_acknowledgments();

-- Create trigger for rule creation
CREATE OR REPLACE TRIGGER trigger_reset_acknowledgments_on_rule_insert
  AFTER INSERT ON public.office_rules
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION reset_rule_acknowledgments();

-- Create function to check if user has unacknowledged rules
CREATE OR REPLACE FUNCTION user_has_unacknowledged_rules(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  unacknowledged_count INTEGER;
  total_active_rules INTEGER;
BEGIN
  -- Count total active rules
  SELECT COUNT(*) INTO total_active_rules
  FROM public.office_rules
  WHERE is_active = true;
  
  -- If no active rules, user is considered up to date
  IF total_active_rules = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Count acknowledged rules for this user
  SELECT COUNT(*) INTO unacknowledged_count
  FROM public.rule_acknowledgments ra
  JOIN public.office_rules or ON ra.rule_id = or.id
  WHERE ra.user_id = user_uuid AND or.is_active = true;
  
  -- Return true if user has fewer acknowledgments than total active rules
  RETURN unacknowledged_count < total_active_rules;
END;
$$ LANGUAGE plpgsql;

-- Create function to get unacknowledged rules for a user
CREATE OR REPLACE FUNCTION get_unacknowledged_rules(user_uuid UUID)
RETURNS TABLE (
  rule_id UUID,
  title TEXT,
  description TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  recently_updated BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    or.id as rule_id,
    or.title,
    or.description,
    or.version,
    or.created_at,
    or.updated_at,
    or.recently_updated
  FROM public.office_rules or
  WHERE or.is_active = true
    AND or.id NOT IN (
      SELECT ra.rule_id 
      FROM public.rule_acknowledgments ra 
      WHERE ra.user_id = user_uuid
    )
  ORDER BY or.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Update existing rules to have version 1
UPDATE public.office_rules SET version = 1 WHERE version IS NULL;
