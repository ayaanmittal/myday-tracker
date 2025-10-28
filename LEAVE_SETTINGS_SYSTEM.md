# Leave Settings System

## Overview

The Leave Settings System provides comprehensive leave management for admins, allowing them to configure employee categories, leave types, and policies. The system supports different employee types (permanent, intern, temporary) with varying leave entitlements and probation periods.

## Database Schema Changes

### 1. Updated `profiles` Table
- Added `employee_category` (text): Employee type (permanent, intern, temporary)
- Added `joined_on_date` (date): Date when employee joined the company
- Added `probation_period_months` (integer): Probation period in months

### 2. New `employee_categories` Table
Manages different employee types with their characteristics:
- `name`: Category name (permanent, intern, temporary)
- `description`: Brief description
- `is_paid_leave_eligible`: Whether this category gets paid leaves
- `probation_period_months`: Default probation period
- `is_active`: Whether the category is active

### 3. New `leave_policies` Table
Admin-configurable leave rules for each category and leave type combination:
- `name`: Policy name
- `description`: Policy description
- `employee_category_id`: Reference to employee category
- `leave_type_id`: Reference to leave type
- `max_days_per_year`: Maximum days per year
- `probation_max_days`: Maximum days during probation
- `is_paid`: Whether the leave is paid
- `requires_approval`: Whether approval is required
- `is_active`: Whether the policy is active

### 4. New `employee_leave_settings` Table
Individual employee leave configurations that override default category rules:
- `user_id`: Reference to user
- `employee_category_id`: Reference to employee category
- `custom_leave_days`: JSON object with custom leave allocations
- `is_custom_settings`: Whether custom settings are applied
- `notes`: Additional notes

### 5. Updated `leave_balances` Table
- Added `employee_category_id`: Reference to employee category
- Added `probation_eligible`: Whether the balance is probation-eligible

## Key Features

### 1. Employee Categories
- **Permanent**: 3+ months, eligible for paid leaves
- **Intern**: No paid leaves, typically 0-month probation
- **Temporary**: No paid leaves, contract-based

### 2. Leave Policies
- Configurable per employee category and leave type
- Separate rules for probation vs. confirmed employees
- Admin can set maximum days, approval requirements, and payment status

### 3. Individual Employee Management
- Admins can override default category rules for specific employees
- Custom leave allocations per employee
- Track probation status and remaining probation days
- Update employee category, join date, and probation period

### 4. Automatic Calculations
- **Probation Status**: Automatically calculated based on join date and probation period
- **Leave Allocation**: Uses probation rules during probation, regular rules after
- **Balance Updates**: Automatically recalculated when employee category changes

## Database Functions

### `is_employee_on_probation(user_id)`
Returns boolean indicating if employee is still on probation.

### `get_employee_leave_allocation(user_id, leave_type_id)`
Returns the leave allocation for an employee based on their category and probation status.

## Admin Interface

### 1. Leave Settings Page (`/src/pages/LeaveSettings.tsx`)
Comprehensive admin interface with four main tabs:

#### Categories Tab
- Create/edit employee categories
- Set probation periods and leave eligibility
- Manage category status

#### Leave Types Tab
- Create/edit leave types (Annual, Sick, Personal, etc.)
- Configure payment status and approval requirements
- Manage leave type status

#### Policies Tab
- Create/edit leave policies for category-leave type combinations
- Set different rules for probation vs. confirmed employees
- Configure maximum days and requirements

#### Employees Tab
- View all employees with their categories and probation status
- Quick access to individual employee management

### 2. Employee Leave Manager (`/src/components/EmployeeLeaveManager.tsx`)
Dedicated component for managing individual employees:

#### Employee Management
- Update employee category
- Modify join date and probation period
- View probation status and remaining days

#### Leave Balance Management
- View current leave balances
- See probation vs. confirmed allocations
- Track used and remaining days

#### Custom Settings
- Override default category rules for specific employees
- Set custom leave allocations
- Add notes for special cases

## Usage Examples

### Setting Up a New Employee Category
1. Go to Leave Settings → Categories
2. Click "Create Category"
3. Set name, description, probation period, and leave eligibility
4. Save the category

### Creating Leave Policies
1. Go to Leave Settings → Policies
2. Select employee category and leave type
3. Set maximum days for confirmed employees
4. Set different maximum days for probation period
5. Configure payment and approval requirements

### Managing Individual Employees
1. Go to Leave Settings → Employees
2. Click "Manage" for any employee
3. Update category, join date, or probation period
4. Set custom leave allocations if needed
5. Add notes for special circumstances

## Business Rules

### Permanent Employees (3+ months)
- Eligible for paid leaves
- 3-month probation period by default
- Full leave allocation after probation
- Reduced allocation during probation

### Interns
- Not eligible for paid leaves
- 0-month probation period
- No leave allocation

### Temporary Employees
- Not eligible for paid leaves
- 0-month probation period
- No leave allocation

## Security and Permissions

- Row Level Security (RLS) enabled on all new tables
- Only authenticated users can view categories and policies
- Users can view their own leave settings
- Admins can view and modify all settings
- Proper foreign key constraints ensure data integrity

## Migration

The system includes a comprehensive migration file:
`/supabase/migrations/20250110000004_leave_settings_system.sql`

This migration:
1. Adds new columns to existing tables
2. Creates new tables with proper relationships
3. Inserts default data (employee categories)
4. Creates helper functions
5. Sets up RLS policies
6. Creates triggers for automatic updates

## Future Enhancements

1. **Bulk Operations**: Import/export employee settings
2. **Reporting**: Leave utilization reports by category
3. **Notifications**: Alerts for probation ending, leave balance low
4. **Approval Workflows**: Integration with existing leave request system
5. **Audit Trail**: Track changes to employee settings
6. **Templates**: Predefined settings for common scenarios

## Integration Points

- **Existing Leave System**: Works with current `leave_requests` and `leave_balances` tables
- **User Management**: Integrates with existing `profiles` and `user_roles` tables
- **Attendance System**: Can be extended to consider leave status in attendance calculations
- **Notifications**: Can trigger notifications based on leave settings changes

This system provides a comprehensive foundation for managing employee leave entitlements with flexibility for different employee types and individual customization when needed.

