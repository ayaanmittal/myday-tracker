# Leave Deductions Preview - Expected Results

## 🎯 **What the Leave Deductions Preview Should Show**

The "Leave Deductions Preview" should now calculate correctly based on:
1. ✅ **Employee work days** (Mon-Sat for all employees)
2. ✅ **Unpaid leave days** (from the leaves table)
3. ✅ **Daily rate calculation** (base_salary ÷ work_days_in_month)
4. ✅ **Deduction calculation** (daily_rate × unpaid_days × deduction_percentage)

## 📊 **Expected Results for October 2025**

### **Employees with Salaries and Unpaid Leaves**

#### **Dolly Jhamb**
```
Base Salary: ₹5,000
Work Days: 27 (Mon-Sat in October 2025)
Daily Rate: ₹5,000 ÷ 27 = ₹185.19
Unpaid Days: 3
Deduction (100%): ₹185.19 × 3 = ₹555.57
Net Salary: ₹5,000 - ₹555.57 = ₹4,444.43
```

#### **Isha Sharma**
```
Base Salary: ₹5,000
Work Days: 27 (Mon-Sat in October 2025)
Daily Rate: ₹5,000 ÷ 27 = ₹185.19
Unpaid Days: 3
Deduction (100%): ₹185.19 × 3 = ₹555.57
Net Salary: ₹5,000 - ₹555.57 = ₹4,444.43
```

#### **Sakshi Saglotia**
```
Base Salary: ₹10,000
Work Days: 27 (Mon-Sat in October 2025)
Daily Rate: ₹10,000 ÷ 27 = ₹370.37
Unpaid Days: 8
Deduction (100%): ₹370.37 × 8 = ₹2,962.96
Net Salary: ₹10,000 - ₹2,962.96 = ₹7,037.04
```

### **Employees with Salaries but No Unpaid Leaves**

#### **Arjan Singh**
```
Base Salary: ₹14,000
Work Days: 27 (Mon-Sat in October 2025)
Daily Rate: ₹14,000 ÷ 27 = ₹518.52
Unpaid Days: 0
Deduction (100%): ₹0.00
Net Salary: ₹14,000 - ₹0.00 = ₹14,000.00
```

### **Employees without Salaries**

#### **Ayaan Mittal, Hiralal, Jaspreet Kaur, Raman Thapa, Test Manager, Vanshika Sharma, Vikas Mittal**
```
Base Salary: null
Work Days: 27 (Mon-Sat in October 2025)
Daily Rate: ₹0.00
Unpaid Days: X (varies by employee)
Deduction (100%): ₹0.00
Net Salary: ₹0.00
```

## 🔧 **How the Calculation Works**

### **1. Work Days Calculation**
```
October 2025 has 31 days
Mon-Sat work days = 27 days
(5 Mondays + 5 Tuesdays + 5 Wednesdays + 5 Thursdays + 5 Fridays + 2 Saturdays)
```

### **2. Daily Rate Calculation**
```
Daily Rate = Base Salary ÷ Work Days in Month
Daily Rate = Base Salary ÷ 27
```

### **3. Unpaid Leave Calculation**
```
Unpaid Days = Count of leave records where is_paid_leave = false
For October 2025, this comes from the leaves table
```

### **4. Deduction Calculation**
```
Deduction = Daily Rate × Unpaid Days × Deduction Percentage
Deduction = Daily Rate × Unpaid Days × (100% or user-defined %)
```

### **5. Net Salary Calculation**
```
Net Salary = Base Salary - Deduction
Net Salary = Base Salary - (Daily Rate × Unpaid Days × Deduction %)
```

## 📈 **Frontend Display Format**

The Leave Deductions Preview should show:

```
Leave Deductions Preview
Calculated deductions based on employee work days and unpaid leave days

Dolly Jhamb
Base Salary: ₹5,000
Daily Rate: ₹185.19 (based on 27 work days)
Unpaid Days: 3 × 100% = ₹555.57
Net: ₹4,444.43

Isha Sharma  
Base Salary: ₹5,000
Daily Rate: ₹185.19 (based on 27 work days)
Unpaid Days: 3 × 100% = ₹555.57
Net: ₹4,444.43

Sakshi Saglotia
Base Salary: ₹10,000
Daily Rate: ₹370.37 (based on 27 work days)
Unpaid Days: 8 × 100% = ₹2,962.96
Net: ₹7,037.04

Arjan Singh
Base Salary: ₹14,000
Daily Rate: ₹518.52 (based on 27 work days)
Unpaid Days: 0 × 100% = ₹0.00
Net: ₹14,000.00
```

## ✅ **Key Points**

1. **Work Days**: All employees work Mon-Sat (27 days in October 2025)
2. **Daily Rate**: Calculated as base_salary ÷ 27
3. **Unpaid Days**: Counted from the leaves table for October 2025
4. **Deduction**: Daily rate × unpaid days × deduction percentage
5. **Net Salary**: Base salary - deduction

The system should now correctly calculate all these values based on the actual leave records and work days configuration!

