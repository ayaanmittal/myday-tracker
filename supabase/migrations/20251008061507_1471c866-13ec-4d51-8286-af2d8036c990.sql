-- Create rule_contracts table for first-time acknowledgment
CREATE TABLE public.rule_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  initials text NOT NULL,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rule_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rule_contracts
CREATE POLICY "Users can view own contract"
  ON public.rule_contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contract"
  ON public.rule_contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all contracts"
  ON public.rule_contracts FOR SELECT
  USING (has_role(auth.uid(), 'admin'));