import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileText,
  Filter
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeaveWithDeduction {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type_name: string;
  is_paid_leave: boolean;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  notes: string | null;
  // Salary deduction fields
  daily_rate: number;
  deduction_amount: number;
  is_office_holiday: boolean;
  deduction_reason: string;
}

interface SalarySummary {
  total_deductions: number;
  total_paid_leaves: number;
  total_unpaid_leaves: number;
  total_office_holidays: number;
  base_salary: number;
  net_salary: number;
  deduction_percentage: number;
}

interface SalaryPayment {
  id: string;
  user_id: string;
  profile_id: string;
  payment_month: string;
  base_salary: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  leave_deductions: number;
  unpaid_leave_days: number;
  deduction_percentage: number;
  is_paid: boolean;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function MyLeavesAndSalary() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  
  const [leaves, setLeaves] = useState<LeaveWithDeduction[]>([]);
  const [salarySummary, setSalarySummary] = useState<SalarySummary | null>(null);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [leaveFilter, setLeaveFilter] = useState<'all' | 'paid' | 'unpaid' | 'holidays'>('all');
  const [monthChanging, setMonthChanging] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (role && role !== 'employee' && role !== 'admin' && role !== 'manager') {
      navigate('/dashboard');
      return;
    }

    fetchLeavesAndSalary();
  }, [user, role, selectedYear, selectedMonth]);

  const handleYearChange = (newYear: number) => {
    setMonthChanging(true);
    setSelectedYear(newYear);
  };

  const handleMonthChange = (newMonth: number) => {
    setMonthChanging(true);
    setSelectedMonth(newMonth);
  };

  const togglePeriodExpansion = (periodId: string) => {
    setExpandedPeriods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(periodId)) {
        newSet.delete(periodId);
      } else {
        newSet.add(periodId);
      }
      return newSet;
    });
  };

  const fetchLeavesAndSalary = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Try to fetch from database functions first
      try {
        // Format the selected year and month for the API call
        const formattedMonth = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        
        const { data: leavesData, error: leavesError } = await supabase
          .rpc('get_employee_leaves_with_salary_deductions', {
            p_user_id: user.id,
            p_month: formattedMonth + '-01'
          });

        if (!leavesError && leavesData) {
          console.log('Leaves data:', leavesData);
          setLeaves(leavesData);
        } else {
          console.error('Leaves error:', leavesError);
          console.log('Leaves data received:', leavesData);
          setLeaves([]);
        }

        const { data: summaryData, error: summaryError } = await supabase
          .rpc('get_employee_salary_summary', {
            p_user_id: user.id,
            p_month: formattedMonth + '-01'
          });

        if (!summaryError && summaryData && summaryData.length > 0) {
          console.log('Salary summary data:', summaryData[0]);
          console.log('Office holidays count from RPC:', summaryData[0].total_office_holidays);
          
          // FRONTEND FIX: Calculate office holidays correctly
          const fixedSummary = { ...summaryData[0] };
          const summaryMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
          const summaryMonthEnd = new Date(selectedYear, selectedMonth, 0);
          
          // Count Sundays in the month
          let sundayCount = 0;
          for (let d = new Date(summaryMonthStart); d <= summaryMonthEnd; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === 0) { // Sunday
              sundayCount++;
            }
          }
          
          // Get company holidays count from leaves data (office holidays)
          const companyHolidays = leavesData?.filter(leave => 
            leave.is_office_holiday && 
            new Date(leave.leave_date).getMonth() === selectedMonth - 1 &&
            new Date(leave.leave_date).getFullYear() === selectedYear
          ).length || 0;
          
          // Total office holidays = company holidays + Sundays
          const totalOfficeHolidays = companyHolidays + sundayCount;
          
          console.log(`Frontend calculation: ${companyHolidays} company holidays + ${sundayCount} Sundays = ${totalOfficeHolidays} total office holidays`);
          
          fixedSummary.total_office_holidays = totalOfficeHolidays;
          
          setSalarySummary(fixedSummary);
        } else {
          console.error('Salary summary error:', summaryError);
          console.log('Summary data received:', summaryData);
          setSalarySummary({
            total_deductions: 0,
            total_paid_leaves: 0,
            total_unpaid_leaves: 0,
            total_office_holidays: 0,
            base_salary: 0,
            net_salary: 0,
            deduction_percentage: 0
          });
        }

        // Fetch salary payments for the selected month
        const { data: paymentsData, error: paymentsError } = await supabase
          .rpc('get_employee_salary_payment', {
            p_user_id: user.id,
            p_month: formattedMonth + '-01'
          });

        if (!paymentsError && paymentsData) {
          setSalaryPayments(paymentsData);
        } else {
          console.warn('No salary payments found:', paymentsError);
          setSalaryPayments([]);
        }
      } catch (functionError) {
        console.warn('Database functions not available, using fallback data');
        
        // Fallback: Use basic data from existing tables with proper office holiday handling
        const formattedMonth = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
        const monthStart = new Date(formattedMonth + '-01');
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        
        
        // Note: unified_attendance table may not have all required columns
        // This is a placeholder for future implementation
        const attendanceData = null;


        // Note: company_holidays table doesn't exist in current schema
        // This is a placeholder for future implementation
        let officeHolidayDates = new Set();
        
        // FRONTEND FALLBACK: Calculate office holidays correctly
        const fallbackMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const fallbackMonthEnd = new Date(selectedYear, selectedMonth, 0);
        
        // Count Sundays in the month
        let fallbackSundayCount = 0;
        for (let d = new Date(fallbackMonthStart); d <= fallbackMonthEnd; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === 0) { // Sunday
            fallbackSundayCount++;
          }
        }
        
        // For fallback, assume 2 company holidays for October 2025 (Diwali)
        const fallbackCompanyHolidays = (selectedYear === 2025 && selectedMonth === 10) ? 2 : 0;
        const fallbackTotalOfficeHolidays = fallbackCompanyHolidays + fallbackSundayCount;
        
        console.log(`Fallback calculation: ${fallbackCompanyHolidays} company holidays + ${fallbackSundayCount} Sundays = ${fallbackTotalOfficeHolidays} total office holidays`);
        
        setLeaves([]);
        setSalarySummary({
          total_deductions: 0,
          total_paid_leaves: 0,
          total_unpaid_leaves: 0,
          total_office_holidays: fallbackTotalOfficeHolidays,
          base_salary: 0,
          net_salary: 0,
          deduction_percentage: 0
        });

        // Note: salary_payments table doesn't exist in current schema
        // This is a placeholder for future implementation
        setSalaryPayments([]);
      }

    } catch (error: any) {
      console.error('Error fetching data:', error);
      // Set default values to ensure page always shows something
      setLeaves([]);
      setSalarySummary({
        total_deductions: 0,
        total_paid_leaves: 0,
        total_unpaid_leaves: 0,
        total_office_holidays: 0,
        base_salary: 0,
        net_salary: 0,
        deduction_percentage: 0
      });
      setSalaryPayments([]);
    } finally {
      setLoading(false);
      setMonthChanging(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Generate years from 5 years ago to 2 years in the future
    for (let i = 5; i >= 0; i--) {
      years.push(currentYear - i);
    }
    for (let i = 1; i <= 2; i++) {
      years.push(currentYear + i);
    }
    
    return years;
  };

  const getMonthOptions = () => {
    const months = [
      { value: 1, label: 'January' },
      { value: 2, label: 'February' },
      { value: 3, label: 'March' },
      { value: 4, label: 'April' },
      { value: 5, label: 'May' },
      { value: 6, label: 'June' },
      { value: 7, label: 'July' },
      { value: 8, label: 'August' },
      { value: 9, label: 'September' },
      { value: 10, label: 'October' },
      { value: 11, label: 'November' },
      { value: 12, label: 'December' }
    ];
    
    return months;
  };

  const filteredLeaves = leaves.filter(leave => {
    if (leaveFilter === 'all') return true;
    if (leaveFilter === 'paid') return leave.is_paid_leave;
    if (leaveFilter === 'unpaid') return !leave.is_paid_leave && !leave.is_office_holiday;
    if (leaveFilter === 'holidays') return leave.is_office_holiday;
    return true;
  });

  // Function to group consecutive leave days into periods
  const groupLeavesIntoPeriods = (leaves: LeaveWithDeduction[]) => {
    if (leaves.length === 0) return [];

    console.log('Original leaves count:', leaves.length);
    console.log('Original leaves:', leaves.map(l => ({ date: l.leave_date, type: l.leave_type_name })));

    // First, deduplicate leaves by date (keep the first occurrence)
    const uniqueLeaves = leaves.reduce((acc, leave) => {
      const dateKey = leave.leave_date;
      if (!acc[dateKey]) {
        acc[dateKey] = leave;
      } else {
        console.log(`Duplicate found for ${dateKey}, skipping`);
      }
      return acc;
    }, {} as Record<string, LeaveWithDeduction>);

    // Convert back to array and sort by date
    const sortedLeaves = Object.values(uniqueLeaves).sort((a, b) => 
      new Date(a.leave_date).getTime() - new Date(b.leave_date).getTime()
    );

    console.log('After deduplication:', sortedLeaves.length);
    console.log('Unique leaves:', sortedLeaves.map(l => ({ date: l.leave_date, type: l.leave_type_name })));

    const periods: Array<{
      id: string;
      leave_type_name: string;
      start_date: string;
      end_date: string;
      duration: number;
      is_paid_leave: boolean;
      is_office_holiday: boolean;
      total_deduction: number;
      daily_rate: number;
      deduction_reason: string;
      notes: string;
      leaves: LeaveWithDeduction[];
    }> = [];

    let currentPeriod: LeaveWithDeduction[] = [];
    let currentType = '';
    let currentPaidStatus = false;
    let currentOfficeHoliday = false;

    for (let i = 0; i < sortedLeaves.length; i++) {
      const leave = sortedLeaves[i];
      const leaveDate = new Date(leave.leave_date);
      const prevLeaveDate = currentPeriod.length > 0 ? 
        new Date(currentPeriod[currentPeriod.length - 1].leave_date) : null;

      // Check if this leave can be grouped with the current period
      // Only group if consecutive (within 1 day) - don't require same type/status
      const isConsecutive = prevLeaveDate ? 
        (leaveDate.getTime() - prevLeaveDate.getTime()) <= (24 * 60 * 60 * 1000) : true;

      if (isConsecutive) {
        // Add to current period
        currentPeriod.push(leave);
        // Update current values (will be overridden by the last leave in the period)
        currentType = leave.leave_type_name;
        currentPaidStatus = leave.is_paid_leave;
        currentOfficeHoliday = leave.is_office_holiday;
      } else {
        // Save current period and start new one
        if (currentPeriod.length > 0) {
          // Create a mixed period representation
          const hasUnpaidLeaves = currentPeriod.some(l => !l.is_paid_leave && !l.is_office_holiday);
          const hasOfficeHolidays = currentPeriod.some(l => l.is_office_holiday);
          const hasPaidLeaves = currentPeriod.some(l => l.is_paid_leave && !l.is_office_holiday);
          
          // Determine the primary leave type (most common)
          const typeCounts = currentPeriod.reduce((acc, l) => {
            acc[l.leave_type_name] = (acc[l.leave_type_name] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const primaryType = Object.keys(typeCounts).reduce((a, b) => 
            typeCounts[a] > typeCounts[b] ? a : b
          );
          
          periods.push({
            id: `period-${currentPeriod[0].id}`,
            leave_type_name: primaryType,
            start_date: currentPeriod[0].leave_date,
            end_date: currentPeriod[currentPeriod.length - 1].leave_date,
            duration: currentPeriod.length,
            is_paid_leave: hasPaidLeaves && !hasUnpaidLeaves, // Only if all are paid
            is_office_holiday: hasOfficeHolidays && !hasUnpaidLeaves && !hasPaidLeaves, // Only if all are office holidays
            total_deduction: currentPeriod.reduce((sum, l) => sum + (l.deduction_amount || 0), 0),
            daily_rate: currentPeriod[0].daily_rate || 0,
            deduction_reason: hasUnpaidLeaves ? 'Mixed leave period with deductions' : 'No deduction',
            notes: currentPeriod[0].notes || '',
            leaves: [...currentPeriod]
          });
        }
        
        // Start new period
        currentPeriod = [leave];
        currentType = leave.leave_type_name;
        currentPaidStatus = leave.is_paid_leave;
        currentOfficeHoliday = leave.is_office_holiday;
      }
    }

    // Add the last period
    if (currentPeriod.length > 0) {
      // Create a mixed period representation
      const hasUnpaidLeaves = currentPeriod.some(l => !l.is_paid_leave && !l.is_office_holiday);
      const hasOfficeHolidays = currentPeriod.some(l => l.is_office_holiday);
      const hasPaidLeaves = currentPeriod.some(l => l.is_paid_leave && !l.is_office_holiday);
      
      // Determine the primary leave type (most common)
      const typeCounts = currentPeriod.reduce((acc, l) => {
        acc[l.leave_type_name] = (acc[l.leave_type_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const primaryType = Object.keys(typeCounts).reduce((a, b) => 
        typeCounts[a] > typeCounts[b] ? a : b
      );
      
      periods.push({
        id: `period-${currentPeriod[0].id}`,
        leave_type_name: primaryType,
        start_date: currentPeriod[0].leave_date,
        end_date: currentPeriod[currentPeriod.length - 1].leave_date,
        duration: currentPeriod.length,
        is_paid_leave: hasPaidLeaves && !hasUnpaidLeaves, // Only if all are paid
        is_office_holiday: hasOfficeHolidays && !hasUnpaidLeaves && !hasPaidLeaves, // Only if all are office holidays
        total_deduction: currentPeriod.reduce((sum, l) => sum + (l.deduction_amount || 0), 0),
        daily_rate: currentPeriod[0].daily_rate || 0,
        deduction_reason: hasUnpaidLeaves ? 'Mixed leave period with deductions' : 'No deduction',
        notes: currentPeriod[0].notes || '',
        leaves: [...currentPeriod]
      });
    }

    return periods;
  };

  const leavePeriods = groupLeavesIntoPeriods(filteredLeaves);

  // Calculate proper leave counts accounting for office holidays within leave periods
  const calculateLeaveStats = () => {
    let paidLeaves = 0;
    let unpaidLeaves = 0;
    let officeHolidays = 0;
    let totalDeductions = 0;

    // Count Sundays in the month
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const monthEnd = new Date(selectedYear, selectedMonth, 0);
    let sundayCount = 0;
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) { // Sunday
        sundayCount++;
      }
    }

    // Count company holidays from leaves data
    const companyHolidays = leaves.filter(leave => leave.is_office_holiday).length;
    
    // Total office holidays = company holidays + Sundays
    officeHolidays = companyHolidays + sundayCount;

    console.log(`calculateLeaveStats: ${companyHolidays} company holidays + ${sundayCount} Sundays = ${officeHolidays} total office holidays`);

    // Calculate deductions using the same method as RPC: unpaid days × daily rate
    const baseSalary = salarySummary?.base_salary || 0;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dailyRate = baseSalary > 0 ? baseSalary / daysInMonth : 0;

    // Count actual unpaid leave days (excluding office holidays and Sundays)
    const unpaidLeaveDays = leaves.filter(leave => 
      !leave.is_paid_leave && 
      !leave.is_office_holiday && 
      new Date(leave.leave_date).getDay() !== 0 // Exclude Sundays
    ).length;

    // Calculate total deductions
    totalDeductions = unpaidLeaveDays * dailyRate;
    unpaidLeaves = unpaidLeaveDays;

    console.log(`Frontend calculation: ${unpaidLeaveDays} unpaid days × ₹${dailyRate.toFixed(0)} = ₹${totalDeductions.toFixed(0)}`);

    return { paidLeaves, unpaidLeaves, officeHolidays, totalDeductions };
  };

  const { paidLeaves, unpaidLeaves, officeHolidays, totalDeductions } = calculateLeaveStats();

  // Calculate total working days for the month
  const [totalWorkingDays, setTotalWorkingDays] = useState(0);

  const calculateWorkingDays = () => {
    const monthStart = new Date(selectedMonth + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    
    
    let workingDays = 0;
    let currentDate = new Date(monthStart);
    
    while (currentDate <= monthEnd) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Default work days: Monday to Saturday (6 days per week)
      // This can be customized based on company policy
      const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 6; // Monday to Saturday
      
      if (isWorkDay) {
        workingDays++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setTotalWorkingDays(workingDays);
  };

  // Calculate total days in the month
  const getTotalDaysInMonth = () => {
    const monthStart = new Date(selectedMonth + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    return monthEnd.getDate(); // Returns 28, 29, 30, or 31
  };

  const totalDaysInMonth = getTotalDaysInMonth();

  // Calculate working days when month changes
  useEffect(() => {
    calculateWorkingDays();
  }, [selectedMonth, user]);


  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your leaves and salary data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Leaves & Salary</h1>
            <p className="text-muted-foreground mt-1">
              Track your leave history and salary deductions
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Year Selector */}
            <Select value={selectedYear.toString()} onValueChange={(value) => handleYearChange(parseInt(value))} disabled={monthChanging}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Month Selector */}
            <Select value={selectedMonth.toString()} onValueChange={(value) => handleMonthChange(parseInt(value))} disabled={monthChanging}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {monthChanging && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>

        {/* Salary Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="elegant-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Base Salary</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(salarySummary?.base_salary || 0)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="elegant-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Deductions</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(salarySummary?.total_deductions || 0)}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="elegant-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Net Salary</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(salarySummary?.net_salary || 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="elegant-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Deduction %</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {(salarySummary?.deduction_percentage || 0).toFixed(1)}%
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

        {/* Leave Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="elegant-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid Leaves</p>
                  <p className="text-2xl font-bold">{paidLeaves}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unpaid Leaves</p>
                  <p className="text-2xl font-bold">{unpaidLeaves}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Office Holidays</p>
                  <p className="text-2xl font-bold">{officeHolidays}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Working Days</p>
                  <p className="text-2xl font-bold">
                    {totalWorkingDays}/{totalDaysInMonth}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Work days / Total days
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leave History */}
        <Card className="elegant-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Leave History</CardTitle>
                <CardDescription>
                  Detailed breakdown of your leave periods and salary deductions
                </CardDescription>
              </div>
              
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={leaveFilter} onValueChange={(value: any) => setLeaveFilter(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leaves</SelectItem>
                    <SelectItem value="paid">Paid Leaves</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leaves</SelectItem>
                    <SelectItem value="holidays">Office Holidays</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {leavePeriods.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No leaves found for this period</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This could mean no leave data is available for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.
                  <br />
                  Check with your admin if you expect to see leave data.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leavePeriods.map((period) => {
                  const isExpanded = expandedPeriods.has(period.id);
                  // Use the deduplicated leaves from the period instead of filtering original leaves
                  const periodLeaves = period.leaves || [];
                  
                  return (
                    <Card key={period.id} className="elegant-card">
                      <CardContent className="p-4">
                        {/* Main Period Row - Clickable */}
                        <div 
                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded"
                          onClick={() => togglePeriodExpansion(period.id)}
                        >
                          <div className="flex items-center space-x-4">
                            {period.is_office_holiday ? (
                              <Calendar className="h-4 w-4 text-blue-500" />
                            ) : period.is_paid_leave ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            
                            <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">{period.leave_type_name}</h4>
                              {period.is_office_holiday ? (
                                <Badge className="bg-blue-100 text-blue-800">Office Holiday</Badge>
                              ) : period.is_paid_leave ? (
                                <Badge className="bg-green-100 text-green-800">Paid</Badge>
                              ) : period.total_deduction > 0 ? (
                                <Badge className="bg-red-100 text-red-800">Unpaid</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">Mixed</Badge>
                              )}
                            </div>
                              
                              <div className="flex items-center space-x-4 mt-1">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">
                                    {period.start_date === period.end_date 
                                      ? formatDate(period.start_date)
                                      : `${formatDate(period.start_date)} - ${formatDate(period.end_date)}`
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">
                                    {period.duration} day{period.duration > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              
                              {period.notes && (
                                <p className="text-sm text-muted-foreground mt-1 bg-gray-50 p-2 rounded">
                                  {period.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              {period.is_office_holiday ? (
                                <div>
                                  <p className="text-sm text-muted-foreground">No deduction</p>
                                  <p className="text-xs text-blue-600">Office holiday</p>
                                </div>
                              ) : period.total_deduction > 0 ? (
                                <div>
                                  <p className="font-medium text-red-600">
                                    -{formatCurrency(period.total_deduction)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {period.deduction_reason}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-medium text-green-600">No deduction</p>
                                  <p className="text-xs text-muted-foreground">Paid leave</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Expand/Collapse Icon */}
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && periodLeaves.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h5 className="font-medium text-sm text-muted-foreground mb-3">Daily Breakdown:</h5>
                            <div className="space-y-2">
                              {periodLeaves.map((leave) => (
                                <div key={leave.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                      {leave.is_office_holiday ? (
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                      ) : leave.is_paid_leave ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      )}
                                    </div>
                                    
                                    <div>
                                      <p className="font-medium text-sm">
                                        {formatDate(leave.leave_date)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {leave.leave_type_name}
                                      </p>
                                      {leave.notes && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {leave.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="text-right">
                                    {leave.deduction_amount > 0 ? (
                                      <div>
                                        <p className="font-medium text-red-600 text-sm">
                                          -{formatCurrency(leave.deduction_amount)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {leave.deduction_reason}
                                        </p>
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="font-medium text-green-600 text-sm">
                                          No deduction
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {leave.deduction_reason}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Summary */}
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Days:</span>
                                <span className="font-medium">{periodLeaves.length}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Deduction:</span>
                                <span className="font-medium text-red-600">
                                  -{formatCurrency(periodLeaves.reduce((sum, leave) => sum + leave.deduction_amount, 0))}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Footer */}
        {leavePeriods.length > 0 && (
          <Card className="elegant-card bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Total Deductions for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                    <p className="text-sm text-muted-foreground">
                      {unpaidLeaves} unpaid leaves • {officeHolidays} office holidays • {paidLeaves} paid leaves
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">
                    -{formatCurrency(totalDeductions)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {((totalDeductions / (salarySummary?.base_salary || 1)) * 100).toFixed(1)}% of base salary
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Salary Payments Table */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Salary Payments</span>
            </CardTitle>
            <CardDescription>
              Your salary payment history for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {salaryPayments.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No salary payments found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  No salary payments have been generated for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {salaryPayments.map((payment) => (
                  <Card key={payment.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-lg">
                              {formatCurrency(payment.net_salary)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Payment for {new Date(payment.payment_month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                            </p>
                            {payment.payment_date && (
                              <p className="text-xs text-muted-foreground">
                                Paid on {new Date(payment.payment_date).toLocaleDateString('en-IN', { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant={payment.is_paid ? "default" : "secondary"}>
                              {payment.is_paid ? "Paid" : "Pending"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Base: {formatCurrency(payment.base_salary)}</p>
                            {payment.leave_deductions > 0 && (
                              <p className="text-red-600">
                                -{formatCurrency(payment.leave_deductions)} (leaves)
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Payment Details */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Gross Salary</p>
                            <p className="font-medium">{formatCurrency(payment.gross_salary)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Leave Deductions</p>
                            <p className="font-medium text-red-600">
                              -{formatCurrency(payment.leave_deductions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Unpaid Days</p>
                            <p className="font-medium">{payment.unpaid_leave_days} days</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Deduction %</p>
                            <p className="font-medium">{payment.deduction_percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        
                        {payment.payment_method && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Payment Method</p>
                                <p className="font-medium">{payment.payment_method}</p>
                              </div>
                              {payment.payment_reference && (
                                <div>
                                  <p className="text-muted-foreground">Reference</p>
                                  <p className="font-medium">{payment.payment_reference}</p>
                                </div>
                              )}
                              {payment.notes && (
                                <div>
                                  <p className="text-muted-foreground">Notes</p>
                                  <p className="font-medium">{payment.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
