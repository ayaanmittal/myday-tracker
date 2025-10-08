-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_1 uuid NOT NULL,
  participant_2 uuid NOT NULL,
  last_message_at timestamp with time zone,
  last_message_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_participant_1_fkey FOREIGN KEY (participant_1) REFERENCES auth.users(id),
  CONSTRAINT conversations_participant_2_fkey FOREIGN KEY (participant_2) REFERENCES auth.users(id)
);
CREATE TABLE public.day_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL,
  check_in_at timestamp with time zone,
  check_out_at timestamp with time zone,
  total_work_time_minutes integer,
  status text NOT NULL DEFAULT 'not_started'::text CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'unlogged'::text])),
  device_info text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lunch_break_start timestamp with time zone,
  lunch_break_end timestamp with time zone,
  CONSTRAINT day_entries_pkey PRIMARY KEY (id),
  CONSTRAINT day_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.day_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  day_entry_id uuid NOT NULL,
  today_focus text NOT NULL,
  progress text NOT NULL,
  blockers text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT day_updates_pkey PRIMARY KEY (id),
  CONSTRAINT day_updates_day_entry_id_fkey FOREIGN KEY (day_entry_id) REFERENCES public.day_entries(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.office_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT office_rules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  team text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.rule_acknowledgments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL,
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rule_acknowledgments_pkey PRIMARY KEY (id),
  CONSTRAINT rule_acknowledgments_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.office_rules(id)
);
CREATE TABLE public.rule_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  initials text NOT NULL,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rule_contracts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rule_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL,
  warning_level integer NOT NULL CHECK (warning_level = ANY (ARRAY[1, 2, 3])),
  reason text,
  flagged_by uuid NOT NULL,
  flagged_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rule_violations_pkey PRIMARY KEY (id),
  CONSTRAINT rule_violations_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.office_rules(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);