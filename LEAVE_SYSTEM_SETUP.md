# Leave Management System - Setup Guide

## Overview
The MyDay application now includes a comprehensive Leave Management System that allows employees to apply for leave and admins to approve/reject requests. The system supports work from home requests and tracks leave balances.

## Features Implemented

### 🎯 For Employees:
- **Leave Application**: Apply for different types of leave
- **Work From Home**: Option to work from home during leave
- **Leave Balances**: View remaining leave days
- **Request Tracking**: Track status of submitted requests
- **Multiple Leave Types**: Sick, vacation, personal, work from home, etc.

### 🎯 For Admins:
- **Leave Approval**: Review and approve/reject leave requests
- **Request Management**: View all employee leave requests
- **Filter Options**: Filter by status (pending, approved, rejected)
- **Detailed Review**: See employee details, dates, reasons
- **Rejection Reasons**: Provide feedback when rejecting requests

## Database Setup

### 1. Run the Migration
Execute the SQL migration in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/20250109000002_create_leave_system.sql
```

### 2. Default Leave Types Created
The system automatically creates these leave types:
- **Sick Leave**: 12 days/year, paid, requires approval
- **Vacation Leave**: 21 days/year, paid, requires approval  
- **Personal Leave**: 5 days/year, unpaid, requires approval
- **Work From Home**: Unlimited, paid, requires approval
- **Emergency Leave**: 3 days/year, unpaid, requires approval
- **Maternity Leave**: 90 days/year, paid, requires approval
- **Paternity Leave**: 15 days/year, paid, requires approval

## Navigation Added

### Employee Navigation:
- **Leave** (Plane icon) - Apply for leave and view balances

### Admin Navigation:
- **Leave Approval** (Plane icon) - Review and approve leave requests

## How to Use

### For Employees:

#### 1. Apply for Leave
1. Go to **Leave** page
2. Fill out the leave application form:
   - Select leave type
   - Choose start and end dates
   - Provide reason (optional)
   - Check "Work from home" if applicable
3. Click "Submit Leave Request"

#### 2. View Leave Balances
- See remaining days for each leave type
- View total allocated days
- Track used days

#### 3. Track Requests
- View all submitted requests
- See status (pending, approved, rejected)
- Check approval dates and feedback

### For Admins:

#### 1. Review Requests
1. Go to **Leave Approval** page
2. See all pending requests with employee details
3. Click "Review" to see full details

#### 2. Approve/Reject Requests
1. Click "Review" on any pending request
2. See employee details, dates, reason
3. Choose "Approve" or "Reject"
4. For rejections, provide a reason
5. Confirm the action

#### 3. Filter Requests
- Use dropdown to filter by status
- View pending count badge
- See all request history

## Database Tables Created

### 1. `leave_types`
- Stores different types of leave
- Configurable days per year
- Paid/unpaid status
- Approval requirements

### 2. `leave_requests`
- Employee leave applications
- Status tracking (pending/approved/rejected)
- Work from home option
- Approval workflow

### 3. `leave_balances`
- Employee leave entitlements
- Used vs remaining days
- Year-based tracking
- Automatic calculations

## Security & Permissions

### Row Level Security (RLS):
- **Employees**: Can only view their own requests and balances
- **Admins**: Can view all requests and balances
- **Approval**: Only admins can approve/reject requests
- **Data Protection**: Secure access to sensitive leave data

## Key Features

### ✅ Leave Types
- Configurable leave types
- Paid/unpaid options
- Approval requirements
- Annual limits

### ✅ Work From Home
- Special leave type for remote work
- Option to work from home during any leave
- Flexible approval process

### ✅ Leave Balances
- Automatic balance tracking
- Year-based calculations
- Used vs remaining days
- Visual balance display

### ✅ Approval Workflow
- Admin review process
- Approval/rejection with reasons
- Status tracking
- Notification system

### ✅ Request Management
- Employee request history
- Admin approval dashboard
- Filter and search options
- Detailed request information

## Next Steps

### Immediate Setup:
1. **Run the SQL migration** in Supabase
2. **Test the system** with sample data
3. **Configure leave balances** for employees
4. **Train admins** on approval process

### Future Enhancements:
- **Leave Calendar**: Visual calendar of all leave
- **Bulk Approvals**: Approve multiple requests
- **Email Notifications**: Automatic notifications
- **Leave Reports**: Detailed analytics
- **Holiday Integration**: Company holidays
- **Team Coverage**: Coverage planning

## Troubleshooting

### Common Issues:

#### 1. "Leave types not found"
- Ensure the SQL migration ran successfully
- Check if `leave_types` table exists
- Verify RLS policies are active

#### 2. "Cannot submit leave request"
- Check user permissions
- Verify leave type is active
- Ensure dates are valid

#### 3. "Cannot approve requests"
- Verify user has admin role
- Check RLS policies
- Ensure proper authentication

### Debug Steps:
1. Check Supabase logs for errors
2. Verify database tables exist
3. Test RLS policies
4. Check user roles and permissions

## Support

### For Users:
- Check the "Leave" page for application
- Contact admin for approval issues
- Review leave balances regularly

### For Admins:
- Use "Leave Approval" page for reviews
- Check pending requests regularly
- Provide clear rejection reasons

---

This Leave Management System provides a complete solution for employee leave tracking and admin approval workflows, making your office management system much more comprehensive! 🎉
