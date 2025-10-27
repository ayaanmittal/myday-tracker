# STEP 1: Process Leave Requests into Leaves Table

## 🎯 **Goal**
Process all approved leave requests from the `leave_requests` table into the `leaves` table.

## 🔍 **What This Step Does**

### **1. Check Current State**
- Shows how many approved leave requests exist
- Shows how many leave records exist in the `leaves` table
- Identifies unprocessed approved requests

### **2. Show Approved Leave Requests**
- Lists all approved leave requests that need processing
- Shows employee names, dates, leave types, and paid/unpaid status

### **3. Check Employee Categories and Policies**
- Shows employee categories (intern, etc.)
- Shows leave policies for each category
- Identifies which leaves should be paid/unpaid

### **4. Process Leave Requests**
- Creates leave records for each day in approved leave requests
- Applies correct paid/unpaid status based on:
  - Employee category leave policies
  - Leave type defaults
- Marks leave requests as processed

### **5. Verify Results**
- Shows total leaves created
- Shows paid vs unpaid leaves
- Shows detailed leave records
- Tests unpaid leave calculation

## 📊 **Expected Results**

### **Before Processing**
```
Leave Requests: X approved requests (unprocessed)
Leaves Table: 0 records
Unpaid Days: 0 for all employees
```

### **After Processing**
```
Leave Requests: X approved requests (processed)
Leaves Table: Y records (one per day per request)
Unpaid Days: Actual count based on leave records
```

## 🚀 **Next Steps After This**

1. **Run STEP_1_PROCESS_LEAVE_REQUESTS.sql** in Supabase SQL Editor
2. **Check results** - Should see leave records created
3. **Verify unpaid days** - Should show actual unpaid days for employees
4. **Move to Step 2** - Fix work days configuration for daily rate calculation

## 🔧 **Key Logic**

The script processes each approved leave request by:
1. **Getting request details** (employee, dates, leave type)
2. **Generating daily records** (one record per day in the leave period)
3. **Determining paid/unpaid status** based on employee category policies
4. **Creating leave records** in the `leaves` table
5. **Marking requests as processed** to avoid duplicates

This is the foundation step that will populate the `leaves` table with actual leave data!
