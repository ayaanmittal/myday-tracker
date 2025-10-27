# Leave History Grouping Fix

## ✅ **Problem Fixed**

The leave history was showing individual days instead of grouping consecutive leaves into date ranges.

**Before:**
```
❌ Vacation Leave [Unpaid] - Oct 28, 2025
❌ Vacation Leave [Unpaid] - Oct 27, 2025  
❌ Vacation Leave [Unpaid] - Oct 26, 2025
❌ Vacation Leave [Unpaid] - Oct 25, 2025
```

**After:**
```
✅ Vacation Leave [Unpaid] [4 days] - Oct 25, 2025 - Oct 28, 2025
```

## 🔧 **Technical Implementation**

### **1. Grouping Algorithm**
```typescript
const groupConsecutiveLeaves = (leaves: Leave[]) => {
  // Sort leaves by date
  const sortedLeaves = [...leaves].sort((a, b) => 
    new Date(a.leave_date).getTime() - new Date(b.leave_date).getTime()
  );

  const grouped: any[] = [];
  let currentGroup: any = null;

  for (const leave of sortedLeaves) {
    if (!currentGroup) {
      // Start a new group
      currentGroup = {
        id: leave.id,
        user_id: leave.user_id,
        leave_type_name: leave.leave_type_name,
        is_paid_leave: leave.is_paid_leave,
        start_date: leave.leave_date,
        end_date: leave.leave_date,
        duration: 1,
        individual_leaves: [leave]
      };
    } else {
      // Check if this leave can be grouped
      const currentEndDate = new Date(currentGroup.end_date);
      const leaveDate = new Date(leave.leave_date);
      const dayDifference = (leaveDate.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60 * 24);

      if (
        leave.leave_type_name === currentGroup.leave_type_name &&
        leave.is_paid_leave === currentGroup.is_paid_leave &&
        dayDifference === 1 // Consecutive day
      ) {
        // Extend the current group
        currentGroup.end_date = leave.leave_date;
        currentGroup.duration += 1;
        currentGroup.individual_leaves.push(leave);
      } else {
        // Save current group and start a new one
        grouped.push(currentGroup);
        currentGroup = { /* new group */ };
      }
    }
  }

  return grouped.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
};
```

### **2. Grouping Criteria**
Leaves are grouped together if they have:
- **Same leave type** (e.g., "Vacation Leave")
- **Same paid/unpaid status** (e.g., both "Unpaid")
- **Consecutive dates** (e.g., Oct 25, 26, 27, 28)

### **3. Display Logic**
```typescript
// Show date range for multi-day leaves
{group.start_date === group.end_date 
  ? new Date(group.start_date).toLocaleDateString()
  : `${new Date(group.start_date).toLocaleDateString()} - ${new Date(group.end_date).toLocaleDateString()}`
}

// Show duration badge
<Badge variant="outline" className="bg-blue-100 text-blue-800">
  {group.duration} day{group.duration !== 1 ? 's' : ''}
</Badge>
```

## 🎯 **Key Features**

### **1. Smart Grouping**
- **Consecutive Days**: Groups leaves that are on consecutive days
- **Same Type**: Only groups leaves of the same type
- **Same Status**: Only groups leaves with same paid/unpaid status
- **Date Ranges**: Shows start and end dates for multi-day leaves

### **2. Visual Improvements**
- **Duration Badge**: Shows number of days (e.g., "4 days")
- **Date Range**: Shows "Oct 25, 2025 - Oct 28, 2025" for multi-day leaves
- **Single Date**: Shows just "Oct 25, 2025" for single-day leaves

### **3. Management Actions**
- **Delete Group**: Deletes all individual leaves in the group
- **Individual Tracking**: Still tracks individual leave records internally
- **Bulk Operations**: Can manage entire leave periods at once

## 📊 **Example Results**

### **Before Grouping:**
```
Vacation Leave [Unpaid] - Oct 28, 2025
Vacation Leave [Unpaid] - Oct 27, 2025
Vacation Leave [Unpaid] - Oct 26, 2025
Vacation Leave [Unpaid] - Oct 25, 2025
Sick Leave [Paid] - Oct 20, 2025
```

### **After Grouping:**
```
Vacation Leave [Unpaid] [4 days] - Oct 25, 2025 - Oct 28, 2025
Sick Leave [Paid] [1 day] - Oct 20, 2025
```

## 🚀 **Benefits**

### **1. Better UX**
- **Cleaner Display**: Shows leave periods instead of individual days
- **Easier Management**: Can delete entire leave periods at once
- **Clear Duration**: Shows how many days each leave period spans

### **2. Logical Grouping**
- **Consecutive Leaves**: Groups related leave days together
- **Type Consistency**: Only groups leaves of the same type
- **Status Consistency**: Only groups leaves with same paid/unpaid status

### **3. Efficient Management**
- **Bulk Operations**: Delete entire leave periods
- **Clear Overview**: See leave patterns and durations
- **Reduced Clutter**: Less visual noise in the interface

The leave history now shows proper date ranges for consecutive leaves! 🎉
