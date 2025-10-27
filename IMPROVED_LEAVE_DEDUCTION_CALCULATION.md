# Improved Leave Deduction Calculation System

## ✅ **Problem Identified**

The original leave deduction calculation was **incorrectly implemented**:

### **❌ Previous Issues**
1. **Simple Division**: Used `base_salary / 30` for daily rate (ignoring actual work days)
2. **No Work Days Consideration**: Didn't check employee work day configuration
3. **Inaccurate Calculation**: Didn't consider weekends, holidays, or custom work schedules
4. **Fixed Percentage**: Used hardcoded deduction percentage instead of user input

### **🔧 Root Cause**
```typescript
// OLD - INCORRECT CALCULATION
const dailyRate = employee.base_salary / 30; // ❌ Wrong: assumes 30 work days
const estimatedUnpaidDays = 2; // ❌ Hardcoded
const leaveDeductionRate = generateData.unpaidLeavePercentage / 100;
const estimatedDeduction = (dailyRate * estimatedUnpaidDays) * leaveDeductionRate;
```

## ✅ **New Implementation**

### **🎯 Proper Calculation Flow**

#### **1. Check Employee Work Days**
```sql
-- Get employee work days configuration
SELECT * FROM employee_work_days WHERE user_id = p_user_id;
-- Default: Mon-Fri if no configuration exists
```

#### **2. Calculate Actual Work Days in Month**
```sql
-- Loop through each day in the month
-- Check if it's a work day based on employee configuration
-- Count only work days (exclude weekends/holidays)
```

#### **3. Calculate Accurate Daily Rate**
```sql
-- Daily Rate = Base Salary / Actual Work Days in Month
-- NOT Base Salary / 30
```

#### **4. Count Unpaid Leave Days**
```sql
-- Count only absent days that fall on work days
-- Exclude weekends and holidays from unpaid leave calculation
```

#### **5. Apply User-Defined Percentage**
```sql
-- Deduction = (Daily Rate × Unpaid Days) × (User Percentage / 100)
-- User can set any percentage (e.g., 50%, 100%, 75%)
```

### **📊 Database Functions Created**

#### **1. `calculate_employee_leave_deductions`**
```sql
CREATE OR REPLACE FUNCTION calculate_employee_leave_deductions(
  p_user_id UUID,
  p_payment_month DATE,
  p_deduction_percentage NUMERIC(5,2) DEFAULT 100.00
)
RETURNS TABLE(
  employee_name TEXT,
  base_salary NUMERIC(12,2),
  work_days_in_month INTEGER,
  daily_rate NUMERIC(12,2),
  unpaid_leave_days INTEGER,
  leave_deduction_amount NUMERIC(12,2),
  net_salary NUMERIC(12,2),
  deduction_percentage NUMERIC(5,2)
)
```

#### **2. `get_employee_work_days_summary`**
```sql
CREATE OR REPLACE FUNCTION get_employee_work_days_summary(
  p_user_id UUID,
  p_payment_month DATE
)
RETURNS TABLE(
  total_days_in_month INTEGER,
  work_days_in_month INTEGER,
  weekend_days INTEGER,
  work_days_config JSONB
)
```

### **🛠️ Frontend Integration**

#### **1. Updated Salary Service**
```typescript
// NEW - PROPER CALCULATION
static async calculateEmployeeLeaveDeductions(
  userId: string,
  paymentMonth: string,
  deductionPercentage: number = 100
): Promise<{
  employee_name: string;
  base_salary: number;
  work_days_in_month: number;
  daily_rate: number;
  unpaid_leave_days: number;
  leave_deduction_amount: number;
  net_salary: number;
  deduction_percentage: number;
}>
```

#### **2. Enhanced UI Display**
```typescript
// Shows detailed breakdown
<p>Base Salary: {formatCurrency(employee.base_salary)}</p>
<p>Daily Rate: {formatCurrency(dailyRate)} (based on {workDays} work days)</p>
<p>Unpaid Days: {unpaidDays} × {percentage}% = {formatCurrency(deduction)}</p>
<p>Advance: {formatCurrency(advanceAmount)}</p>
```

### **📈 Calculation Examples**

#### **Example 1: Standard Employee (Mon-Fri)**
```
Base Salary: ₹50,000
Work Days in Month: 22 (Mon-Fri only)
Daily Rate: ₹50,000 ÷ 22 = ₹2,272.73
Unpaid Days: 2
Deduction Percentage: 100%
Leave Deduction: ₹2,272.73 × 2 × 100% = ₹4,545.46
Net Salary: ₹50,000 - ₹4,545.46 = ₹45,454.54
```

