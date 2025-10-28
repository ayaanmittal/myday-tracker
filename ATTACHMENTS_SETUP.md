# Message Attachments Setup

## Quick Fix for "Bucket not found" Error

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Copy and paste the SQL below:

```sql
-- Create message attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  52428800,
  ARRAY['image/*', 'application/pdf', 'text/*', 'application/*', 'video/*', 'audio/*']
)
ON CONFLICT (id) DO NOTHING;

-- Add attachments column to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Create storage policies
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
```

5. Click **Run** to execute the SQL
6. Verify bucket was created by running:

```sql
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'message-attachments';
```

### Option 2: Manual Bucket Creation

1. Go to **Storage** in the Supabase Dashboard
2. Click **New bucket**
3. Fill in:
   - Name: `message-attachments`
   - Public: **OFF** (toggle it off)
   - File size limit: `52428800` (50MB)
4. Click **Create bucket**
5. Still run the SQL above to add the column and policies

## What This Does:

1. ✅ Creates the `message-attachments` storage bucket
2. ✅ Adds `attachments` column to `messages` table
3. ✅ Sets up RLS policies for secure file access
4. ✅ Allows authenticated users to upload/view/delete attachments

## After Running the SQL:

- Refresh your browser
- The attachment feature will work immediately
- Users can now send and receive files/images/videos

## File Limits:

- Max size: 50MB per file
- Multiple files per message supported
- Types: Images, Videos, PDFs, Documents, Audio

