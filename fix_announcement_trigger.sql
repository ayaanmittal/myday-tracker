-- First, let's drop the existing trigger and function
DROP TRIGGER IF EXISTS after_announcement_insert ON public.announcements;
DROP FUNCTION IF EXISTS public.create_general_announcement_recipients();

-- Create a new function that only creates recipients when send_to_all is true
CREATE OR REPLACE FUNCTION public.create_general_announcement_recipients()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create recipients if send_to_all is true
  IF NEW.send_to_all = true THEN
    INSERT INTO public.announcement_recipients (announcement_id, user_id)
    SELECT NEW.id, p.id
    FROM public.profiles p
    WHERE p.is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER after_announcement_insert
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.create_general_announcement_recipients();


