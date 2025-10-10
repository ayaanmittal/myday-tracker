-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  expires_at timestamp with time zone,
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

-- Create announcement recipients table (for targeted announcements)
CREATE TABLE IF NOT EXISTS public.announcement_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcement_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT announcement_recipients_unique UNIQUE (announcement_id, user_id)
);

-- Create announcement views table (for tracking who viewed the announcement)
CREATE TABLE IF NOT EXISTS public.announcement_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcement_views_pkey PRIMARY KEY (id),
  CONSTRAINT announcement_views_unique UNIQUE (announcement_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_announcement_id ON public.announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_user_id ON public.announcement_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON public.announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON public.announcement_views(user_id);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcements
-- Admins and managers can see all announcements
CREATE POLICY "Admins and managers can view all announcements" ON public.announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Users can see announcements they are recipients of or general announcements
CREATE POLICY "Users can view their announcements" ON public.announcements
  FOR SELECT USING (
    is_active = true AND (
      -- General announcements (no specific recipients)
      NOT EXISTS (
        SELECT 1 FROM public.announcement_recipients 
        WHERE announcement_recipients.announcement_id = announcements.id
      )
      OR
      -- User is a recipient
      EXISTS (
        SELECT 1 FROM public.announcement_recipients 
        WHERE announcement_recipients.announcement_id = announcements.id 
        AND announcement_recipients.user_id = auth.uid()
      )
    )
  );

-- Only admins and managers can create announcements
CREATE POLICY "Admins and managers can create announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Only admins and managers can update announcements
CREATE POLICY "Admins and managers can update announcements" ON public.announcements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Only admins and managers can delete announcements
CREATE POLICY "Admins and managers can delete announcements" ON public.announcements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for announcement_recipients
CREATE POLICY "Users can view their announcement recipients" ON public.announcement_recipients
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can manage announcement recipients" ON public.announcement_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for announcement_views
CREATE POLICY "Users can view their announcement views" ON public.announcement_views
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can create their own announcement views" ON public.announcement_views
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and managers can manage announcement views" ON public.announcement_views
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Function to automatically create recipients for general announcements
CREATE OR REPLACE FUNCTION create_general_announcement_recipients()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a general announcement (no specific recipients), create recipients for all active users
  IF NOT EXISTS (
    SELECT 1 FROM public.announcement_recipients 
    WHERE announcement_id = NEW.id
  ) THEN
    INSERT INTO public.announcement_recipients (announcement_id, user_id)
    SELECT NEW.id, profiles.id
    FROM public.profiles
    WHERE profiles.is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create recipients for general announcements
CREATE TRIGGER trigger_create_general_announcement_recipients
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION create_general_announcement_recipients();
