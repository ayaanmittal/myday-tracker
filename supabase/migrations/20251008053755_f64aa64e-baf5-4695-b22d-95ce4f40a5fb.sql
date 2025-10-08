-- Add lunch break tracking columns to day_entries table
ALTER TABLE public.day_entries 
ADD COLUMN lunch_break_start timestamp with time zone,
ADD COLUMN lunch_break_end timestamp with time zone;