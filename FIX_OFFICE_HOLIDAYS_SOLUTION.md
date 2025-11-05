# Fix Office Holidays Logic - My Leaves & Salary

## 🎯 **Problem Identified**

The "My Leaves & Salary" page is showing incorrect data:
- ❌ **Office Holidays**: Showing 0 instead of actual count
- ❌ **Unpaid Leaves**: Not subtracting office holidays that fall within leave periods
- ❌ **Deductions**: Calculating deductions for office holiday days

## 🎯 **Root Cause**

The RPC functions are not properly handling the logic where:
1. **Office holidays should be counted accurately**
2. **Office holidays within leave periods should not be deducted**
3. **Only actual unpaid work days should be deducted from salary**

## 🎯 **Solution**

### **Step 1: Update RPC Functions**
Run this SQL script in Supabase SQL Editor:
```sql
-- File: FIX_OFFICE_HOLIDAYS_LOGIC.sql
-- This updates the RPC functions with proper office holiday logic
```

### **Step 2: Insert Enhanced Sample Data**
Run this SQL script in Supabase SQL Editor:
```sql
-- File: INSERT_ENHANCED_SAMPLE_DATA.sql
-- This creates a realistic test scenario
```

## 🎯 **Enhanced Logic**

### **Office Holiday Detection:**
```sql
-- Count total office holidays in the month
SELECT COUNT(*)
FROM public.company_holidays ch
WHERE ch.holiday_date >= v_month_start
  AND ch.holiday_date <= v_month_end;
```

### **Unpaid Leave Calculation:**
```sql
-- Count unpaid leave days (excluding office holidays)
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
  );
```

### **Deduction Calculation:**
```sql
-- Only deduct for unpaid leave days that are NOT office holidays
CASE 
  WHEN l.is_paid_leave = false AND l.is_approved = true 
    AND NOT EXISTS (
      SELECT 1 FROM public.company_holidays ch 
      WHERE ch.holiday_date = l.leave_date
    ) THEN v_daily_rate
  ELSE 0
END as deduction_amount
```

## 🎯 **Test Scenario**

### **Sample Data Created:**
- **Employee**: Sakshi Saglotia
- **Base Salary**: ₹50,000/month
- **Office Holidays**: Oct 2 (Gandhi Jayanti), Oct 12 (Dussehra), Oct 20 (Diwali), Oct 21 (Diwali Holiday)
- **Leave Days**: Oct 1, 15, 16, 20, 25, 26, 27 (all unpaid)

### **Expected Results:**
- **Total Office Holidays**: 4
- **Total Leave Days**: 7
- **Overlapping Days**: Oct 1 (Gandhi Jayanti), Oct 20 (Diwali) = 2 days
- **Net Unpaid Days**: 7 - 2 = 5 days
- **Daily Rate**: ₹50,000 ÷ 31 = ₹1,612.90
- **Total Deduction**: 5 × ₹1,612.90 = ₹8,064.50
- **Net Salary**: ₹50,000 - ₹8,064.50 = ₹41,935.50

## 🎯 **Expected Display**

### **Salary Summary Cards:**
- **Base Salary**: ₹50,000
- **Total Deductions**: ₹8,064.50
- **Net Salary**: ₹41,935.50
- **Deduction %**: 16.13%
- **Paid Leaves**: 0
- **Unpaid Leaves**: 5 (7 total - 2 office holidays)
- **Office Holidays**: 4

### **Leave History:**
- **Oct 1**: Personal Leave (Office Holiday - No Deduction)
- **Oct 15**: Personal Leave (₹1,612.90 deduction)
- **Oct 16**: Personal Leave (₹1,612.90 deduction)
- **Oct 20**: Personal Leave (Office Holiday - No Deduction)
- **Oct 25**: Personal Leave (₹1,612.90 deduction)
- **Oct 26**: Personal Leave (₹1,612.90 deduction)
- **Oct 27**: Personal Leave (₹1,612.90 deduction)

### **Total Deductions Display:**
```
Total Deductions for October 2025
5 unpaid leaves • 4 office holidays • 0 paid leaves
```

## 🎯 **Key Improvements**

### **1. Accurate Office Holiday Counting:**
- ✅ Counts all office holidays in the month
- ✅ Shows correct number in the summary

### **2. Smart Leave Deduction Logic:**
- ✅ Excludes office holidays from unpaid leave deductions
- ✅ Only deducts for actual unpaid work days
- ✅ Prevents double-counting of office holidays

### **3. Clear Display Logic:**
- ✅ Shows total office holidays
- ✅ Shows net unpaid leave days (excluding office holidays)
- ✅ Shows deduction amounts only for non-holiday days

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
- ✅ **Office Holidays**: 4 (not 0)
- ✅ **Unpaid Leaves**: 5 (not 7)
- ✅ **Total Deductions**: ₹8,064.50
- ✅ **Net Salary**: ₹41,935.50

**The solution properly handles office holidays within leave periods and shows accurate deductions!** 🎯



