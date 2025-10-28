# My Leaves & Salary Page

## ✅ **New Page Created**

A comprehensive "My Leaves & Salary" page for employees and managers that shows leave history with salary deductions, excluding office holidays from unpaid leave calculations.

## 🎯 **Key Features**

### **1. Leave History with Salary Deductions**
- **Individual Leave Tracking**: Shows each leave with deduction amount
- **Office Holiday Exclusion**: Office holidays are not counted as unpaid leave
- **Daily Rate Calculation**: Shows daily salary rate for each leave
- **Deduction Reasons**: Clear explanation of why deductions occurred

### **2. Salary Summary Dashboard**
- **Base Salary**: Shows employee's base salary for the month
- **Total Deductions**: Sum of all salary deductions
- **Net Salary**: Base salary minus deductions
- **Deduction Percentage**: Percentage of salary deducted

### **3. Leave Statistics**
- **Paid Leaves**: Count of paid leave days
- **Unpaid Leaves**: Count of unpaid leave days (excluding office holidays)
- **Office Holidays**: Count of office holiday days
- **Visual Indicators**: Color-coded badges and icons

### **4. Month Selection**
- **Month Picker**: Select any month to view leave and salary data
- **Historical Data**: View past months' leave and salary information
- **Current Month Default**: Automatically shows current month

## 🎨 **UI Components**

### **Salary Summary Cards**
```
┌─────────────────────────────────────────────────────────┐
│ 💰 Base Salary: ₹50,000                                │
│ 📉 Total Deductions: ₹5,000                             │
│ 📈 Net Salary: ₹45,000                                  │
│ 📊 Deduction %: 10.0%                                   │
└─────────────────────────────────────────────────────────┘
```

### **Leave Statistics**
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Paid Leaves: 3                                       │
│ ❌ Unpaid Leaves: 2                                     │
│ 📅 Office Holidays: 1                                   │
└─────────────────────────────────────────────────────────┘
```

### **Leave History Cards**
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Sick Leave [Paid] 📅 Oct 15, 2025                   │
│ No deduction • Paid leave                               │
│                                                         │
│ ❌ Personal Leave [Unpaid] 📅 Oct 20, 2025             │
│ -₹2,500 • Daily rate: ₹2,500                           │
│                                                         │
│ 📅 Office Holiday 📅 Oct 25, 2025                      │
│ No deduction • Office holiday                          │
└─────────────────────────────────────────────────────────┘
```

## 🔧 **Technical Implementation**

### **1. Database Functions**
```sql
-- Get employee leaves with salary deductions
CREATE OR REPLACE FUNCTION public.get_employee_leaves_with_salary_deductions(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  leave_date DATE,
  leave_type_name TEXT,
  is_paid_leave BOOLEAN,
  daily_rate NUMERIC(12,2),
  deduction_amount NUMERIC(12,2),
  is_office_holiday BOOLEAN,
  deduction_reason TEXT
)
```

### **2. Salary Summary Function**
```sql
-- Get employee salary summary for a month
CREATE OR REPLACE FUNCTION public.get_employee_salary_summary(
  p_user_id UUID,
  p_month DATE
)
RETURNS TABLE(
  total_deductions NUMERIC(12,2),
  total_paid_leaves INTEGER,
  total_unpaid_leaves INTEGER,
  total_office_holidays INTEGER,
  base_salary NUMERIC(12,2),
  net_salary NUMERIC(12,2),
  deduction_percentage NUMERIC(5,2)
)
```

### **3. Key Logic**
- **Office Holiday Check**: `EXISTS (SELECT 1 FROM public.company_holidays WHERE holiday_date = l.leave_date)`
- **Deduction Calculation**: Only for unpaid leaves that are not office holidays
- **Daily Rate**: Based on employee's work days configuration
- **Net Salary**: Base salary minus total deductions

## 📊 **Data Flow**

### **1. Page Load**
1. **Authentication Check**: Verify user is logged in
2. **Role Check**: Ensure user is employee or admin
3. **Fetch Data**: Get leaves and salary data for selected month
4. **Calculate Deductions**: Process salary deductions
5. **Display Results**: Show formatted data to user

### **2. Month Selection**
1. **User Selects Month**: Choose different month from dropdown
2. **Refresh Data**: Fetch new data for selected month
3. **Update Display**: Show updated leave and salary information

### **3. Leave Filtering**
1. **Filter Selection**: User chooses filter (All, Paid, Unpaid, Holidays)
2. **Apply Filter**: Filter leaves based on selection
3. **Update Display**: Show filtered results

## 🎯 **Key Benefits**

### **1. Transparency**
- **Clear Deductions**: See exactly how much salary was deducted
- **Leave Reasons**: Understand why deductions occurred
- **Office Holiday Protection**: Office holidays don't cause deductions

### **2. Financial Awareness**
- **Salary Impact**: See how leaves affect take-home pay
- **Deduction Tracking**: Monitor salary deductions over time
- **Net Salary Calculation**: Know final salary after deductions

### **3. Leave Management**
- **Leave History**: Complete history of all leaves taken
- **Leave Types**: See different types of leaves used
- **Date Tracking**: When leaves were taken and approved

### **4. User Experience**
- **Month Navigation**: Easy month selection
- **Filtering Options**: Filter leaves by type
- **Visual Indicators**: Color-coded status indicators
- **Responsive Design**: Works on all devices

## 🚀 **Navigation Integration**

### **Sidebar Links**
- **Employee Menu**: "My Leaves & Salary" with Receipt icon
- **Manager Menu**: "My Leaves & Salary" with Receipt icon
- **Admin Menu**: Access to salary management tools

### **Route Configuration**
- **Path**: `/my-leaves-salary`
- **Component**: `MyLeavesAndSalary`
- **Error Boundary**: Wrapped in error boundary for stability

## 📱 **Responsive Design**

- **Mobile Friendly**: Cards stack properly on mobile
- **Touch Navigation**: Easy month selection on mobile
- **Readable Text**: Appropriate font sizes for all devices
- **Efficient Layout**: Optimized for small screens

## 🔒 **Security & Permissions**

- **Role-Based Access**: Only employees and managers can access
- **User-Specific Data**: Only shows current user's data
- **Secure Functions**: Database functions with proper permissions
- **Authentication Required**: Must be logged in to access

The "My Leaves & Salary" page provides complete transparency into leave history and salary deductions! 🎉

