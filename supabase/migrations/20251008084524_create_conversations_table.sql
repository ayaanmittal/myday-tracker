-- Create conversations table (idempotent)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique conversation between two users
  UNIQUE(participant_1, participant_2),
  -- Ensure participant_1 is always the smaller UUID for consistency, or equal for self-messages
  CHECK (participant_1 <= participant_2)
);

-- Add conversation_id column to existing messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Add updated_at column to existing messages table if it doesn't exist
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update the existing messages table structure to be compatible
-- First check if columns exist before renaming to avoid errors
DO $$ 
BEGIN
  -- Rename message column to content if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'messages' AND column_name = 'message') THEN
    ALTER TABLE public.messages RENAME COLUMN message TO content;
  END IF;
  
  -- Rename from_user_id column to sender_id if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'messages' AND column_name = 'from_user_id') THEN
    ALTER TABLE public.messages RENAME COLUMN from_user_id TO sender_id;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Consolidated RLS policies for conversations and messages
-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can create own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
-- Drop the new consolidated policies if they exist
DROP POLICY IF EXISTS "conversations_participants_policy" ON public.conversations;
DROP POLICY IF EXISTS "messages_conversation_policy" ON public.messages;

-- Create consolidated policies for conversations
CREATE POLICY "conversations_participants_policy"
  ON public.conversations FOR ALL
  USING (auth.uid() = conversations.participant_1 OR auth.uid() = conversations.participant_2)
  WITH CHECK (auth.uid() = conversations.participant_1 OR auth.uid() = conversations.participant_2);

-- Create consolidated policies for messages
CREATE POLICY "messages_conversation_policy"
  ON public.messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = messages.sender_id AND
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid()
    )
  );

-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.get_or_create_conversation(UUID, UUID);

-- Create function to get or create conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_user1_id UUID,
  p_user2_id UUID
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
  IF p_user1_id < p_user2_id THEN
    p1 := p_user1_id;
    p2 := p_user2_id;
  ELSE
    p1 := p_user2_id;
    p2 := p_user1_id;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO conversation_id
  FROM public.conversations
  WHERE conversations.participant_1 = p1
    AND conversations.participant_2 = p2;

  -- Create conversation if it doesn't exist
  IF conversation_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2)
    VALUES (p1, p2)
    RETURNING id INTO conversation_id;
  END IF;

  RETURN conversation_id;
END;
$$;

-- Create function to update conversation last message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_id = NEW.id,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger first to avoid conflicts
DROP TRIGGER IF EXISTS update_conversation_on_new_message ON public.messages;

-- Create trigger to update conversation when new message is added
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;

-- Create trigger for updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversations_updated_at();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversations_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_1, participant_2);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Migrate existing messages to use conversations (idempotent)
-- First, create conversations for all existing message pairs (only if they don't exist)
INSERT INTO public.conversations (participant_1, participant_2, last_message_at, last_message_id)
WITH message_pairs AS (
  SELECT 
    CASE 
      WHEN sender_id <= to_user_id THEN sender_id
      ELSE to_user_id
    END as p1,
    CASE 
      WHEN sender_id <= to_user_id THEN to_user_id
      ELSE sender_id
    END as p2,
    MAX(created_at) as last_msg_time
  FROM public.messages
  GROUP BY 
    CASE 
      WHEN sender_id <= to_user_id THEN sender_id
      ELSE to_user_id
    END,
    CASE 
      WHEN sender_id <= to_user_id THEN to_user_id
      ELSE sender_id
    END
),
last_messages AS (
  SELECT 
    mp.p1,
    mp.p2,
    mp.last_msg_time,
    m.id as last_msg_id
  FROM message_pairs mp
  JOIN public.messages m ON 
    ((m.sender_id = mp.p1 AND m.to_user_id = mp.p2) OR 
     (m.sender_id = mp.p2 AND m.to_user_id = mp.p1)) AND
    m.created_at = mp.last_msg_time
)
SELECT 
  p1 as participant_1,
  p2 as participant_2,
  last_msg_time as last_message_at,
  last_msg_id as last_message_id
FROM last_messages
ON CONFLICT (participant_1, participant_2) DO NOTHING;

-- Update messages to reference conversations (only if conversation_id is NULL)
UPDATE public.messages 
SET conversation_id = c.id
FROM public.conversations c
WHERE messages.conversation_id IS NULL
  AND ((messages.sender_id = c.participant_1 AND messages.to_user_id = c.participant_2) OR
       (messages.sender_id = c.participant_2 AND messages.to_user_id = c.participant_1));

-- Make conversation_id NOT NULL after populating it (only if not already NOT NULL)
DO $$
BEGIN
  -- Check if conversation_id is already NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
      AND column_name = 'conversation_id' 
      AND table_schema = 'public'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;
  END IF;
END $$;

-- Refresh the schema cache to ensure all changes are recognized
NOTIFY pgrst, 'reload schema';
