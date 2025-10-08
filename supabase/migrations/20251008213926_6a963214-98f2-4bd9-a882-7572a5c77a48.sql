-- Drop the old messages table if it exists (with old schema)
-- The new messages table with conversation_id will remain

-- First, check if there's an old messages table structure and drop it
DO $$ 
BEGIN
  -- Drop old messages table if it exists with the old schema (message, to_user_id columns)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'to_user_id'
  ) THEN
    DROP TABLE IF EXISTS public.messages CASCADE;
    
    -- Recreate the correct messages table
    CREATE TABLE public.messages (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    CREATE POLICY "messages_policy" ON public.messages
      FOR ALL
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

    -- Create index for better performance
    CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
    CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
    CREATE INDEX idx_messages_created_at ON public.messages(created_at);

    -- Create trigger to update conversation last_message
    CREATE TRIGGER update_conversation_last_message
      AFTER INSERT ON public.messages
      FOR EACH ROW
      EXECUTE FUNCTION public.update_conversation_last_message();

    -- Create trigger to update updated_at
    CREATE TRIGGER update_messages_updated_at
      BEFORE UPDATE ON public.messages
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;