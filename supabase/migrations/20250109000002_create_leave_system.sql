-- Create leave management system
-- Run this in your Supabase SQL Editor

-- 1. Create leave types table
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  max_days_per_year integer NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_types_pkey PRIMARY KEY (id)
);

-- 2. Create leave requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested decimal(4,2) NOT NULL,
  reason text,
  work_from_home boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id),
  CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id)
);

-- 3. Create leave balances table
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  year integer NOT NULL,
  total_days decimal(4,2) NOT NULL DEFAULT 0,
  used_days decimal(4,2) NOT NULL DEFAULT 0,
  remaining_days decimal(4,2) GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_balances_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id),
  CONSTRAINT leave_balances_unique UNIQUE (user_id, leave_type_id, year)
);

-- 4. Insert default leave types
INSERT INTO public.leave_types (name, description, max_days_per_year, is_paid, requires_approval) VALUES
('Sick Leave', 'Medical leave for illness or health issues', 12, true, true),
('Vacation Leave', 'Annual vacation time', 21, true, true),
('Personal Leave', 'Personal time off', 5, true, true),
('Work From Home', 'Remote work request', 0, true, true),
('Emergency Leave', 'Urgent personal matters', 3, true, true),
('Maternity Leave', 'Maternity and childcare', 90, true, true),
('Paternity Leave', 'Paternity and childcare', 15, true, true);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON public.leave_balances(user_id, year);

-- 6. Enable RLS
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for leave_types
CREATE POLICY "Everyone can view active leave types" ON public.leave_types
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage leave types" ON public.leave_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- 8. RLS Policies for leave_requests
CREATE POLICY "Users can view their own leave requests" ON public.leave_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending leave requests" ON public.leave_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can view all leave requests" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can approve/reject leave requests" ON public.leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- 9. RLS Policies for leave_balances
CREATE POLICY "Users can view their own leave balances" ON public.leave_balances
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all leave balances" ON public.leave_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage leave balances" ON public.leave_balances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );
