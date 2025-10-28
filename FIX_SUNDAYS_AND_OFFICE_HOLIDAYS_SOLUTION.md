# Fix Sundays and Office Holidays Logic - My Leaves & Salary

## 🎯 **Enhanced Problem Identified**

The "My Leaves & Salary" page needs to properly handle:
- ✅ **Office Holidays**: Company holidays (Gandhi Jayanti, Dussehra, Diwali, etc.)
- ✅ **Sundays**: All Sundays should be treated as office holidays
- ✅ **Leave Deductions**: Only deduct for actual unpaid work days (excluding office holidays and Sundays)

## 🎯 **Enhanced Solution**

### **Step 1: Updated RPC Functions with Sunday Logic**
Run this SQL script in Supabase SQL Editor:
```sql
-- File: FIX_OFFICE_HOLIDAYS_LOGIC.sql (Updated)
-- This includes Sunday logic in all calculations
```

### **Step 2: Insert Enhanced Sample Data with Sundays**
Run this SQL script in Supabase SQL Editor:
```sql
-- File: INSERT_ENHANCED_SAMPLE_DATA.sql (Updated)
-- This includes Sunday leave days to test the logic
```

## 🎯 **Enhanced Logic**

### **Office Holiday Counting (Including Sundays):**
```sql
-- Count total office holidays in the month (including Sundays)
WITH all_holidays AS (
  -- Company holidays
  SELECT ch.holiday_date as holiday_date
  FROM public.company_holidays ch
  WHERE ch.holiday_date >= v_month_start
    AND ch.holiday_date <= v_month_end
  
  UNION
  
  -- Sundays
  SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date as holiday_date
  WHERE EXTRACT(DOW FROM generate_series(v_month_start, v_month_end, '1 day'::interval)) = 0
)
SELECT COUNT(DISTINCT holiday_date)
FROM all_holidays;
```

### **Unpaid Leave Calculation (Excluding Sundays):**
```sql
-- Count unpaid leave days (excluding office holidays and Sundays)
SELECT COUNT(*)
FROM public.leaves l
WHERE l.user_id = p_user_id
  AND l.leave_date >= v_month_start
  AND l.leave_date <= v_month_end
  AND l.is_paid_leave = false 
  AND l.is_approved = true
  AND NOT EXISTS (
    SELECT 1 FROM public.company_holidays ch 
    WHERE ch.holiday_date = l.leave_date
  )
  AND EXTRACT(DOW FROM l.leave_date) != 0; -- Exclude Sundays
```

### **Deduction Logic (Excluding Sundays and Office Holidays):**
```sql
CASE 
  WHEN l.is_paid_leave = false AND l.is_approved = true 
    AND NOT EXISTS (
      SELECT 1 FROM public.company_holidays ch 
      WHERE ch.holiday_date = l.leave_date
    )
    AND EXTRACT(DOW FROM l.leave_date) != 0 THEN v_daily_rate
  ELSE 0
END as deduction_amount
```

## 🎯 **Enhanced Test Scenario**

### **Sample Data Created:**
- **Employee**: Sakshi Saglotia
- **Base Salary**: ₹50,000/month
- **Office Holidays**: Oct 2 (Gandhi Jayanti), Oct 12 (Dussehra), Oct 20 (Diwali), Oct 21 (Diwali Holiday)
- **Sundays**: Oct 5, Oct 12, Oct 19, Oct 26 (4 Sundays in October 2025)
- **Leave Days**: Oct 1, 5, 15, 16, 19, 20, 25, 26, 27 (9 total leave days)

### **Expected Results:**
- **Total Office Holidays**: 4 (company holidays)
- **Total Sundays**: 4 (all Sundays in October)
- **Total Holidays**: 8 (4 office holidays + 4 Sundays)
- **Total Leave Days**: 9
- **Overlapping Days**: Oct 1 (Gandhi Jayanti), Oct 5 (Sunday), Oct 19 (Sunday), Oct 20 (Diwali), Oct 26 (Sunday) = 5 days
- **Net Unpaid Days**: 9 - 5 = 4 days
- **Daily Rate**: ₹50,000 ÷ 31 = ₹1,612.90
- **Total Deduction**: 4 × ₹1,612.90 = ₹6,451.60
- **Net Salary**: ₹50,000 - ₹6,451.60 = ₹43,548.40

## 🎯 **Expected Display**

### **Salary Summary Cards:**
- **Base Salary**: ₹50,000
- **Total Deductions**: ₹6,451.60
- **Net Salary**: ₹43,548.40
- **Deduction %**: 12.90%
- **Paid Leaves**: 0
- **Unpaid Leaves**: 4 (9 total - 5 holidays/Sundays)
- **Office Holidays**: 8 (4 company holidays + 4 Sundays)

### **Leave History:**
- **Oct 1**: Personal Leave (Office Holiday - No Deduction)
- **Oct 5**: Personal Leave (Sunday - No Deduction)
- **Oct 15**: Personal Leave (₹1,612.90 deduction)
- **Oct 16**: Personal Leave (₹1,612.90 deduction)
- **Oct 19**: Personal Leave (Sunday - No Deduction)
- **Oct 20**: Personal Leave (Office Holiday - No Deduction)
- **Oct 25**: Personal Leave (₹1,612.90 deduction)
- **Oct 26**: Personal Leave (Sunday - No Deduction)
- **Oct 27**: Personal Leave (₹1,612.90 deduction)

### **Total Deductions Display:**
```
Total Deductions for October 2025
4 unpaid leaves • 8 office holidays • 0 paid leaves
```

## 🎯 **Key Enhancements**

### **1. Sunday Detection:**
- ✅ Automatically identifies all Sundays in the month
- ✅ Treats Sundays as office holidays
- ✅ Excludes Sundays from salary deductions

### **2. Comprehensive Holiday Logic:**
- ✅ Counts both company holidays and Sundays
- ✅ Shows total office holidays (company + Sundays)
- ✅ Prevents double-counting of overlapping days

### **3. Accurate Deduction Calculation:**
- ✅ Only deducts for actual unpaid work days
- ✅ Excludes both office holidays and Sundays
- ✅ Shows clear deduction reasons for each leave day

## 🎯 **How to Deploy**

### **Option 1: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste `FIX_OFFICE_HOLIDAYS_LOGIC.sql`
3. Click "Run"
4. Copy and paste `INSERT_ENHANCED_SAMPLE_DATA.sql`
5. Click "Run"

### **Option 2: Command Line**
```bash
psql -h your-supabase-host -p 5432 -d postgres -U postgres -f FIX_OFFICE_HOLIDAYS_LOGIC.sql
psql -h your-supabase-host -p 5432 -d postgres -U postgres -f INSERT_ENHANCED_SAMPLE_DATA.sql
```

## 🎯 **Verification**

After running the scripts, the page should show:
- ✅ **Office Holidays**: 8 (4 company holidays + 4 Sundays)
- ✅ **Unpaid Leaves**: 4 (9 total - 5 holidays/Sundays)
- ✅ **Total Deductions**: ₹6,451.60
- ✅ **Net Salary**: ₹43,548.40

**The solution now properly handles both office holidays and Sundays, ensuring accurate salary deductions!** 🎯

