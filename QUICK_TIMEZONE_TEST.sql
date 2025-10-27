-- Quick test to verify timezone conversion
-- This will show exactly how UTC times convert to IST

-- Test the conversion for your sample data
SELECT 
  'Ayaan' as employee,
  '2025-10-25 09:55:00+00'::timestamptz as utc_time,
  ('2025-10-25 09:55:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 09:55:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 09:55:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

SELECT 
  'Dolly' as employee,
  '2025-10-25 05:55:23.356+00'::timestamptz as utc_time,
  ('2025-10-25 05:55:23.356+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 05:55:23.356+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 05:55:23.356+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

SELECT 
  'Isha' as employee,
  '2025-10-25 05:54:49.991+00'::timestamptz as utc_time,
  ('2025-10-25 05:54:49.991+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 05:54:49.991+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 05:54:49.991+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

SELECT 
  'Vanshika' as employee,
  '2025-10-25 05:04:07.454+00'::timestamptz as utc_time,
  ('2025-10-25 05:04:07.454+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as ist_time,
  EXTRACT(HOUR FROM ('2025-10-25 05:04:07.454+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_hour,
  EXTRACT(MINUTE FROM ('2025-10-25 05:04:07.454+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as ist_minute;

-- Show what the late threshold should be
SELECT 
  'Late Threshold' as info,
  '10:30 IST' as local_time,
  ('2025-10-25 10:30:00'::timestamp AT TIME ZONE 'Asia/Kolkata') as utc_time,
  'Any check-in after this UTC time should be LATE' as explanation;
