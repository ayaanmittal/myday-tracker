# Leave Balance Tracking System

## Overview

The Leave Balance Tracking System provides comprehensive management of employee leave allocations, usage, and remaining balances. It automatically calculates annual leave entitlements based on employee categories, probation status, and configured policies.

## Key Features

### 1. **Annual Leave Allocation**
- **Permanent Employees (3+ months)**: Receive full annual leave allocation based on their category and policies
- **Probation Employees**: Receive limited probation leave allocation
- **Temporary/Intern Employees**: No paid leave allocation (configurable)

### 2. **Automatic Balance Calculation**
- Balances are automatically calculated when:
  - Employee categories are updated
  - Leave policies are modified
  - Employee join dates or probation periods change
  - Manual refresh is triggered

### 3. **Probation vs Confirmed Status**
- **On Probation**: Limited leave allocation based on probation policies
- **Confirmed**: Full annual allocation based on employee category
- Automatic status detection based on join date and probation period

### 4. **Real-time Tracking**
- Live updates of leave usage
- Visual progress indicators
- Detailed breakdown by leave type
- Year-over-year comparison

## Database Schema

### Core Tables

#### `leave_balances`
Tracks individual employee leave balances for each leave type and year.

```sql
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES profiles(id),
    leave_type_id UUID REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    allocated_days INTEGER DEFAULT 0,
    used_days INTEGER DEFAULT 0,
    remaining_days INTEGER DEFAULT 0,
    probation_allocated_days INTEGER DEFAULT 0,
    probation_used_days INTEGER DEFAULT 0,
    probation_remaining_days INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Functions

#### `refresh_employee_leave_balances(target_year INTEGER)`
- Recalculates all leave balances for a given year
- Automatically triggered when policies or employee data changes
- Returns summary of processed employees and created balances

#### `get_employee_leave_summary(emp_id UUID, target_year INTEGER)`
- Returns comprehensive leave summary for a specific employee
- Includes total allocations, usage, and remaining days
- Separates probation and confirmed employee balances

#### `update_leave_usage(emp_id UUID, leave_type_id UUID, days_used INTEGER, target_year INTEGER)`
- Updates leave usage when employees take leave
- Automatically handles probation vs confirmed status
- Returns updated balance information

## Business Rules

### 1. **Employee Categories**
- **Permanent**: Full leave benefits after probation period
- **Temporary**: No paid leave (configurable)
- **Intern**: No paid leave (configurable)

### 2. **Probation Period**
- Default: 3 months (configurable per category)
- During probation: Limited leave allocation
- After probation: Full annual allocation

### 3. **Leave Allocation**
- Based on employee category and leave policies
- Automatic calculation on policy changes
- Year-based tracking (January to December)

### 4. **Leave Usage**
- Tracks actual days taken
- Updates remaining balances
- Maintains separate probation and confirmed tracking

## Admin Interface

### Leave Settings Page
- **Overview Tab**: System summary and quick actions
- **Categories Tab**: Manage employee categories and rules
- **Leave Types Tab**: Configure different types of leave
- **Policies Tab**: Set allocation rules per category and leave type
- **Employees Tab**: Manage individual employee settings
- **Leave Balances Tab**: View and manage all employee balances

### Key Features
- **Year Selection**: View balances for different years
- **Employee Filtering**: Focus on specific employees
- **Real-time Refresh**: Update balances manually
- **Detailed Views**: Drill down into individual employee balances
- **Visual Indicators**: Progress bars and status badges

## Usage Examples

### 1. **Setting Up a New Employee Category**
```sql
-- Create a new category
INSERT INTO employee_categories (name, description, is_paid_leave_eligible, probation_period_months)
VALUES ('Senior Manager', 'Senior management positions', true, 6);

-- Create leave policies for this category
INSERT INTO leave_policies (name, employee_category_id, leave_type_id, max_days_per_year, probation_max_days)
VALUES ('Annual Leave for Senior Managers', 'category_id', 'leave_type_id', 25, 5);
```

### 2. **Refreshing Leave Balances**
```sql
-- Refresh all balances for current year
SELECT refresh_employee_leave_balances();

-- Refresh for specific year
SELECT refresh_employee_leave_balances(2024);
```

### 3. **Getting Employee Summary**
```sql
-- Get comprehensive leave summary for an employee
SELECT get_employee_leave_summary('employee_uuid', 2024);
```

### 4. **Updating Leave Usage**
```sql
-- Record leave usage
SELECT update_leave_usage('employee_uuid', 'leave_type_uuid', 3, 2024);
```

## Integration Points

### 1. **Employee Work History**
- Leave balances are displayed in employee work history
- Shows total allocated, used, and remaining days
- Includes probation status and category information

### 2. **Leave Application System**
- Integrates with leave request workflow
- Automatically updates balances when leave is approved
- Validates against remaining balance

### 3. **Reporting System**
- Provides data for attendance reports
- Supports year-over-year analysis
- Enables category-based reporting

## Configuration

### 1. **Default Settings**
- Probation period: 3 months
- Annual leave for permanent employees: 21 days
- Probation leave: 5 days
- Temporary/Intern employees: 0 paid days

### 2. **Customization**
- All settings are configurable through admin interface
- Policies can be updated without system restart
- Changes automatically trigger balance recalculation

## Monitoring and Maintenance

### 1. **Automatic Triggers**
- Balance recalculation on policy changes
- Employee data updates
- Category modifications

### 2. **Manual Refresh**
- Admin can trigger manual refresh
- Useful for bulk updates or corrections
- Returns processing summary

### 3. **Data Integrity**
- Foreign key constraints ensure data consistency
- Automatic validation of leave allocations
- Error handling for invalid configurations

## Future Enhancements

### 1. **Advanced Features**
- Carry-forward unused leave
- Leave encashment tracking
- Multi-year balance history
- Leave transfer between employees

### 2. **Reporting**
- Detailed leave analytics
- Category-wise reports
- Usage trend analysis
- Compliance reporting

### 3. **Integration**
- Calendar integration
- Email notifications
- Mobile app support
- API endpoints for external systems

## Troubleshooting

### Common Issues

1. **Balances not updating**
   - Check if policies are active
   - Verify employee category assignments
   - Trigger manual refresh

2. **Incorrect allocations**
   - Review leave policies
   - Check employee category settings
   - Verify probation period calculations

3. **Missing balances**
   - Ensure employee is active
   - Check if category is paid leave eligible
   - Verify policy configurations

### Support Functions

```sql
-- Check employee status
SELECT 
    name,
    employee_category,
    joined_on_date,
    probation_period_months,
    is_active
FROM profiles 
WHERE id = 'employee_uuid';

-- Check leave policies
SELECT 
    lp.name,
    ec.name as category,
    lt.name as leave_type,
    lp.max_days_per_year,
    lp.probation_max_days
FROM leave_policies lp
JOIN employee_categories ec ON lp.employee_category_id = ec.id
JOIN leave_types lt ON lp.leave_type_id = lt.id
WHERE lp.is_active = true;

-- Check current balances
SELECT 
    p.name,
    lt.name as leave_type,
    lb.allocated_days,
    lb.used_days,
    lb.remaining_days
FROM leave_balances lb
JOIN profiles p ON lb.employee_id = p.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE lb.year = 2024;
```

This system provides a comprehensive solution for managing employee leave balances with automatic calculations, real-time tracking, and detailed reporting capabilities.

