-- Quick check of Sundays in October 2025
SELECT 
  'Sundays in October 2025' as test_name,
  holiday_date,
  EXTRACT(DOW FROM holiday_date) as day_of_week,
  CASE EXTRACT(DOW FROM holiday_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name
FROM (
  SELECT generate_series('2025-10-01'::date, '2025-10-31'::date, '1 day'::interval)::date as holiday_date
) all_days
WHERE EXTRACT(DOW FROM holiday_date) = 0
ORDER BY holiday_date;



