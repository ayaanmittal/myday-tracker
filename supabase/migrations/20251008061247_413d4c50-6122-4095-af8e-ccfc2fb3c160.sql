-- Create office_rules table
CREATE TABLE public.office_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create rule_acknowledgments table
CREATE TABLE public.rule_acknowledgments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.office_rules(id) ON DELETE CASCADE,
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, rule_id)
);

-- Create rule_violations table
CREATE TABLE public.rule_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.office_rules(id) ON DELETE CASCADE,
  warning_level integer NOT NULL CHECK (warning_level IN (1, 2, 3)),
  reason text,
  flagged_by uuid NOT NULL,
  flagged_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.office_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for office_rules
CREATE POLICY "Everyone can view active rules"
  ON public.office_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage rules"
  ON public.office_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for rule_acknowledgments
CREATE POLICY "Users can view own acknowledgments"
  ON public.rule_acknowledgments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own acknowledgments"
  ON public.rule_acknowledgments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all acknowledgments"
  ON public.rule_acknowledgments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for rule_violations
CREATE POLICY "Users can view own violations"
  ON public.rule_violations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all violations"
  ON public.rule_violations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updating updated_at
CREATE TRIGGER update_office_rules_updated_at
  BEFORE UPDATE ON public.office_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();