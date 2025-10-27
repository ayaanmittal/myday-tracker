# Work History Stat Cards Fix

## Problem
The work history stat cards were not calculating properly after implementing office holidays:
- **Absent days** should count `status = 'absent'`
- **Holiday days** should count `status = 'holiday'` OR `manual_status = 'Office Holiday'` (including Sundays)

## Changes Made

### 1. Frontend Service Fix (`src/services/workDaysService.ts`)
- **Updated query** to include `manual_status` field:
  ```typescript
  .select('entry_date, status, manual_status')
  ```
- **Updated calculation logic** to check for office holidays first:
  ```typescript
  // Check for office holidays first (manual_status = 'Office Holiday')
  if (attendanceRecord.manual_status === 'Office Holiday') {
    holidayDays++;
  } else {
    // Use status field for other cases
    switch (attendanceRecord.status) {
      case 'completed':
      case 'in_progress':
        presentDays++;
        break;
      case 'absent':
        absentDays++;
        break;
      case 'holiday':
        holidayDays++;
        break;
    }
  }
  ```

### 2. Frontend Display Fix (`src/pages/History.tsx`)
- **Fixed Absent Days calculation**:
  ```typescript
  // Before: e.status === 'absent' && e.manual_status !== 'leave_granted'
  // After: e.status === 'absent'
  {entries.filter(e => e.status === 'absent').length}
  ```
- **Fixed Holiday Days calculation**:
  ```typescript
  // Before: Complex logic excluding Sundays
  // After: Simple logic including all holidays
  {entries.filter(e => {
    return e.status === 'holiday' || e.manual_status === 'Office Holiday';
  }).length}
  ```

### 3. Database Function Fix (`supabase/migrations/20250118_fix_attendance_summary_calculation.sql`)
- **Updated `get_attendance_summary_with_holidays` function** to properly handle office holidays
- **Created new `get_work_history_stats` function** specifically for work history stat cards
- **Added office holiday detection** in database calculations:
  ```sql
  -- Check for office holidays first (manual_status = 'Office Holiday')
  IF attendance_manual_status = 'Office Holiday' THEN
      holiday_days := holiday_days + 1;
  ELSE
      -- Use the status field for other cases
      CASE attendance_status
          WHEN 'completed' THEN present_days := present_days + 1;
          WHEN 'in_progress' THEN in_progress_days := in_progress_days + 1;
          WHEN 'absent' THEN absent_days := absent_days + 1;
          WHEN 'holiday' THEN holiday_days := holiday_days + 1;
      END CASE;
  END IF;
  ```

## Result
Now the work history stat cards will correctly calculate:
- ✅ **Absent Days**: Counts all records with `status = 'absent'`
- ✅ **Holiday Days**: Counts all records with `status = 'holiday'` OR `manual_status = 'Office Holiday'` (including Sundays and office holidays)
- ✅ **Present Days**: Counts all records with `status = 'completed'` or `'in_progress'`
- ✅ **In Progress Days**: Counts all records with `status = 'in_progress'`

## Status Logic Summary
- **Absent**: `status = 'absent'`
- **Holiday**: `status = 'holiday'` OR `manual_status = 'Office Holiday'`
- **Present**: `status = 'completed'` or `'in_progress'`
- **Office Holiday**: `status = 'holiday'` AND `manual_status = 'Office Holiday'`
- **Individual Leave**: `status = 'absent'` AND `manual_status = 'leave_granted'`

The stat cards will now accurately reflect the attendance status and properly distinguish between different types of days.
