-- Add missing DELETE policies for admins

-- Allow admins to delete all acknowledgments
CREATE POLICY "Admins can delete all acknowledgments"
  ON public.rule_acknowledgments FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to delete all contracts
CREATE POLICY "Admins can delete all contracts"
  ON public.rule_contracts FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update acknowledgments (for completeness)
CREATE POLICY "Admins can update all acknowledgments"
  ON public.rule_acknowledgments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update contracts (for completeness)
CREATE POLICY "Admins can update all contracts"
  ON public.rule_contracts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Add columns to track rule changes
ALTER TABLE public.office_rules 
ADD COLUMN is_newly_added BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.office_rules 
ADD COLUMN is_recently_updated BOOLEAN NOT NULL DEFAULT false;

-- Create a table to track rule changes for each user
CREATE TABLE public.rule_change_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.office_rules(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('added', 'updated')),
  notified_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, rule_id, change_type)
);

-- Enable RLS for rule_change_notifications
ALTER TABLE public.rule_change_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rule_change_notifications
CREATE POLICY "Users can view own notifications"
  ON public.rule_change_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.rule_change_notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'));

