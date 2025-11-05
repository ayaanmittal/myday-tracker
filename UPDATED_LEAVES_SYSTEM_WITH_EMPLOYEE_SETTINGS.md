# Updated Leaves System with Employee Settings Integration

## ✅ **Enhanced Leaves Tracking System**

### **🔍 Key Improvements Made**

#### **1. Automatic Paid/Unpaid Detection**
- ✅ **Employee Category Based**: Uses `employee_categories` to determine leave policies
- ✅ **Leave Policy Integration**: Checks `leave_policies` for employee category and leave type
- ✅ **Custom Settings Support**: Respects `employee_leave_settings` for custom configurations
- ✅ **Hierarchical Priority**: Custom settings > Leave policies > Leave type defaults

#### **2. Comprehensive Policy System**
- ✅ **Leave Policies**: Define paid/unpaid status per employee category and leave type
- ✅ **Employee Settings**: Allow custom leave configurations per employee
- ✅ **Leave Type Defaults**: Fallback to leave type default settings
- ✅ **Validation System**: Validate leave requests against policies

### **🛠️ Enhanced Functions**

#### **1. Updated `populate_leaves_from_requests()`**
```sql
-- Now automatically detects paid/unpaid status based on:
-- 1. Employee leave settings (custom settings)
-- 2. Leave policies (employee category + leave type)
-- 3. Leave type defaults (fallback)
```

#### **2. New `get_leave_policy_for_employee()`**
```sql
-- Returns leave policy for specific employee and leave type
-- Shows: is_paid, max_days_per_year, requires_approval, policy_source
-- Priority: Custom settings > Leave policies > Leave type defaults
```

#### **3. New `update_leaves_paid_status()`**
```sql
-- Updates existing leaves with correct paid/unpaid status
-- Useful for correcting previously processed leaves
-- Returns count of updated records
```

#### **4. Enhanced `get_employee_leave_summary_with_policy()`**
```sql
-- Returns comprehensive leave summary with policy information
-- Shows: total_leave_days, paid_leave_days, unpaid_leave_days
-- Includes: leave_details (JSON), policy_summary (JSON)
```

#### **5. New `validate_leave_request()`**
```sql
-- Validates leave requests against employee policies
-- Checks: is_valid, is_paid, max_days_allowed, days_requested
-- Returns: validation_message for user feedback
```

### **📊 How the Enhanced System Works**

#### **1. Leave Request Processing Flow**
```
1. Employee submits leave request
2. System validates against employee policies
3. Admin approves the request
4. System automatically creates leave records
5. Paid/unpaid status determined by:
   - Employee custom settings (if exists)
   - Leave policies (employee category + leave type)
   - Leave type defaults (fallback)
6. Each day gets proper paid/unpaid status
```

#### **2. Policy Priority System**
```
Priority 1: Employee Custom Settings
├── employee_leave_settings.custom_leave_days
├── Override for specific leave types
└── Highest priority

Priority 2: Leave Policies
├── leave_policies (employee_category + leave_type)
├── Standard company policies
└── Medium priority

Priority 3: Leave Type Defaults
├── leave_types.is_paid
├── Default for all employees
└── Lowest priority
```

#### **3. Salary Calculation Process**
```
1. Get employee work days configuration
2. Calculate daily rate (base_salary / work_days)
3. Check leaves table for unpaid leaves only
4. Count unpaid leave days on work days
5. Calculate deduction: (unpaid_days × daily_rate)
6. Apply user-defined deduction percentage
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
Work Days: 26 (Mon-Sat, 6 days per week)  ✅
Daily Rate: ₹14,000 ÷ 26 = ₹538.46  ✅
Unpaid Days: 0 (no unpaid leave requests)  ✅
Leave Deduction: ₹0.00  ✅
Net Salary: ₹14,000.00  ✅
```

### **🎯 Key Benefits**

#### **1. Automatic Policy Detection**
- ✅ **No Manual Configuration**: System automatically detects paid/unpaid status
- ✅ **Policy Compliance**: Follows company leave policies
- ✅ **Custom Overrides**: Supports employee-specific customizations
- ✅ **Consistent Application**: Same rules applied to all employees

#### **2. Comprehensive Leave Management**
- ✅ **Policy Integration**: Uses employee categories and leave policies
- ✅ **Custom Settings**: Supports employee-specific leave configurations
- ✅ **Validation System**: Validates leave requests against policies
- ✅ **Audit Trail**: Tracks policy source for each leave

