# Comprehensive Leaves Tracking System

## ✅ **Problem Identified**

The current system was incorrectly calculating leave deductions because:
1. **No Proper Leaves Table**: System was using attendance data instead of approved leave requests
2. **No Paid/Unpaid Distinction**: All leaves were treated the same way
3. **No Leave Request Integration**: Approved leave requests weren't being tracked properly
4. **Manual Leave Management**: No way for admins to manually add leaves

## ✅ **Solution Implemented**

### **🛠️ New Leaves Table Structure**

#### **1. Leaves Table (`public.leaves`)**
```sql
CREATE TABLE public.leaves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  leave_date DATE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id),
  leave_type_name TEXT NOT NULL,
  is_paid_leave BOOLEAN NOT NULL DEFAULT true,  -- ✅ Key field for salary calculation
  is_approved BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  leave_request_id UUID REFERENCES public.leave_requests(id),  -- ✅ Links to original request
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### **2. Key Features**
- ✅ **Paid/Unpaid Distinction**: `is_paid_leave` field determines if leave affects salary
- ✅ **Leave Request Integration**: Links to original `leave_requests` table
- ✅ **Manual Leave Support**: Admins can manually add leaves
- ✅ **Approval Tracking**: Tracks who approved the leave and when
- ✅ **Leave Type Integration**: Links to `leave_types` table for proper categorization

### **🛠️ Database Functions Created**

#### **1. `populate_leaves_from_requests()`**
```sql
-- Automatically populates leaves table from approved leave requests
-- Processes all approved leave requests that haven't been processed yet
-- Creates individual leave records for each day in the leave period
```

#### **2. `add_manual_leave()`**
```sql
-- Allows admins to manually add leaves
-- Parameters: user_id, leave_date, leave_type_name, is_paid_leave, notes, created_by
-- Returns: leave_id of the created leave record
```

#### **3. `calculate_unpaid_leave_days_for_salary()`**
```sql
-- Calculates unpaid leave days for salary deduction
-- Only counts work days with unpaid leaves
-- Excludes paid leaves from salary deduction
-- Considers employee work days configuration
```

#### **4. `get_employee_leave_summary()`**
```sql
-- Returns comprehensive leave summary for an employee
-- Shows total leave days, paid leave days, unpaid leave days
-- Includes detailed leave information as JSON
```

### **🛠️ Updated Functions**

#### **1. Updated `calculate_month_leave_deductions()`**
```sql
-- Now uses the leaves table instead of attendance data
-- Only counts unpaid leaves for salary deduction
-- Properly considers work days and leave types
-- Returns accurate unpaid days and deduction amounts
```

### **📊 How the New System Works**

#### **1. Leave Request Processing**
```
1. Employee submits leave request
2. Admin approves/rejects the request
3. If approved, system automatically creates leave records
4. Each day in the leave period gets a separate leave record
5. Leave type determines if it's paid or unpaid
```

#### **2. Salary Calculation Process**
```
1. Get employee work days configuration
2. Loop through each work day in the month
3. Check if there's an unpaid leave for that day
4. Count only unpaid leaves on work days
5. Calculate deduction: (unpaid_days × daily_rate)
```

#### **3. Manual Leave Management**
```
1. Admin can manually add leaves using add_manual_leave()
2. Specify if the leave is paid or unpaid
3. System automatically processes the leave for salary calculation
4. Leave appears in employee leave summary
```

### **📈 Expected Results for Arjan Singh**

#### **Before Fix (Wrong)**
```
Base Salary: ₹14,000
Daily Rate: ₹609 (based on 23 work days)  ❌ Wrong work days
Unpaid Days: 2 × 100% = ₹1,217  ❌ Wrong unpaid days
Net Salary: ₹12,783  ❌ Wrong calculation
```

#### **After Fix (Correct)**
```
Base Salary: ₹14,000
Work Days: 26 (Mon-Sat, 6 days per week)  ✅ Correct work days
Daily Rate: ₹14,000 ÷ 26 = ₹538.46  ✅ Correct daily rate
Unpaid Days: 0 (no unpaid leave requests)  ✅ Correct unpaid days
Leave Deduction: ₹0.00  ✅ No deduction for paid leaves
Net Salary: ₹14,000.00  ✅ Full salary when no unpaid leaves
```

### **🎯 Key Benefits**

#### **1. Accurate Leave Tracking**
- ✅ **Proper Leave Records**: Each leave day is tracked individually
- ✅ **Paid/Unpaid Distinction**: Only unpaid leaves affect salary
- ✅ **Work Days Consideration**: Only work days with unpaid leaves are deducted
- ✅ **Leave Type Integration**: Uses proper leave type categorization

#### **2. Automated Processing**
- ✅ **Automatic Population**: Approved leave requests automatically create leave records
- ✅ **Batch Processing**: `populate_leaves_from_requests()` processes all pending requests
- ✅ **Status Tracking**: Tracks which requests have been processed
- ✅ **Error Prevention**: Prevents duplicate leave records

#### **3. Manual Leave Management**
- ✅ **Admin Control**: Admins can manually add leaves
- ✅ **Flexible Leave Types**: Support for custom leave types
- ✅ **Notes Support**: Add notes to leave records
- ✅ **Audit Trail**: Track who created each leave record

#### **4. Accurate Salary Calculation**
- ✅ **Work Days Based**: Uses actual work days (26 for Mon-Sat)
- ✅ **Unpaid Leave Only**: Only deducts for unpaid leaves
- ✅ **Fair Calculation**: Paid leaves don't affect salary
- ✅ **Proper Daily Rate**: Based on actual work schedule

### **🔧 Usage Examples**

#### **1. Process Approved Leave Requests**
```sql
-- Process all approved leave requests into leaves table
SELECT public.populate_leaves_from_requests();
```

#### **2. Add Manual Leave**
```sql
-- Add a manual unpaid leave for an employee
SELECT public.add_manual_leave(
  'user_id_here',
  '2024-01-15'::DATE,
  'Sick Leave',
  false,  -- is_paid_leave = false
  'Employee was sick',
  'admin_user_id'
);
```

#### **3. Calculate Unpaid Leave Days**
```sql
-- Get unpaid leave days for salary calculation
SELECT public.calculate_unpaid_leave_days_for_salary(
  'user_id_here',
  '2024-01-01'::DATE
);
```

#### **4. Get Leave Summary**
```sql
-- Get comprehensive leave summary for an employee
SELECT * FROM public.get_employee_leave_summary(
  'user_id_here',
  '2024-01-01'::DATE
);
```

### **🚀 Migration and Setup**

#### **1. Run Migration**
```sql
-- Apply the leaves tracking system migration
-- This creates the leaves table and all functions
```

#### **2. Process Existing Data**
```sql
-- Process any existing approved leave requests
SELECT public.populate_leaves_from_requests();
```

#### **3. Test the System**
```sql
-- Test the new calculation for Arjan Singh
SELECT * FROM public.calculate_month_leave_deductions(
  (SELECT user_id FROM public.profiles WHERE name ILIKE '%arjan%' LIMIT 1),
  '2024-01-01'::DATE
);
```

### **📱 Frontend Integration**

The frontend can now:
- ✅ **Display Accurate Calculations**: Shows correct work days and unpaid leave days
- ✅ **Manual Leave Management**: Allow admins to add leaves manually
- ✅ **Leave Summary**: Show comprehensive leave information
- ✅ **Real-time Updates**: Process leave requests automatically

### **🔍 Verification Steps**

#### **1. Check Leaves Table**
```sql
SELECT * FROM public.leaves WHERE user_id = 'arjan_user_id';
```

#### **2. Test Unpaid Leave Calculation**
```sql
SELECT public.calculate_unpaid_leave_days_for_salary('arjan_user_id', '2024-01-01'::DATE);
```

#### **3. Test Complete Calculation**
```sql
SELECT * FROM public.calculate_month_leave_deductions('arjan_user_id', '2024-01-01'::DATE);
```

The new leaves tracking system ensures accurate salary calculations by properly tracking paid and unpaid leaves, considering work days, and providing comprehensive leave management capabilities!

