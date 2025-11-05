# Office Holiday Function Debugging Guide

## 🔍 **Problem Analysis**

The office holiday function is not updating records despite repeated attempts. This guide provides a systematic approach to debug and fix the issue.

## 📋 **Debugging Steps**

### **1. Apply the Enhanced Function**
First, apply the enhanced function with debugging:

```sql
-- Apply the enhanced function
\i supabase/migrations/20250118_enhanced_office_holiday_function.sql
```

### **2. Run Comprehensive Debugging**
```sql
-- Run the comprehensive debugging script
\i debug_office_holiday_issue.sql
```

This will check:
- ✅ Function existence and permissions
- ✅ User authorization
- ✅ Active employees
- ✅ Current records before/after
- ✅ Constraints and triggers
- ✅ RLS policies
- ✅ Direct update capability

### **3. Test with Specific User**
```sql
-- Test with a specific user to isolate issues
\i test_office_holiday_specific_user.sql
```

This will:
- ✅ Test with a single user
- ✅ Verify function execution
- ✅ Check record updates
- ✅ Test manual updates

## 🎯 **Key Changes Made**

### **1. Correct Status Values**
- **`status`**: Changed from `'Office Holiday'` to `'holiday'`
- **`manual_status`**: Set to `'Office Holiday'`

### **2. Enhanced Debugging**
- Added `RAISE NOTICE` statements for debugging
- Added debug information in return value
- Added before/after record checks

### **3. Better Error Handling**
- More descriptive error messages
- Validation of user permissions
- Check for empty user lists

## 🔧 **Expected Results**

After applying the enhanced function:

### **New Records**
```sql
INSERT INTO unified_attendance (
  status = 'holiday',
  manual_status = 'Office Holiday',
  modification_reason = 'Bulk office holiday override'
)
```

### **Existing Records**
```sql
UPDATE unified_attendance SET
  status = 'holiday',
  manual_status = 'Office Holiday',
  modification_reason = 'Bulk office holiday override'
```

## 🚨 **Common Issues and Solutions**

### **Issue 1: No Users Found**
**Symptoms**: Function returns 0 inserted/updated
**Solution**: Check if there are active employees
```sql
SELECT COUNT(*) FROM public.profiles WHERE is_active = true;
```

### **Issue 2: Permission Denied**
**Symptoms**: "Not authorized" error
**Solution**: Check user role
```sql
SELECT role FROM public.user_roles WHERE user_id = auth.uid();
```

### **Issue 3: RLS Policy Blocking**
**Symptoms**: Function runs but no updates
**Solution**: Check RLS policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'unified_attendance';
```

### **Issue 4: Constraint Violation**
**Symptoms**: Function fails with constraint error
**Solution**: Check table constraints
```sql
SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'unified_attendance';
```

## 📊 **Debugging Output**

The enhanced function will show:
- Number of users found
- Records before update
- Number of records inserted/updated
- Records after update
- Debug information in return value

## 🎯 **Next Steps**

1. **Apply Enhanced Function**: Use the debugging version
2. **Run Debug Scripts**: Execute both debugging scripts
3. **Check Results**: Look for any error messages or warnings
4. **Test Manually**: Try direct updates to verify table access
5. **Verify Function**: Check if function is being called correctly

## 🔍 **Troubleshooting Checklist**

- [ ] Function exists and is accessible
- [ ] User has admin/manager role
- [ ] Active employees exist
- [ ] No RLS policies blocking updates
- [ ] No constraint violations
- [ ] Function is being called with correct parameters
- [ ] Date range is valid
- [ ] User IDs are valid

## 📝 **Expected Debug Output**

```
NOTICE: mark_office_holiday_range called with start_date=2025-01-25, end_date=2025-01-25, user_ids=NULL
NOTICE: Using all active employees, found 5 users
NOTICE: Debug info before update: {"total_records": 3, "records_to_update": 3, ...}
NOTICE: Inserted 2 new records
NOTICE: Updated 3 existing records
NOTICE: Debug info after update: {"records_after_update": 5, "holiday_status_count": 5, ...}
```

If you see this output, the function is working correctly! 🎉



