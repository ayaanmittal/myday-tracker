-- Add attachments support to messages
-- This allows messages to include files, images, videos, etc.

-- 1. Add attachments column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'text/*', 'application/*', 'video/*', 'audio/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/*', 'application/pdf', 'text/*', 'application/*', 'video/*', 'audio/*'];

-- 3. Create storage policies for the message-attachments bucket
DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own message attachments" ON storage.objects;

CREATE POLICY "Users can upload message attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "Users can view message attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments');

CREATE POLICY "Users can delete message attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments');

-- 4. Add comment for documentation
COMMENT ON COLUMN public.messages.attachments IS 'Array of file attachments with structure: [{id, type, url, name, size, mime_type}]';

