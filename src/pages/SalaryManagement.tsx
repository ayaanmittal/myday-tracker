import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Calendar,
  CheckCircle,
  XCircle,
  Edit,
  Plus,
  Download,
  RefreshCw,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  AlertTriangle,
  Eye,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { EmployeeNotesService, EmployeeNoteWithDetails } from '@/services/employeeNotesService';
import { SalaryService } from '@/services/salaryService';
import { useUserRole } from '@/hooks/useUserRole';

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string;
  team: string;
  phone: string;
  address: string;
  joined_on_date: string;
  base_salary: number;
  is_active: boolean;
  employee_category: string;
  probation_period_months: number;
}

interface SalaryPayment {
  id: string;
  user_id: string;
  employee_name: string;
  payment_month: string;
  base_salary: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  leave_deductions: number;
  unpaid_leave_days: number;
  deduction_percentage: number;
  is_paid: boolean;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}

interface PayrollAnalytics {
  total_employees: number;
  total_payroll_outflow: number;
  average_salary: number;
  highest_paid_employee: string;
  highest_salary: number;
  total_leave_deductions: number;
  average_deduction_percentage: number;
}

export default function SalaryManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [analytics, setAnalytics] = useState<PayrollAnalytics | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedEmployeeForSalary, setSelectedEmployeeForSalary] = useState<string | null>(null);
  const [newSalary, setNewSalary] = useState({
    user_id: '',
    base_salary: '',
    effective_from: new Date().toISOString().slice(0, 10),
    currency: 'INR',
    salary_frequency: 'monthly'
  });
  const [generateData, setGenerateData] = useState({
    selectedEmployees: [] as string[],
    manualAdvances: {} as Record<string, number>,
    advanceReasons: {} as Record<string, string>,
    unpaidLeavePercentage: 100, // Default 100% deduction for unpaid leaves
    manualUnpaidDays: {} as Record<string, number> // Manual override for unpaid days
  });
  const [showEmployeeNotes, setShowEmployeeNotes] = useState<string | null>(null);
  const [employeeNotes, setEmployeeNotes] = useState<Record<string, EmployeeNoteWithDetails[]>>({});
  const [notesLoading, setNotesLoading] = useState(false);
  const [leaveDeductionData, setLeaveDeductionData] = useState<Record<string, any>>({});
  const [editingPayment, setEditingPayment] = useState<SalaryPayment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<SalaryPayment | null>(null);
  const [editFormData, setEditFormData] = useState({
    base_salary: '',
    leave_deductions: '',
    unpaid_leave_days: '',
    net_salary: '',
    deduction_percentage: '',
    is_paid: false,
    payment_date: '',
    payment_method: '',
    payment_reference: '',
    notes: ''
  });
  
  const { toast } = useToast();
  const { data: role, isLoading: roleLoading } = useUserRole();

  // Load employees
  useEffect(() => {
    loadEmployees();
  }, []);

  // Load salary payments and analytics when month changes
  useEffect(() => {
    loadSalaryData();
  }, [selectedMonth]);

  // Pre-populate selected employee in salary dialog
  useEffect(() => {
    if (selectedEmployeeForSalary && showAddSalary) {
      setNewSalary(prev => ({
        ...prev,
        user_id: selectedEmployeeForSalary
      }));
    }
  }, [selectedEmployeeForSalary, showAddSalary]);

  // Fetch leave deduction data when selected employees change
  useEffect(() => {
    if (generateData.selectedEmployees.length > 0) {
      fetchLeaveDeductionData(generateData.selectedEmployees);
    }
  }, [generateData.selectedEmployees, selectedMonth, generateData.unpaidLeavePercentage]);

  // Auto-fetch employee notes when dialog opens
  useEffect(() => {
    if (showEmployeeNotes && showEmployeeNotes !== 'advances') {
      loadEmployeeNotes(showEmployeeNotes);
    }
  }, [showEmployeeNotes]);

  const loadEmployeeNotes = async (employeeId: string) => {
    try {
      setNotesLoading(true);
      const { notes } = await EmployeeNotesService.getEmployeeNotes(employeeId);
      setEmployeeNotes(prev => ({
        ...prev,
        [employeeId]: notes
      }));
    } catch (error) {
      console.error('Error loading employee notes:', error);
      toast({
        title: "Error",
        description: "Failed to load employee notes",
        variant: "destructive",
      });
    } finally {
      setNotesLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      // First, get all active employees from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          designation,
          team,
          phone,
          address,
          joined_on_date,
          user_id,
          is_active,
          employee_category_id,
          probation_period_months,
          employee_categories!inner(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (profilesError) {
        console.error('Profiles query error:', profilesError);
        throw profilesError;
      }

      if (!profiles || profiles.length === 0) {
        console.log('No profiles found');
        setEmployees([]);
        return;
      }

      // Then, get all active salaries (optional - some employees might not have salaries)
      const { data: salaries, error: salariesError } = await supabase
        .from('employee_salaries')
        .select(`
          user_id,
          base_salary,
          is_active,
          effective_from,
          effective_to
        `)
        .eq('is_active', true)
        .order('effective_from', { ascending: false });

      if (salariesError) {
        console.warn('Salaries query error (continuing without salaries):', salariesError);
        // Continue without salaries - employees will show 0 salary
      }

      // Combine the data
      const combinedEmployees = profiles?.map(emp => {
        // Find the most recent salary for this employee
        const employeeSalary = salaries?.find(salary => salary.user_id === emp.user_id);
        
        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          designation: emp.designation,
          team: emp.team,
          phone: emp.phone,
          address: emp.address,
          joined_on_date: emp.joined_on_date,
          base_salary: employeeSalary?.base_salary || 0,
          is_active: emp.is_active,
          employee_category: emp.employee_categories?.name || 'Unknown',
          probation_period_months: emp.probation_period_months
        };
      }) || [];

      console.log('Loaded employees:', combinedEmployees.length);
      setEmployees(combinedEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
      console.error('Error details:', error);
      toast({
        title: "Error",
        description: `Failed to load employees: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const loadSalaryData = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(selectedMonth + '-01');
      
      // Load salary payments for the month
      const { data: payments, error: paymentsError } = await supabase
        .from('salary_payments')
        .select(`
          *,
          profiles!inner(name)
        `)
        .eq('payment_month', monthStart.toISOString().slice(0, 10));

      if (paymentsError) throw paymentsError;

      setSalaryPayments(payments?.map(payment => ({
        ...payment,
        employee_name: payment.profiles.name
      })) || []);

      // Load analytics with multiple fallback strategies
      try {
        // Try simple analytics function first
        const { data: simpleAnalytics, error: simpleError } = await supabase
          .rpc('get_simple_payroll_analytics', {
            p_start_month: monthStart.toISOString().slice(0, 10),
            p_end_month: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().slice(0, 10)
          });

        if (!simpleError && simpleAnalytics?.[0]) {
          setAnalytics(simpleAnalytics[0]);
        } else {
          // Try original analytics function
          const { data: analyticsData, error: analyticsError } = await supabase
            .rpc('get_payroll_analytics', {
              p_start_month: monthStart.toISOString().slice(0, 10),
              p_end_month: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().slice(0, 10)
            });

          if (!analyticsError && analyticsData?.[0]) {
            setAnalytics(analyticsData[0]);
          } else {
            // Fallback to frontend calculation
            console.warn('Analytics functions failed, using frontend calculation');
            setAnalytics({
              total_employees: payments?.length || 0,
              total_payroll_outflow: payments?.reduce((sum, p) => sum + (p.net_salary || 0), 0) || 0,
              average_salary: payments?.length > 0 ? (payments.reduce((sum, p) => sum + (p.net_salary || 0), 0) / payments.length) : 0,
              highest_paid_employee: payments?.length > 0 ? payments.reduce((max, p) => (p.net_salary || 0) > (max.net_salary || 0) ? p : max).employee_name : 'N/A',
              highest_salary: payments?.length > 0 ? Math.max(...payments.map(p => p.net_salary || 0)) : 0,
              total_leave_deductions: payments?.reduce((sum, p) => sum + (p.leave_deductions || 0), 0) || 0,
              average_deduction_percentage: payments?.length > 0 ? (payments.reduce((sum, p) => sum + (p.deduction_percentage || 0), 0) / payments.length) : 0
            });
          }
        }
      } catch (error) {
        console.warn('All analytics methods failed:', error);
        // Final fallback - always show some data
        setAnalytics({
          total_employees: payments?.length || 0,
          total_payroll_outflow: payments?.reduce((sum, p) => sum + (p.net_salary || 0), 0) || 0,
          average_salary: payments?.length > 0 ? (payments.reduce((sum, p) => sum + (p.net_salary || 0), 0) / payments.length) : 0,
          highest_paid_employee: payments?.length > 0 ? payments.reduce((max, p) => (p.net_salary || 0) > (max.net_salary || 0) ? p : max).employee_name : 'N/A',
          highest_salary: payments?.length > 0 ? Math.max(...payments.map(p => p.net_salary || 0)) : 0,
          total_leave_deductions: payments?.reduce((sum, p) => sum + (p.leave_deductions || 0), 0) || 0,
          average_deduction_percentage: payments?.length > 0 ? (payments.reduce((sum, p) => sum + (p.deduction_percentage || 0), 0) / payments.length) : 0
        });
      }
    } catch (error) {
      console.error('Error loading salary data:', error);
      toast({
        title: "Error",
        description: "Failed to load salary data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyPayments = async () => {
    setShowGenerateDialog(true);
  };

  const setEmployeeSalary = async (employeeId: string) => {
    setSelectedEmployeeForSalary(employeeId);
    setShowAddSalary(true);
  };

  const calculateLeaveDeductions = async (employeeId: string, paymentMonth: string) => {
    try {
      // Use the advanced calculation from the database
      const result = await SalaryService.calculateEmployeeLeaveDeductions(
        employeeId,
        paymentMonth,
        generateData.unpaidLeavePercentage
      );

      return {
        dailyRate: result.daily_rate,
        unpaidDays: result.unpaid_leave_days,
        deduction: result.leave_deduction_amount,
        workDays: result.work_days_in_month,
        baseSalary: result.base_salary,
        netSalary: result.net_salary
      };
    } catch (error) {
      console.error('Error calculating leave deductions:', error);
      return { dailyRate: 0, unpaidDays: 0, deduction: 0, workDays: 0, baseSalary: 0, netSalary: 0 };
    }
  };

  const createSalaryAdvanceNote = async (employeeId: string, amount: number, reason: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      const result = await EmployeeNotesService.createNote({
        employee_id: employeeId,
        note_date: new Date().toISOString().split('T')[0],
        note_time: new Date().toTimeString().slice(0, 5),
        title: `Salary Advance - ₹${amount.toLocaleString()}`,
        content: `Salary advance of ₹${amount.toLocaleString()} given. Reason: ${reason}`,
        note_type: 'salary_advance',
        amount: amount,
        is_private: false
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Salary advance note created successfully",
        });
        // Reload notes for this employee
        await loadEmployeeNotes(employeeId);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error creating salary advance note:', error);
      toast({
        title: "Error",
        description: "Failed to create salary advance note",
        variant: "destructive",
      });
    }
  };

  const generatePaymentsWithAdvances = async () => {
    try {
      setLoading(true);
      const monthStart = new Date(selectedMonth + '-01');
      
      // Generate payments for selected employees only
      const { data, error } = await supabase
        .rpc('generate_monthly_salary_payments', {
          p_payment_month: monthStart.toISOString().slice(0, 10),
          p_processed_by: null,
          p_selected_employees: generateData.selectedEmployees
        });

      if (error) throw error;

      // Update payments with manual adjustments (advances and unpaid days) if any
      for (const employeeId of generateData.selectedEmployees) {
        const advanceAmount = generateData.manualAdvances[employeeId] || 0;
        const advanceReason = generateData.advanceReasons[employeeId] || '';
        const manualUnpaidDays = generateData.manualUnpaidDays[employeeId];
        const originalUnpaidDays = leaveDeductionData[employeeId]?.unpaid_leave_days || 0;
        
        // Find the payment for this employee
        const monthDate = new Date(selectedMonth + '-01');
        const totalDaysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const dailyRate = leaveDeductionData[employeeId]?.daily_rate || (employees.find(e => e.id === employeeId)?.base_salary || 0) / totalDaysInMonth;
        
        const payment = data?.find((p: any) => p.user_id === employeeId);
        if (payment) {
          let updateData: any = {};
          
          // Handle manual unpaid days override
          if (manualUnpaidDays !== undefined && manualUnpaidDays !== originalUnpaidDays) {
            const manualLeaveDeduction = dailyRate * manualUnpaidDays * (generateData.unpaidLeavePercentage / 100);
            updateData.leave_deductions = manualLeaveDeduction;
            updateData.unpaid_leave_days = manualUnpaidDays;
          }
          
          // Handle manual advances
          if (advanceAmount > 0) {
            updateData.deductions = (updateData.leave_deductions || payment.leave_deductions) + advanceAmount;
            updateData.notes = `Manual advance: ${advanceAmount} - ${advanceReason}`;
          } else if (manualUnpaidDays !== undefined && manualUnpaidDays !== originalUnpaidDays) {
            updateData.notes = `Manual unpaid days adjustment: ${originalUnpaidDays} → ${manualUnpaidDays} days`;
          }
          
          // Recalculate net salary
          if (updateData.leave_deductions !== undefined || updateData.deductions !== undefined) {
            updateData.net_salary = (payment.base_salary || payment.gross_salary) - (updateData.deductions || updateData.leave_deductions || 0);
            
            // Recalculate deduction percentage
            if (updateData.deductions) {
              updateData.deduction_percentage = ((updateData.deductions / (payment.base_salary || payment.gross_salary)) * 100).toFixed(2);
            }
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('salary_payments')
              .update(updateData)
              .eq('id', payment.payment_id);
          }
        }
      }

      toast({
        title: "Success",
        description: `Generated ${data?.length || 0} salary payments for ${selectedMonth}`,
      });

      setShowGenerateDialog(false);
      loadSalaryData();
    } catch (error) {
      console.error('Error generating payments:', error);
      toast({
        title: "Error",
        description: "Failed to generate salary payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (paymentId: string, isPaid: boolean, paymentMethod?: string, paymentReference?: string) => {
    try {
      const { error } = await supabase
        .rpc('update_salary_payment_status', {
          p_payment_id: paymentId,
          p_is_paid: isPaid,
          p_payment_date: isPaid ? new Date().toISOString().slice(0, 10) : null,
          p_payment_method: paymentMethod,
          p_payment_reference: paymentReference
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Payment status updated successfully`,
      });

      loadSalaryData();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  const handleEditPayment = (payment: SalaryPayment) => {
    setEditingPayment(payment);
    setEditFormData({
      base_salary: payment.base_salary.toString(),
      leave_deductions: payment.leave_deductions.toString(),
      unpaid_leave_days: payment.unpaid_leave_days.toString(),
      net_salary: payment.net_salary.toString(),
      deduction_percentage: payment.deduction_percentage.toString(),
      is_paid: payment.is_paid,
      payment_date: payment.payment_date || '',
      payment_method: payment.payment_method || '',
      payment_reference: payment.payment_reference || '',
      notes: payment.notes || ''
    });
    setShowEditDialog(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;

    try {
      const { error } = await supabase
        .from('salary_payments')
        .update({
          base_salary: parseFloat(editFormData.base_salary),
          leave_deductions: parseFloat(editFormData.leave_deductions),
          unpaid_leave_days: parseInt(editFormData.unpaid_leave_days),
          net_salary: parseFloat(editFormData.net_salary),
          deduction_percentage: parseFloat(editFormData.deduction_percentage),
          is_paid: editFormData.is_paid,
          payment_date: editFormData.payment_date || null,
          payment_method: editFormData.payment_method || null,
          payment_reference: editFormData.payment_reference || null,
          notes: editFormData.notes || null
        })
        .eq('id', editingPayment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Salary payment updated successfully",
      });

      setShowEditDialog(false);
      setEditingPayment(null);
      loadSalaryData(); // Reload data to reflect changes
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePayment = async () => {
    if (!deleteConfirmDialog) return;

    try {
      const { error } = await supabase
        .from('salary_payments')
        .delete()
        .eq('id', deleteConfirmDialog.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Salary payment deleted successfully",
      });

      setDeleteConfirmDialog(null);
      loadSalaryData(); // Reload data to reflect changes
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete salary payment",
        variant: "destructive",
      });
    }
  };

  const addEmployeeSalary = async () => {
    try {
      const { error } = await supabase
        .from('employee_salaries')
        .insert({
          user_id: newSalary.user_id,
          profile_id: newSalary.user_id, // Assuming profile_id = user_id
          base_salary: parseFloat(newSalary.base_salary),
          currency: newSalary.currency,
          salary_frequency: newSalary.salary_frequency,
          effective_from: newSalary.effective_from
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee salary added successfully",
      });

      setShowAddSalary(false);
      setSelectedEmployeeForSalary(null);
      setNewSalary({
        user_id: '',
        base_salary: '',
        effective_from: new Date().toISOString().slice(0, 10),
        currency: 'INR',
        salary_frequency: 'monthly'
      });
      loadEmployees();
    } catch (error) {
      console.error('Error adding employee salary:', error);
      toast({
        title: "Error",
        description: "Failed to add employee salary",
        variant: "destructive",
      });
    }
  };

  const fetchLeaveDeductionData = async (employeeIds: string[]) => {
    try {
      const deductionData: Record<string, any> = {};
      
      for (const employeeId of employeeIds) {
        try {
          const data = await SalaryService.calculateEmployeeLeaveDeductions(
            employeeId,
            selectedMonth,
            generateData.unpaidLeavePercentage
          );
          deductionData[employeeId] = data;
        } catch (error) {
          console.warn(`Failed to fetch leave deduction data for employee ${employeeId}:`, error);
          // Set default values if calculation fails
          // Calculate total days in the month
          const monthDate = new Date(selectedMonth + '-01');
          const totalDaysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
          deductionData[employeeId] = {
            employee_name: 'Unknown',
            base_salary: 0,
            work_days_in_month: 0,
            daily_rate: 0,
            unpaid_leave_days: 0,
            leave_deduction_amount: 0,
            net_salary: 0,
            deduction_percentage: generateData.unpaidLeavePercentage
          };
        }
      }
      
      setLeaveDeductionData(deductionData);
    } catch (error) {
      console.error('Error fetching leave deduction data:', error);
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

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Salary Management</h1>
            <p className="text-muted-foreground">Manage employee salaries and payroll</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddSalary(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Salary
            </Button>
            <Button onClick={generateMonthlyPayments} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Payments
            </Button>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.total_payroll_outflow)}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.total_employees} employees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Salary</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.average_salary)}</div>
                <p className="text-xs text-muted-foreground">
                  Per employee
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Highest Paid</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.highest_salary)}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.highest_paid_employee}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leave Deductions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analytics.total_leave_deductions)}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.average_deduction_percentage.toFixed(1)}% average
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="payments">Salary Payments</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Salary Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {/* Month Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-center">
                  <Input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-48"
                  />
                  <Button onClick={loadSalaryData} disabled={loading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Salary Payments Table */}
            <Card>
              <CardHeader>
                <CardTitle>Salary Payments - {selectedMonth}</CardTitle>
              </CardHeader>
              <CardContent>
                {salaryPayments.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No salary payments found for {selectedMonth}. Click "Generate Payments" to create them.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Base Salary</TableHead>
                          <TableHead>Leave Deductions</TableHead>
                          <TableHead>Unpaid Days</TableHead>
                          <TableHead>Net Salary</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{payment.employee_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(payment.base_salary)}</TableCell>
                            <TableCell>
                              <div className="text-red-600">{formatCurrency(payment.leave_deductions)}</div>
                              <div className="text-xs text-muted-foreground">
                                {payment.deduction_percentage.toFixed(1)}%
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={payment.unpaid_leave_days > 0 ? "destructive" : "secondary"}>
                                {payment.unpaid_leave_days} days
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(payment.net_salary)}</TableCell>
                            <TableCell>
                              <Badge variant={payment.is_paid ? "default" : "secondary"}>
                                {payment.is_paid ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Paid
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Pending
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {!payment.is_paid ? (
                                  <Button
                                    size="sm"
                                    onClick={() => updatePaymentStatus(payment.id, true)}
                                  >
                                    Mark Paid
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updatePaymentStatus(payment.id, false)}
                                  >
                                    Mark Unpaid
                                  </Button>
                                )}
                                {role === 'admin' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditPayment(payment)}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setDeleteConfirmDialog(payment)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Employee Directory</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage employee information and salary details
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map((employee) => (
                    <Card key={employee.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{employee.name}</h3>
                              <p className="text-sm text-muted-foreground">{employee.designation}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowEmployeeDetails(employee.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEmployeeSalary(employee.id)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Mail className="w-4 h-4 mr-2" />
                            {employee.email}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Briefcase className="w-4 h-4 mr-2" />
                            {employee.team}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <DollarSign className="w-4 h-4 mr-2" />
                            {employee.base_salary > 0 ? formatCurrency(employee.base_salary) : 'No salary set'}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 mr-2" />
                            Joined {new Date(employee.joined_on_date).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <Badge variant={employee.is_active ? "default" : "secondary"}>
                            {employee.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <div className="flex gap-1">
                            <Badge variant="outline">
                              {employee.employee_category}
                            </Badge>
                            {employee.base_salary > 0 ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Salary Set
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                No Salary
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payroll Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Total Employees:</span>
                        <span className="font-semibold">{analytics.total_employees}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Payroll:</span>
                        <span className="font-semibold">{formatCurrency(analytics.total_payroll_outflow)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Salary:</span>
                        <span className="font-semibold">{formatCurrency(analytics.average_salary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Highest Salary:</span>
                        <span className="font-semibold">{formatCurrency(analytics.highest_salary)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No analytics data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Leave Deductions</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Total Deductions:</span>
                        <span className="font-semibold text-red-600">{formatCurrency(analytics.total_leave_deductions)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Deduction:</span>
                        <span className="font-semibold">{analytics.average_deduction_percentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Highest Paid Employee:</span>
                        <span className="font-semibold">{analytics.highest_paid_employee}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No analytics data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Salary Dialog */}
        <Dialog open={showAddSalary} onOpenChange={(open) => {
          setShowAddSalary(open);
          if (!open) {
            setSelectedEmployeeForSalary(null);
            setNewSalary({
              user_id: '',
              base_salary: '',
              effective_from: new Date().toISOString().slice(0, 10),
              currency: 'INR',
              salary_frequency: 'monthly'
            });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Employee Salary</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user_id">Employee</Label>
                <Select 
                  value={selectedEmployeeForSalary || newSalary.user_id} 
                  onValueChange={(value) => setNewSalary({...newSalary, user_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="base_salary">Base Salary</Label>
                <Input
                  id="base_salary"
                  type="number"
                  value={newSalary.base_salary}
                  onChange={(e) => setNewSalary({...newSalary, base_salary: e.target.value})}
                  placeholder="Enter base salary"
                />
              </div>
              
              <div>
                <Label htmlFor="effective_from">Effective From</Label>
                <Input
                  id="effective_from"
                  type="date"
                  value={newSalary.effective_from}
                  onChange={(e) => setNewSalary({...newSalary, effective_from: e.target.value})}
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={addEmployeeSalary} className="flex-1">
                  Add Salary
                </Button>
                <Button variant="outline" onClick={() => setShowAddSalary(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Payments Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Salary Payments - {selectedMonth}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Select employees and configure manual advances and leave deductions
              </p>
            </DialogHeader>
            <div className="space-y-6">
              {/* Employee Selection */}
              <div>
                <Label className="text-base font-medium">Select Employees</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {employees.map((employee) => (
                    <Card key={employee.id} className={`cursor-pointer transition-colors ${
                      generateData.selectedEmployees.includes(employee.id) 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}>
                      <CardContent 
                        className="p-4"
                        onClick={() => {
                          const isSelected = generateData.selectedEmployees.includes(employee.id);
                          setGenerateData(prev => ({
                            ...prev,
                            selectedEmployees: isSelected
                              ? prev.selectedEmployees.filter(id => id !== employee.id)
                              : [...prev.selectedEmployees, employee.id]
                          }));
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{employee.name}</h4>
                              <p className="text-sm text-muted-foreground">{employee.designation}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(employee.base_salary)}</p>
                            <p className="text-xs text-muted-foreground">Base Salary</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Unpaid Leave Deduction Percentage */}
              {generateData.selectedEmployees.length > 0 && (
                <div>
                  <Label className="text-base font-medium">Unpaid Leave Deduction Settings</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set the percentage of salary to deduct for unpaid leave days
                  </p>
                  <div className="max-w-md">
                    <Label htmlFor="unpaid-leave-percentage">Deduction Percentage</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="unpaid-leave-percentage"
                        type="number"
                        min="0"
                        max="100"
                        value={generateData.unpaidLeavePercentage}
                        onChange={(e) => setGenerateData(prev => ({
                          ...prev,
                          unpaidLeavePercentage: parseFloat(e.target.value) || 0
                        }))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <span className="text-sm text-muted-foreground">
                        (e.g., 100% = full day's salary deducted for unpaid leave)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Advances */}
              {generateData.selectedEmployees.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base font-medium">Manual Advances</Label>
                      <p className="text-sm text-muted-foreground">
                        Enter any manual advances given to employees this month
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmployeeNotes('advances')}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add from Employee Notes
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {generateData.selectedEmployees.map(employeeId => {
                      const employee = employees.find(emp => emp.id === employeeId);
                      if (!employee) return null;
                      
                      return (
                        <Card key={employeeId}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{employee.name}</h4>
                                  <p className="text-sm text-muted-foreground">{employee.designation}</p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowEmployeeNotes(employeeId)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Notes
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`advance-${employeeId}`}>Advance Amount</Label>
                                <Input
                                  id={`advance-${employeeId}`}
                                  type="number"
                                  placeholder="0"
                                  value={generateData.manualAdvances[employeeId] || ''}
                                  onChange={(e) => setGenerateData(prev => ({
                                    ...prev,
                                    manualAdvances: {
                                      ...prev.manualAdvances,
                                      [employeeId]: parseFloat(e.target.value) || 0
                                    }
                                  }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`reason-${employeeId}`}>Reason</Label>
                                <Input
                                  id={`reason-${employeeId}`}
                                  placeholder="e.g., Emergency advance, Festival bonus"
                                  value={generateData.advanceReasons[employeeId] || ''}
                                  onChange={(e) => setGenerateData(prev => ({
                                    ...prev,
                                    advanceReasons: {
                                      ...prev.advanceReasons,
                                      [employeeId]: e.target.value
                                    }
                                  }))}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Leave Deductions Preview */}
              {generateData.selectedEmployees.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base font-medium">Leave Deductions Preview</Label>
                      <p className="text-sm text-muted-foreground">
                        Calculated deductions based on employee work days and unpaid leave days
                      </p>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
            <div className="space-y-3">
              {generateData.selectedEmployees.map(employeeId => {
                const employee = employees.find(emp => emp.id === employeeId);
                if (!employee) return null;
                
                // Get actual leave deduction data from backend
                const deductionData = leaveDeductionData[employeeId];
                const advanceAmount = generateData.manualAdvances[employeeId] || 0;
                
                // Use manual override if available, otherwise use calculated unpaid days
                const originalUnpaidDays = deductionData?.unpaid_leave_days || 0;
                const unpaidDays = generateData.manualUnpaidDays[employeeId] !== undefined 
                  ? generateData.manualUnpaidDays[employeeId]
                  : originalUnpaidDays;
                
                // Use actual data if available, otherwise fallback to basic calculation
                const workDays = deductionData?.work_days_in_month || 27; // Work days for display
                // Calculate total days in the month
                const monthDate = new Date(selectedMonth + '-01');
                const totalDaysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                const dailyRate = deductionData?.daily_rate || (employee.base_salary / totalDaysInMonth);
                const leaveDeduction = dailyRate * unpaidDays * (generateData.unpaidLeavePercentage / 100);
                const totalDeductions = leaveDeduction + advanceAmount;
                const netSalary = employee.base_salary - totalDeductions;
                      
                      return (
                        <Card key={employeeId}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{employee.name}</h4>
                                  <p className="text-sm text-muted-foreground">{employee.designation}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-red-600 text-lg">
                                    Net: {formatCurrency(netSalary)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {((totalDeductions / employee.base_salary) * 100).toFixed(1)}% total deduction
                                  </p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Base Salary:</p>
                                  <p className="font-medium">{formatCurrency(employee.base_salary)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Daily Rate:</p>
                                  <p className="font-medium">{formatCurrency(dailyRate)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Advance:</p>
                                  <p className="font-medium text-orange-600">{formatCurrency(advanceAmount)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Leave Deduction:</p>
                                  <p className="font-medium text-red-600">{formatCurrency(leaveDeduction)}</p>
                                </div>
                              </div>

                              <div className="border-t pt-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <Label htmlFor={`unpaid-days-${employeeId}`} className="text-sm font-medium">
                                        Unpaid Leave Days (Manual Override)
                                      </Label>
                                      {unpaidDays !== originalUnpaidDays && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs text-muted-foreground"
                                          onClick={() => setGenerateData(prev => {
                                            const newManualUnpaidDays = { ...prev.manualUnpaidDays };
                                            delete newManualUnpaidDays[employeeId];
                                            return {
                                              ...prev,
                                              manualUnpaidDays: newManualUnpaidDays
                                            };
                                          })}
                                        >
                                          Reset
                                        </Button>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        id={`unpaid-days-${employeeId}`}
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={unpaidDays}
                                        onChange={(e) => setGenerateData(prev => ({
                                          ...prev,
                                          manualUnpaidDays: {
                                            ...prev.manualUnpaidDays,
                                            [employeeId]: Math.max(0, parseFloat(e.target.value) || 0)
                                          }
                                        }))}
                                        className="max-w-[120px]"
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        (Original: {originalUnpaidDays})
                                      </span>
                                    </div>
                                  </div>
                                  {unpaidDays !== originalUnpaidDays && (
                                    <Badge variant="warning" className="bg-orange-100 text-orange-800">
                                      Adjusted
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={generatePaymentsWithAdvances}
                  disabled={generateData.selectedEmployees.length === 0 || loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Generate Payments ({generateData.selectedEmployees.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Employee Details Dialog */}
        <Dialog open={!!showEmployeeDetails} onOpenChange={() => setShowEmployeeDetails(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee Details</DialogTitle>
            </DialogHeader>
            {showEmployeeDetails && (() => {
              const employee = employees.find(emp => emp.id === showEmployeeDetails);
              if (!employee) return null;
              
              return (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{employee.name}</h3>
                      <p className="text-muted-foreground">{employee.designation}</p>
                      <Badge variant={employee.is_active ? "default" : "secondary"}>
                        {employee.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Phone</Label>
                      <p className="text-sm text-muted-foreground">{employee.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Team</Label>
                      <p className="text-sm text-muted-foreground">{employee.team || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Category</Label>
                      <p className="text-sm text-muted-foreground">{employee.employee_category}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Base Salary</Label>
                      <p className="text-sm font-medium">{formatCurrency(employee.base_salary)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Joined Date</Label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(employee.joined_on_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {employee.address && (
                    <div>
                      <Label className="text-sm font-medium">Address</Label>
                      <p className="text-sm text-muted-foreground">{employee.address}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Employee Notes Dialog */}
        <Dialog open={!!showEmployeeNotes} onOpenChange={() => setShowEmployeeNotes(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {showEmployeeNotes === 'advances' 
                  ? 'Employee Notes - Salary Advances' 
                  : 'Employee Notes - ' + (employees.find(emp => emp.id === showEmployeeNotes)?.name || 'Employee')
                }
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                View and manage employee notes related to salary advances
              </p>
            </DialogHeader>
            <div className="space-y-4">
              {showEmployeeNotes === 'advances' ? (
                // Show all employees with advance notes
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generateData.selectedEmployees.map(employeeId => {
                      const employee = employees.find(emp => emp.id === employeeId);
                      if (!employee) return null;
                      
                      return (
                        <Card key={employeeId} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-medium">{employee.name}</h4>
                                <p className="text-sm text-muted-foreground">{employee.designation}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm">
                                <span className="font-medium">Current Advance:</span> {formatCurrency(generateData.manualAdvances[employeeId] || 0)}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Reason:</span> {generateData.advanceReasons[employeeId] || 'No reason provided'}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowEmployeeNotes(employeeId);
                                }}
                                className="w-full"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Notes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Show individual employee notes
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {employees.find(emp => emp.id === showEmployeeNotes)?.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {employees.find(emp => emp.id === showEmployeeNotes)?.designation}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <Label className="text-base font-medium">Salary Advance Notes</Label>
                          <p className="text-sm text-muted-foreground">
                            Notes related to salary advances for this employee
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            const amount = generateData.manualAdvances[showEmployeeNotes] || 0;
                            const reason = generateData.advanceReasons[showEmployeeNotes] || '';
                            if (amount > 0) {
                              createSalaryAdvanceNote(showEmployeeNotes, amount, reason);
                            } else {
                              toast({
                                title: "No Advance Amount",
                                description: "Please enter an advance amount first",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Note
                        </Button>
                      </div>
                      
                      {notesLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Loading notes...
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {employeeNotes[showEmployeeNotes]?.filter(note => note.note_type === 'salary_advance').length > 0 ? (
                            employeeNotes[showEmployeeNotes]
                              ?.filter(note => note.note_type === 'salary_advance')
                              ?.map(note => (
                                <Card key={note.id}>
                                  <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-medium">{note.title}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(note.note_date).toLocaleDateString()}
                                          {note.note_time && ` at ${note.note_time}`}
                                        </p>
                                      </div>
                                      <Badge variant="outline">salary_advance</Badge>
                                    </div>
                                    {note.amount && (
                                      <div className="text-sm font-medium text-green-600 mt-2">
                                        Amount: ₹{note.amount.toLocaleString()}
                                      </div>
                                    )}
                                    <p className="text-sm mt-2">{note.content}</p>
                                  </CardContent>
                                </Card>
                              ))
                          ) : (
                            <div className="text-center p-4 text-muted-foreground">
                              No salary advance notes found for this employee
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Summary of Available Advances */}
                    {employeeNotes[showEmployeeNotes]?.filter(note => note.note_type === 'salary_advance').length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-blue-900">Available Salary Advances</h4>
                            <p className="text-sm text-blue-700">
                              Total: ₹{employeeNotes[showEmployeeNotes]
                                ?.filter(note => note.note_type === 'salary_advance')
                                ?.reduce((sum, note) => {
                                  if (note.amount) {
                                    return sum + note.amount;
                                  } else {
                                    const amountMatch = note.title.match(/₹([\d,]+)/) || note.content.match(/₹([\d,]+)/);
                                    return sum + (amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0);
                                  }
                                }, 0)
                                ?.toLocaleString() || '0'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {employeeNotes[showEmployeeNotes]?.filter(note => note.note_type === 'salary_advance').length} notes
                          </Badge>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // Calculate total advance from notes
                          const advanceNotes = employeeNotes[showEmployeeNotes]?.filter(note => note.note_type === 'salary_advance') || [];
                          const totalAdvance = advanceNotes.reduce((sum, note) => {
                            // Use amount field if available, otherwise extract from title/content
                            if (note.amount) {
                              return sum + note.amount;
                            } else {
                              const amountMatch = note.title.match(/₹([\d,]+)/) || note.content.match(/₹([\d,]+)/);
                              return sum + (amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0);
                            }
                          }, 0);
                          
                          if (totalAdvance > 0) {
                            setGenerateData(prev => ({
                              ...prev,
                              manualAdvances: {
                                ...prev.manualAdvances,
                                [showEmployeeNotes]: totalAdvance
                              },
                              advanceReasons: {
                                ...prev.advanceReasons,
                                [showEmployeeNotes]: `Imported from ${advanceNotes.length} advance notes`
                              }
                            }));
                            setShowEmployeeNotes(null);
                            toast({
                              title: "Success",
                              description: `Imported ₹${totalAdvance.toLocaleString()} from ${advanceNotes.length} advance notes`,
                            });
                          } else {
                            toast({
                              title: "No Advances Found",
                              description: "No advance amounts found in employee notes",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Import ₹{employeeNotes[showEmployeeNotes]
                          ?.filter(note => note.note_type === 'salary_advance')
                          ?.reduce((sum, note) => {
                            if (note.amount) {
                              return sum + note.amount;
                            } else {
                              const amountMatch = note.title.match(/₹([\d,]+)/) || note.content.match(/₹([\d,]+)/);
                              return sum + (amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0);
                            }
                          }, 0)
                          ?.toLocaleString() || '0'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowEmployeeNotes(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Salary Payment Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Salary Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {editingPayment && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-lg">{editingPayment.employee_name}</h3>
                  <p className="text-sm text-gray-600">Payment for {editingPayment.payment_month}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_salary">Base Salary</Label>
                  <Input
                    id="base_salary"
                    type="number"
                    value={editFormData.base_salary}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, base_salary: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="leave_deductions">Leave Deductions</Label>
                  <Input
                    id="leave_deductions"
                    type="number"
                    value={editFormData.leave_deductions}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, leave_deductions: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="unpaid_leave_days">Unpaid Leave Days</Label>
                  <Input
                    id="unpaid_leave_days"
                    type="number"
                    value={editFormData.unpaid_leave_days}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, unpaid_leave_days: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="net_salary">Net Salary</Label>
                  <Input
                    id="net_salary"
                    type="number"
                    value={editFormData.net_salary}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, net_salary: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="deduction_percentage">Deduction Percentage</Label>
                  <Input
                    id="deduction_percentage"
                    type="number"
                    step="0.01"
                    value={editFormData.deduction_percentage}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, deduction_percentage: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="payment_date">Payment Date</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={editFormData.payment_date}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <Select
                    value={editFormData.payment_method}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_reference">Payment Reference</Label>
                  <Input
                    id="payment_reference"
                    value={editFormData.payment_reference}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, payment_reference: e.target.value }))}
                    placeholder="Transaction ID, Cheque number, etc."
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this payment"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_paid"
                  checked={editFormData.is_paid}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, is_paid: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is_paid">Mark as Paid</Label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePayment}>
                  Update Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmDialog} onOpenChange={() => setDeleteConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Salary Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {deleteConfirmDialog && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete the salary payment for:
                  </p>
                  <div className="p-4 bg-gray-50 rounded-lg space-y-1">
                    <p className="font-medium">{deleteConfirmDialog.employee_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Payment Month: {deleteConfirmDialog.payment_month}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Net Salary: {formatCurrency(deleteConfirmDialog.net_salary)}
                    </p>
                  </div>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This action cannot be undone. This will permanently delete the salary payment record.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteConfirmDialog(null)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleDeletePayment}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
