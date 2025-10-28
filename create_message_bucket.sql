-- Create message attachments bucket manually
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'text/*', 'application/*', 'video/*', 'audio/*']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Add attachments column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Create policies
DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete message attachments" ON storage.objects;

CREATE POLICY "Users can upload message attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "Users can view message attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments');

CREATE POLICY "Users can delete message attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments');

-- 4. Verify bucket exists
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'message-attachments';

