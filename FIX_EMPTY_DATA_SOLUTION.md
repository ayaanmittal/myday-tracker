# Fix Empty Data Issue - My Leaves & Salary

## 🎯 **Problem Identified**

The "My Leaves & Salary" page is showing empty data because:
1. ✅ **Tables exist** - All required tables are in the database (confirmed in schema.md)
2. ❌ **RPC functions missing** - The functions that the frontend calls don't exist
3. ❌ **No sample data** - No test data to display

## 🎯 **Solution Steps**

### **Step 1: Create RPC Functions**
Run this SQL script in Supabase SQL Editor:
```sql
-- File: CREATE_RPC_FUNCTIONS_ONLY.sql
-- This creates the missing RPC functions that the frontend needs
```

### **Step 2: Insert Sample Data**
Run this SQL script in Supabase SQL Editor:
```sql
-- File: INSERT_SAMPLE_DATA_FOR_LEAVES_SALARY.sql
-- This inserts test data for Sakshi Saglotia
```

### **Step 3: Test the Page**
After running both scripts, the "My Leaves & Salary" page should display:
- ✅ **Base Salary**: ₹50,000
- ✅ **Leave Deductions**: ₹1,612.90 (2 unpaid days)
- ✅ **Net Salary**: ₹48,387.10
- ✅ **Leave History**: 2 personal leave days (Oct 15-16)
- ✅ **Salary Payments**: One payment record for October 2025

## 🎯 **Files Created**

1. **`CREATE_RPC_FUNCTIONS_ONLY.sql`** - Creates the missing RPC functions
2. **`INSERT_SAMPLE_DATA_FOR_LEAVES_SALARY.sql`** - Inserts test data
3. **`FIX_EMPTY_DATA_SOLUTION.md`** - This solution guide

## 🎯 **RPC Functions Created**

### **1. `get_employee_leaves_with_salary_deductions`**
- Returns employee leaves with salary deduction calculations
- Calculates daily rate based on base salary
- Shows deduction amounts for unpaid leaves

### **2. `get_employee_salary_summary`**
- Returns summary statistics for the month
- Calculates total deductions, paid/unpaid leaves
- Counts office holidays
- Calculates net salary and deduction percentage

### **3. `get_employee_salary_payment`**
- Returns salary payment records for the month
- Shows payment status, method, reference
- Includes all payment details

## 🎯 **Sample Data Inserted**

### **For Sakshi Saglotia (sakshisaglotia@gmail.com):**
- ✅ **Employee Salary**: ₹50,000/month (effective from Jan 1, 2025)
- ✅ **Company Holidays**: Gandhi Jayanti (Oct 2), Dussehra (Oct 12)
- ✅ **Personal Leaves**: Oct 15-16 (unpaid, approved)
- ✅ **Salary Payment**: October 2025 payment record
- ✅ **Leave Types**: Personal Leave, Sick Leave, Annual Leave

## 🎯 **Expected Results After Fix**

### **Salary Summary Cards:**
- **Base Salary**: ₹50,000
- **Total Deductions**: ₹1,612.90
- **Net Salary**: ₹48,387.10
- **Deduction %**: 3.23%
- **Paid Leaves**: 0
- **Unpaid Leaves**: 2
- **Office Holidays**: 2
- **Working Days**: 27/31

### **Leave History:**
- **Personal Leave**: Oct 15-16 (2 days, unpaid)
- **Deduction**: ₹1,612.90 total

### **Salary Payments:**
- **October 2025 Payment**: ₹48,387.10 (pending)
- **Base Salary**: ₹50,000
- **Leave Deductions**: ₹1,612.90
- **Unpaid Days**: 2

## 🎯 **How to Deploy**

### **Option 1: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste `CREATE_RPC_FUNCTIONS_ONLY.sql`
3. Click "Run"
4. Copy and paste `INSERT_SAMPLE_DATA_FOR_LEAVES_SALARY.sql`
5. Click "Run"

### **Option 2: Command Line (if psql is available)**
```bash
psql -h your-supabase-host -p 5432 -d postgres -U postgres -f CREATE_RPC_FUNCTIONS_ONLY.sql
psql -h your-supabase-host -p 5432 -d postgres -U postgres -f INSERT_SAMPLE_DATA_FOR_LEAVES_SALARY.sql
```

## 🎯 **Verification**

After running the scripts, check:
1. **Functions exist**: Query `SELECT * FROM pg_proc WHERE proname LIKE 'get_employee%';`
2. **Sample data exists**: Query the tables directly
3. **Frontend works**: Refresh the "My Leaves & Salary" page

## 🎯 **Troubleshooting**

### **If still showing empty data:**
1. Check browser console for errors
2. Verify user is logged in as Sakshi
3. Check Supabase logs for RPC function errors
4. Ensure RLS policies allow data access

### **If functions don't create:**
1. Check for syntax errors in SQL
2. Verify user has CREATE FUNCTION permissions
3. Check Supabase logs for errors

**The solution is ready to deploy! Run the two SQL scripts and the "My Leaves & Salary" page will show real data instead of empty values.** 🎯
