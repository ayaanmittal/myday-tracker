-- Create role enum (skip if exists)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table (skip if exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  team TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (skip if exists)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create day_entries table (skip if exists)
CREATE TABLE IF NOT EXISTS public.day_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  total_work_time_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'incomplete_auto')),
  device_info TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Create day_updates table (skip if exists)
CREATE TABLE IF NOT EXISTS public.day_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_entry_id UUID REFERENCES public.day_entries(id) ON DELETE CASCADE NOT NULL,
  today_focus TEXT NOT NULL,
  progress TEXT NOT NULL,
  blockers TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_updates ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Drop existing policies to recreate them
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Managers can view team profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Users can view own entries" ON public.day_entries;
  DROP POLICY IF EXISTS "Users can create own entries" ON public.day_entries;
  DROP POLICY IF EXISTS "Users can update own entries" ON public.day_entries;
  DROP POLICY IF EXISTS "Managers can view team entries" ON public.day_entries;
  DROP POLICY IF EXISTS "Admins can view all entries" ON public.day_entries;
  DROP POLICY IF EXISTS "Users can manage own updates" ON public.day_updates;
  DROP POLICY IF EXISTS "Managers can view team updates" ON public.day_updates;
  DROP POLICY IF EXISTS "Admins can view all updates" ON public.day_updates;
END $$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view team profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'manager') AND
    team = (SELECT team FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles RLS policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Day entries RLS policies
CREATE POLICY "Users can view own entries"
  ON public.day_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own entries"
  ON public.day_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON public.day_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view team entries"
  ON public.day_entries FOR SELECT
  USING (
    public.has_role(auth.uid(), 'manager') AND
    user_id IN (
      SELECT id FROM public.profiles
      WHERE team = (SELECT team FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all entries"
  ON public.day_entries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Day updates RLS policies
CREATE POLICY "Users can manage own updates"
  ON public.day_updates FOR ALL
  USING (
    day_entry_id IN (
      SELECT id FROM public.day_entries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view team updates"
  ON public.day_updates FOR SELECT
  USING (
    day_entry_id IN (
      SELECT de.id FROM public.day_entries de
      JOIN public.profiles p ON de.user_id = p.id
      WHERE p.team = (SELECT team FROM public.profiles WHERE id = auth.uid())
      AND public.has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Admins can view all updates"
  ON public.day_updates FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing update triggers and recreate
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_day_entries_updated_at ON public.day_entries;
CREATE TRIGGER update_day_entries_updated_at
  BEFORE UPDATE ON public.day_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_day_updates_updated_at ON public.day_updates;
CREATE TRIGGER update_day_updates_updated_at
  BEFORE UPDATE ON public.day_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();