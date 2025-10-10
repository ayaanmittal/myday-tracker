-- Add missing UPDATE and DELETE policies for rule_contracts table
-- Users need to be able to update and delete their own contracts

CREATE POLICY "Users can update own contract"
  ON public.rule_contracts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contract"
  ON public.rule_contracts FOR DELETE
  USING (auth.uid() = user_id);

-- Add missing UPDATE policy for rule_acknowledgments table
-- Users need to be able to update their own acknowledgments for upsert operations

CREATE POLICY "Users can update own acknowledgments"
  ON public.rule_acknowledgments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
