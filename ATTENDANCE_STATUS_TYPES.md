# Attendance Status Types Documentation

## Overview
This document explains the different status types used in the `unified_attendance` table and their meanings.

## Status Types

### 1. `status` Field Values

#### `'present'`
- Employee was physically present at work
- Normal working day
- Used for regular attendance

#### `'holiday'`
- Office holiday (company-wide holiday)
- Employee gets paid for this day
- Set by admin marking "Office Holiday"
- Also used for "Not Absent" marking (paid leave)

#### `'absent'`
- Employee was absent (with or without approved leave)
- Can be unauthorized absence or approved leave
- Used for both unpaid absence and individual leave

### 2. `manual_status` Field Values

#### `'Office Holiday'`
- Company-wide holiday
- All employees get this day off with pay
- Set by admin using "Mark as Office Holiday" feature

#### `'leave_granted'`
- Individual leave was granted to specific employee
- Can be paid or unpaid based on leave type and employee settings

#### `'present'`
- Manual override marking employee as present
- Used when correcting attendance records

#### `'absent'`
- Manual override marking employee as absent
- Used when correcting attendance records

## Business Logic

### Office Holiday vs Individual Leave

**Office Holiday:**
- `status = 'holiday'`
- `manual_status = 'Office Holiday'`
- Applied to all employees
- Paid leave for everyone
- Set by admin for company-wide holidays

**Individual Leave:**
- `status = 'absent'`
- `manual_status = 'leave_granted'`
- Applied to specific employee
- Can be paid or unpaid based on leave type
- Set through leave request approval

**"Not Absent" Marking:**
- Same as Office Holiday
- `status = 'holiday'`
- `manual_status = 'Office Holiday'`
- Used when admin wants to give specific employees a paid day off

## Salary Calculation Impact

### Paid Days (No Salary Deduction)
- `status = 'holiday'` (Office holidays)
- `status = 'absent'` with `manual_status = 'leave_granted'` and paid leave
- `status = 'present'`

### Unpaid Days (Salary Deduction)
- `status = 'absent'` with `manual_status = NULL` (unauthorized absence)
- `status = 'absent'` with `manual_status = 'leave_granted'` and unpaid leave

## Function Behavior

### `mark_office_holiday_range()`
- Sets `status = 'holiday'`
- Sets `manual_status = 'Office Holiday'`
- Applied to selected employees for selected date range
- All affected employees get paid for these days

### Leave Approval System
- Sets `status = 'leave_granted'`
- Sets `manual_status = 'leave_granted'`
- Applied to individual employee
- Paid/unpaid status determined by leave type and employee settings

## Examples

### Example 1: Company Holiday (Diwali)
```
status = 'holiday'
manual_status = 'Office Holiday'
modification_reason = 'Bulk office holiday override'
```
- All employees get paid
- No salary deduction

### Example 2: Individual Sick Leave (Paid)
```
status = 'absent'
manual_status = 'leave_granted'
```
- Only this employee gets paid
- No salary deduction

### Example 3: Individual Sick Leave (Unpaid)
```
status = 'absent'
manual_status = 'leave_granted'
```
- Employee doesn't get paid
- Salary deduction applies

### Example 4: Unauthorized Absence
```
status = 'absent'
manual_status = NULL
```
- Employee doesn't get paid
- Salary deduction applies

## Implementation Notes

1. **Office Holiday Function**: Always sets both `status = 'holiday'` and `manual_status = 'Office Holiday'`

2. **Leave Approval**: Sets `status = 'absent'` and `manual_status = 'leave_granted'`

3. **Salary Calculation**: 
   - Counts `status = 'holiday'` as paid days
   - Counts `status = 'absent'` with `manual_status = 'leave_granted'` and `is_paid_leave = true` as paid days
   - Counts `status = 'absent'` with `manual_status = NULL` and `status = 'absent'` with `manual_status = 'leave_granted'` and `is_paid_leave = false` as unpaid days

4. **Authorization**: Office holiday function requires admin role, but this can be bypassed for testing