#### **Example 2: Part-time Employee (Mon-Wed-Fri)**
```
Base Salary: ₹30,000
Work Days in Month: 13 (Mon-Wed-Fri only)
Daily Rate: ₹30,000 ÷ 13 = ₹2,307.69
Unpaid Days: 1
Deduction Percentage: 75%
Leave Deduction: ₹2,307.69 × 1 × 75% = ₹1,730.77
Net Salary: ₹30,000 - ₹1,730.77 = ₹28,269.23
```

#### **Example 3: Weekend Worker (Sat-Sun)**
```
Base Salary: ₹40,000
Work Days in Month: 8 (Sat-Sun only)
Daily Rate: ₹40,000 ÷ 8 = ₹5,000.00
Unpaid Days: 1
Deduction Percentage: 100%
Leave Deduction: ₹5,000.00 × 1 × 100% = ₹5,000.00
Net Salary: ₹40,000 - ₹5,000.00 = ₹35,000.00
```

### **🎯 Key Improvements**

#### **1. Accurate Work Days Calculation**
- ✅ **Considers Employee Schedule**: Mon-Fri, Mon-Sat, custom schedules
- ✅ **Excludes Weekends**: Only counts actual work days
- ✅ **Handles Holidays**: Can be extended to exclude company holidays
- ✅ **Flexible Configuration**: Each employee can have different work days

#### **2. Proper Daily Rate Calculation**
- ✅ **Based on Work Days**: Not fixed 30-day assumption
- ✅ **Accurate Per-Day Salary**: Reflects actual work schedule
- ✅ **Fair Deductions**: Only deducts for work days missed

#### **3. User-Configurable Percentage**
- ✅ **Flexible Deduction**: User can set any percentage (0-100%)
- ✅ **Partial Deductions**: Can deduct 50%, 75%, etc.
- ✅ **Policy Compliance**: Matches company leave policies

#### **4. Detailed Breakdown**
- ✅ **Transparent Calculation**: Shows all steps
- ✅ **Work Days Count**: Displays actual work days in month
- ✅ **Daily Rate**: Shows calculated daily rate
- ✅ **Deduction Logic**: Clear explanation of deductions

### **📱 User Experience**

#### **1. Generate Salary Payments Dialog**
```
Unpaid Leave Deduction Settings
├── Deduction Percentage: [100%] (user input)
└── Explanation: "e.g., 100% = full day's salary deducted"

Leave Deductions Preview
├── Employee: John Doe
├── Base Salary: ₹50,000
├── Daily Rate: ₹2,272.73 (based on 22 work days)
├── Unpaid Days: 2 × 100% = ₹4,545.46
├── Advance: ₹2,000
└── Net: ₹43,454.54 (13.1% total deduction)
```

#### **2. Work Days Configuration**
```
Employee Work Days Settings
├── Monday: ✅
├── Tuesday: ✅
├── Wednesday: ✅
├── Thursday: ✅
├── Friday: ✅
├── Saturday: ❌
└── Sunday: ❌
```

### **🚀 Benefits**

1. **Accurate Calculations**: Based on actual work days, not assumptions
2. **Fair Deductions**: Only deducts for missed work days
3. **Flexible Policies**: Supports different deduction percentages
4. **Transparent Process**: Clear breakdown of all calculations
5. **Employee-Specific**: Each employee can have different work schedules
6. **Policy Compliance**: Matches company leave and salary policies
7. **Audit Trail**: Detailed calculation breakdown for transparency

### **🔧 Technical Implementation**

#### **Database Functions**
- ✅ **`calculate_employee_leave_deductions`**: Main calculation function
- ✅ **`get_employee_work_days_summary`**: Work days analysis
- ✅ **`calculate_month_leave_deductions`**: Updated with work days
- ✅ **Proper Error Handling**: Graceful fallbacks for missing data

#### **Frontend Integration**
- ✅ **SalaryService**: New methods for advanced calculations
- ✅ **Async Calculations**: Proper async/await for database calls
- ✅ **Detailed UI**: Shows complete calculation breakdown
- ✅ **User Input**: Configurable deduction percentage

#### **Migration Files**
- ✅ **`20250118_fix_leave_deduction_calculation.sql`**: Updates existing functions
- ✅ **`20250118_create_advanced_leave_calculation.sql`**: New advanced functions
- ✅ **Backward Compatibility**: Maintains existing functionality

The leave deduction calculation now properly considers employee work days, calculates accurate daily rates, and applies user-defined deduction percentages, providing a fair and transparent salary calculation system!
