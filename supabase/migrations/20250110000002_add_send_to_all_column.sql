-- Add send_to_all column to announcements table
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS send_to_all boolean DEFAULT false;

-- Add unique constraint for announcement_recipients
ALTER TABLE public.announcement_recipients 
ADD CONSTRAINT IF NOT EXISTS announcement_recipients_unique UNIQUE (announcement_id, user_id);

-- Add unique constraint for announcement_views  
ALTER TABLE public.announcement_views 
ADD CONSTRAINT IF NOT EXISTS announcement_views_unique UNIQUE (announcement_id, user_id);


















