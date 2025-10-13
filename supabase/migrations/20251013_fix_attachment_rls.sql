-- Fix RLS policies for task_attachments and ensure storage bucket exists
-- This migration ensures file uploads work properly

-- 1. Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.task_attachments;
DROP POLICY IF EXISTS "Authenticated users can create task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Authenticated users can delete own task attachments" ON public.task_attachments;

-- 2. Create more specific RLS policies for task_attachments
CREATE POLICY "Authenticated users can create task attachments" ON public.task_attachments
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can view task attachments" ON public.task_attachments
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete own task attachments" ON public.task_attachments
  FOR DELETE TO authenticated 
  USING (auth.uid() = uploaded_by);

-- 3. Ensure the storage bucket exists and has proper policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'text/*', 'application/*', 'video/*', 'audio/*']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/*', 'application/pdf', 'text/*', 'application/*', 'video/*', 'audio/*'];

-- 4. Create storage policies for the task-attachments bucket
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own task attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload task attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view task attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can delete own task attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Grant necessary permissions
GRANT ALL ON public.task_attachments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. Ensure RLS is enabled
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