#### **3. Accurate Salary Calculation**
- ✅ **Work Days Based**: Uses actual work days (26 for Mon-Sat)
- ✅ **Unpaid Leave Only**: Only deducts for unpaid leaves
- ✅ **Policy Compliant**: Follows company leave policies
- ✅ **Fair Calculation**: Paid leaves don't affect salary

### **🔧 Usage Examples**

#### **1. Process All Approved Leave Requests**
```sql
-- Process all approved leave requests with automatic paid/unpaid detection
SELECT public.populate_leaves_from_requests();
```

#### **2. Get Leave Policy for Employee**
```sql
-- Get leave policy for specific employee and leave type
SELECT * FROM public.get_leave_policy_for_employee(
  'user_id_here',
  'leave_type_id_here'
);
```

#### **3. Update Existing Leaves**
```sql
-- Update existing leaves with correct paid/unpaid status
SELECT public.update_leaves_paid_status();
```

#### **4. Get Comprehensive Leave Summary**
```sql
-- Get detailed leave summary with policy information
SELECT * FROM public.get_employee_leave_summary_with_policy(
  'user_id_here',
  '2024-01-01'::DATE
);
```

#### **5. Validate Leave Request**
```sql
-- Validate leave request against employee policies
SELECT * FROM public.validate_leave_request(
  'user_id_here',
  'leave_type_id_here',
  '2024-01-15'::DATE,
  '2024-01-17'::DATE
);
```

### **📱 Frontend Integration**

The frontend can now:
- ✅ **Display Policy Information**: Show which policy applies to each leave
- ✅ **Validate Requests**: Validate leave requests before submission
- ✅ **Show Leave Summary**: Display comprehensive leave information
- ✅ **Policy Management**: Allow admins to manage leave policies
- ✅ **Custom Settings**: Allow employee-specific leave configurations

### **🔍 Database Schema Integration**

#### **1. Employee Categories**
```sql
-- employee_categories table defines employee types
-- Used to determine which leave policies apply
```

#### **2. Leave Policies**
```sql
-- leave_policies table defines policies per employee category
-- Specifies: is_paid, max_days_per_year, requires_approval
```

#### **3. Employee Leave Settings**
```sql
-- employee_leave_settings table for custom configurations
-- Allows: custom_leave_days (JSON), is_custom_settings
```

#### **4. Leave Types**
```sql
-- leave_types table defines available leave types
-- Provides: default is_paid, max_days_per_year, requires_approval
```

### **🚀 Migration and Setup**

#### **1. Apply Migration**
```sql
-- Apply the updated leaves system migration
-- This enhances the existing leaves system
```

#### **2. Process Existing Data**
```sql
-- Process all approved leave requests
SELECT public.populate_leaves_from_requests();

-- Update existing leaves with correct status
SELECT public.update_leaves_paid_status();
```

#### **3. Test the System**
```sql
-- Test the enhanced system
SELECT * FROM public.get_employee_leave_summary_with_policy(
  'arjan_user_id',
  '2024-01-01'::DATE
);
```

### **📊 Verification Steps**

#### **1. Check Leave Policies**
```sql
SELECT 
  ec.name as category_name,
  lt.name as leave_type_name,
  lp.is_paid,
  lp.max_days_per_year
FROM public.employee_categories ec
JOIN public.leave_policies lp ON lp.employee_category_id = ec.id
JOIN public.leave_types lt ON lt.id = lp.leave_type_id;
```

#### **2. Test Policy Detection**
```sql
SELECT 
  p.name,
  public.get_leave_policy_for_employee(p.user_id, lt.id) as policy_info
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE p.name ILIKE '%arjan%';
```

#### **3. Verify Leave Calculation**
```sql
SELECT 
  p.name,
  public.calculate_unpaid_leave_days_for_salary(p.user_id, '2024-01-01'::DATE) as unpaid_days,
  public.calculate_month_leave_deductions(p.user_id, '2024-01-01'::DATE) as deduction_calculation
FROM public.profiles p
WHERE p.name ILIKE '%arjan%';
```

The enhanced leaves system now automatically detects paid/unpaid status based on employee settings and categories, ensuring accurate salary calculations while maintaining policy compliance!



