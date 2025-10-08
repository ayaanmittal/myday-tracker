-- Clean migration for conversations and messages tables
-- This migration creates both tables from scratch without conflicts

-- Drop existing tables and all dependencies first
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- Drop all related functions
DROP FUNCTION IF EXISTS public.get_or_create_conversation(UUID, UUID);
DROP FUNCTION IF EXISTS public.update_conversation_last_message();
DROP FUNCTION IF EXISTS public.update_conversations_updated_at();

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique conversation between two users
  UNIQUE(participant_1, participant_2),
  -- Ensure participant_1 is always the smaller UUID for consistency
  CHECK (participant_1 <= participant_2)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversations
CREATE POLICY "conversations_policy"
  ON public.conversations FOR ALL
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2)
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Create RLS policies for messages
CREATE POLICY "messages_policy"
  ON public.messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

-- Create function to get or create conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user1_id UUID,
  user2_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_id UUID;
  p1 UUID;
  p2 UUID;
BEGIN
  -- Ensure consistent ordering (smaller UUID first)
  IF user1_id < user2_id THEN
    p1 := user1_id;
    p2 := user2_id;
  ELSE
    p1 := user2_id;
    p2 := user1_id;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO conversation_id
  FROM public.conversations
  WHERE participant_1 = p1 AND participant_2 = p2;

  -- Create conversation if it doesn't exist
  IF conversation_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2)
    VALUES (p1, p2)
    RETURNING id INTO conversation_id;
  END IF;

  RETURN conversation_id;
END;
$$;

-- Create function to update conversation when new message is added
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the conversation with the new message info
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_id = NEW.id,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_conversations_participants ON public.conversations(participant_1, participant_2);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
