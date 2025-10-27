import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  User, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminAddLeaveDialog from './AdminAddLeaveDialog';

interface LeaveBalance {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_category_name: string;
  leave_type_id: string;
  leave_type_name: string;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
  probation_allocated_days: number;
  probation_used_days: number;
  probation_remaining_days: number;
  is_on_probation: boolean;
  joined_on_date: string;
  year: number;
}

interface LeaveBalanceSummary {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_category_name: string;
  total_allocated: number;
  total_used: number;
  total_remaining: number;
  is_on_probation: boolean;
  probation_days_used: number;
  probation_days_remaining: number;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_is_paid: boolean;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  work_from_home: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeLeaveBalanceProps {
  selectedEmployeeId?: string | null;
  showOnlyDialog?: boolean;
}

const EmployeeLeaveBalance: React.FC<EmployeeLeaveBalanceProps> = ({ selectedEmployeeId, showOnlyDialog = false }) => {
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [summaryData, setSummaryData] = useState<LeaveBalanceSummary[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showLeaveDetails, setShowLeaveDetails] = useState(false);
  const [selectedEmployeeRequests, setSelectedEmployeeRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaveBalances();
    loadLeaveRequests();
  }, [selectedYear, selectedMonth]);


  const loadLeaveBalances = async () => {
    setLoading(true);
    try {
      // Get all active employees first
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          employee_category_id,
          joined_on_date,
          probation_period_months,
          employee_categories(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (employeesError) {
        console.error('Error loading employees:', employeesError);
        throw employeesError;
      }

      // Get leave balances for the selected year
      const { data: balances, error: balancesError } = await supabase
        .from('leave_balances')
        .select(`
          *,
          profiles(name, email, employee_category_id, joined_on_date, employee_categories(name)),
          leave_types(name)
        `)
        .eq('year', selectedYear);

      if (balancesError) {
        console.error('Error loading leave balances:', balancesError);
        throw balancesError;
      }

      // Create a map of existing balances by employee_id
      const balancesMap = new Map();
      balances?.forEach(balance => {
        const isOnProbation = new Date(balance.profiles.joined_on_date) > 
          new Date(Date.now() - (balance.profiles.probation_period_months || 3) * 30 * 24 * 60 * 60 * 1000);

        const balanceData = {
          id: balance.id,
          employee_id: balance.employee_id,
          employee_name: balance.profiles.name,
          employee_email: balance.profiles.email,
          employee_category_name: balance.profiles.employee_categories?.name,
          leave_type_id: balance.leave_type_id,
          leave_type_name: balance.leave_types.name,
          allocated_days: balance.allocated_days,
          used_days: balance.used_days,
          remaining_days: balance.remaining_days,
          probation_allocated_days: balance.probation_allocated_days,
          probation_used_days: balance.probation_used_days,
          probation_remaining_days: balance.probation_remaining_days,
          is_on_probation: isOnProbation,
          joined_on_date: balance.profiles.joined_on_date,
          year: balance.year
        };

        if (!balancesMap.has(balance.employee_id)) {
          balancesMap.set(balance.employee_id, []);
        }
        balancesMap.get(balance.employee_id).push(balanceData);
      });

      // Create comprehensive list including all employees
      const allEmployeesWithBalances = employees?.map(emp => {
        const isOnProbation = new Date(emp.joined_on_date) > 
          new Date(Date.now() - (emp.probation_period_months || 3) * 30 * 24 * 60 * 60 * 1000);

        const employeeBalances = balancesMap.get(emp.id) || [];
        
        // If no balances exist, create a default entry
        if (employeeBalances.length === 0) {
          return {
            id: `default-${emp.id}`,
            employee_id: emp.id,
            employee_name: emp.name,
            employee_email: emp.email,
            employee_category_name: emp.employee_categories?.name,
            leave_type_id: null,
            leave_type_name: 'No Leave Type',
            allocated_days: 0,
            used_days: 0,
            remaining_days: 0,
            probation_allocated_days: 0,
            probation_used_days: 0,
            probation_remaining_days: 0,
            is_on_probation: isOnProbation,
            joined_on_date: emp.joined_on_date,
            year: selectedYear
          };
        }

        return employeeBalances;
      }).flat() || [];

      setLeaveBalances(allEmployeesWithBalances);

      // Calculate summary data (will be recalculated after leave requests are loaded)
      const summary = calculateSummary(allEmployeesWithBalances);
      console.log('Calculated summary:', summary);
      setSummaryData(summary);

      // If no employees found, try to load employees directly
      if (allEmployeesWithBalances.length === 0) {
        console.log('No employees found, loading employees directly...');
        await loadEmployeesDirectly();
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeesDirectly = async () => {
    try {
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          employee_category_id,
          joined_on_date,
          probation_period_months,
          employee_categories(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (employeesError) {
        console.error('Error loading employees:', employeesError);
        return;
      }

      // Create summary data from employees
      const employeeSummary = employees?.map(emp => ({
        employee_id: emp.id,
        employee_name: emp.name,
        employee_email: emp.email,
        employee_category_name: emp.employee_categories?.name,
        total_allocated: 0,
        total_used: 0,
        total_remaining: 0,
        is_on_probation: new Date(emp.joined_on_date) > new Date(Date.now() - (emp.probation_period_months || 3) * 30 * 24 * 60 * 60 * 1000),
        probation_days_used: 0,
        probation_days_remaining: 0
      })) || [];

      console.log('Loaded employees directly:', employeeSummary);
      setSummaryData(employeeSummary);
    } catch (err: any) {
      console.error('Error loading employees directly:', err);
    }
  };

  const loadLeaveRequests = async () => {
    try {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          leave_types(name, is_paid)
        `)
        .gte('start_date', `${selectedYear}-01-01`)
        .lte('start_date', `${selectedYear}-12-31`);

      // Add month filtering if selected
      if (selectedMonth !== null) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        query = query
          .gte('start_date', `${selectedYear}-${monthStr}-01`)
          .lte('start_date', `${selectedYear}-${monthStr}-31`);
      }

      const { data: requests, error: requestsError } = await query;

      if (requestsError) {
        console.error('Error loading leave requests:', requestsError);
        throw requestsError;
      }

      const transformedRequests = requests?.map(request => ({
        id: request.id,
        user_id: request.user_id,
        leave_type_id: request.leave_type_id,
        leave_type_name: request.leave_types.name,
        leave_type_is_paid: request.leave_types.is_paid,
        start_date: request.start_date,
        end_date: request.end_date,
        days_requested: request.days_requested,
        reason: request.reason,
        work_from_home: request.work_from_home,
        status: request.status,
        approved_by: request.approved_by,
        approved_at: request.approved_at,
        rejection_reason: request.rejection_reason,
        created_at: request.created_at,
        updated_at: request.updated_at
      })) || [];

      setLeaveRequests(transformedRequests);
      
      // Recalculate summary with filtered leave requests for month filtering
      if (selectedMonth !== null) {
        const summary = calculateSummary(leaveBalances);
        setSummaryData(summary);
      }
    } catch (err: any) {
      console.error('Error loading leave requests:', err);
    }
  };

  const calculateSummary = (balances: LeaveBalance[]): LeaveBalanceSummary[] => {
    const employeeMap = new Map<string, LeaveBalanceSummary>();

    balances.forEach(balance => {
      if (!employeeMap.has(balance.employee_id)) {
        employeeMap.set(balance.employee_id, {
          employee_id: balance.employee_id,
          employee_name: balance.employee_name,
          employee_email: balance.employee_email,
          employee_category_name: balance.employee_category_name,
          total_allocated: 0,
          total_used: 0,
          total_remaining: 0,
          is_on_probation: balance.is_on_probation,
          probation_days_used: 0,
          probation_days_remaining: 0
        });
      }

      const summary = employeeMap.get(balance.employee_id)!;
      
      // Always use the allocated days from the database
      if (balance.is_on_probation) {
        summary.probation_days_used += balance.probation_used_days;
        summary.probation_days_remaining += balance.probation_remaining_days;
      } else {
        summary.total_allocated += balance.allocated_days;
        // For month filtering, calculate used days from filtered leave requests
        if (selectedMonth !== null) {
          const employeeRequests = leaveRequests.filter(req => 
            req.user_id === balance.employee_id && 
            req.status === 'approved'
          );
          const usedDays = employeeRequests.reduce((sum, req) => sum + req.days_requested, 0);
          summary.total_used += usedDays;
          summary.total_remaining = summary.total_allocated - summary.total_used;
        } else {
          // For annual view, use database values
          summary.total_used += balance.used_days;
          summary.total_remaining += balance.remaining_days;
        }
      }
    });

    return Array.from(employeeMap.values());
  };

  const refreshBalances = async () => {
    setLoading(true);
    try {
      // Trigger the refresh function to recalculate all balances
      const targetYear = parseInt(selectedYear.toString());
      console.log('refresh_employee_leave_balances - selectedYear:', selectedYear, typeof selectedYear);
      console.log('refresh_employee_leave_balances - targetYear:', targetYear, typeof targetYear);
      
      const { error } = await supabase.rpc('refresh_employee_leave_balances', {
        target_year: targetYear
      });

      if (error) throw error;

      await loadLeaveBalances();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      years.push(i);
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

  const getStatusColor = (remaining: number, allocated: number) => {
    const percentage = allocated > 0 ? (remaining / allocated) * 100 : 0;
    if (percentage >= 75) return "bg-green-100 text-green-800";
    if (percentage >= 50) return "bg-yellow-100 text-yellow-800";
    if (percentage >= 25) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getEmployeeLeaveRequests = (employeeId: string) => {
    return leaveRequests.filter(request => request.user_id === employeeId);
  };

  const getEmployeeTotalLeavesTaken = (employeeId: string) => {
    // Get the total used days from leave_balances (automatically calculated by database)
    const employeeBalances = leaveBalances.filter(balance => balance.employee_id === employeeId);
    return employeeBalances.reduce((total, balance) => {
      if (balance.is_on_probation) {
        return total + balance.probation_used_days;
      } else {
        return total + balance.used_days;
      }
    }, 0);
  };

  const getEmployeeLeavesTakenCount = (employeeId: string) => {
    // Get the actual count of approved leave requests (number of requests, not days)
    const employeeRequests = getEmployeeLeaveRequests(employeeId);
    return employeeRequests.filter(request => request.status === 'approved').length;
  };

  const getEmployeeLeavesTakenDays = (employeeId: string) => {
    // Get the total days from approved leave requests
    const employeeRequests = getEmployeeLeaveRequests(employeeId);
    return employeeRequests
      .filter(request => request.status === 'approved')
      .reduce((total, request) => total + request.days_requested, 0);
  };

  const showEmployeeLeaveDetails = (employeeId: string) => {
    const employeeRequests = getEmployeeLeaveRequests(employeeId);
    setSelectedEmployeeRequests(employeeRequests);
    setShowLeaveDetails(true);
  };

  // Handle selectedEmployeeId prop - show leave details dialog instead of filtering
  useEffect(() => {
    if (selectedEmployeeId) {
      showEmployeeLeaveDetails(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // Statistics functions
  const getAverageLeavesPerEmployee = () => {
    if (summaryData.length === 0) return 0;
    const totalLeaves = summaryData.reduce((sum, emp) => {
      const employeeRequests = getEmployeeLeaveRequests(emp.employee_id);
      return sum + employeeRequests
        .filter(request => request.status === 'approved')
        .reduce((total, request) => total + request.days_requested, 0);
    }, 0);
    return Math.round((totalLeaves / summaryData.length) * 10) / 10;
  };


  const getTotalLeaveRequests = () => {
    return leaveRequests.length;
  };

  const getApprovedLeaveRequests = () => {
    return leaveRequests.filter(request => request.status === 'approved').length;
  };

  const getPendingLeaveRequests = () => {
    return leaveRequests.filter(request => request.status === 'pending').length;
  };

  const getRejectedLeaveRequests = () => {
    return leaveRequests.filter(request => request.status === 'rejected').length;
  };

  const updateLeaveRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      setLoading(true);
      
      // Handle approval/rejection with direct table operations
      if (newStatus === 'approved') {
        // First, get the leave request details
        const { data: leaveRequest, error: fetchError } = await supabase
          .from('leave_requests')
          .select(`
            *,
            leave_types!inner(name, is_paid)
          `)
          .eq('id', requestId)
          .single();

        if (fetchError) {
          console.error('Error fetching leave request:', fetchError);
          setError('Failed to fetch leave request details');
          return;
        }

        // Get the profile details with employee category info
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id, 
            employee_category_id,
            employee_categories!inner(name, is_paid_leave_eligible)
          `)
          .eq('user_id', leaveRequest.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setError('Failed to fetch profile details');
          return;
        }

        // Update the leave request status
        const { error: updateError } = await supabase
          .from('leave_requests')
          .update({ 
            status: newStatus,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) {
          console.error('Error updating leave request status:', updateError);
          setError('Failed to update leave request status');
          return;
        }

        // Create leave records for each day in the leave period
        const startDate = new Date(leaveRequest.start_date);
        const endDate = new Date(leaveRequest.end_date);
        const leaveRecords = [];

        // Generate leave records for each day
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          leaveRecords.push({
            user_id: leaveRequest.user_id,
            profile_id: profile.id,
            leave_date: date.toISOString().split('T')[0],
            leave_type_id: leaveRequest.leave_type_id,
            leave_type_name: leaveRequest.leave_types.name,
            is_paid_leave: leaveRequest.leave_types.is_paid || false,
            is_approved: true,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString(),
            leave_request_id: requestId,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            notes: `Auto-generated from approved leave request`
          });
        }

        // Insert leave records
        if (leaveRecords.length > 0) {
          const { error: insertError } = await supabase
            .from('leaves')
            .insert(leaveRecords);

          if (insertError) {
            console.error('Error inserting leave records:', insertError);
            // Don't throw here, just log the error as the approval was successful
          }
        }
      } else {
        // For rejections or other statuses, just update the request
        const { error } = await supabase
          .from('leave_requests')
          .update({ 
            status: newStatus,
            approved_by: newStatus === 'approved' || newStatus === 'rejected' ? (await supabase.auth.getUser()).data.user?.id : null,
            approved_at: newStatus === 'approved' || newStatus === 'rejected' ? new Date().toISOString() : null
          })
          .eq('id', requestId);

        if (error) {
          console.error('Error updating leave request status:', error);
          setError('Failed to update leave request status');
          return;
        }
      }

      // Refresh the data
      await loadLeaveRequests();
      await loadLeaveBalances();
      
      // Update the selected employee requests if dialog is open
      if (showLeaveDetails) {
        const updatedRequests = selectedEmployeeRequests.map(req => 
          req.id === requestId ? { ...req, status: newStatus as any } : req
        );
        setSelectedEmployeeRequests(updatedRequests);
      }
    } catch (err: any) {
      console.error('Error updating leave request status:', err);
      setError('Failed to update leave request status');
    } finally {
      setLoading(false);
    }
  };

  const updateLeaveTypePaidStatus = async (leaveTypeId: string, isPaid: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('leave_types')
        .update({ is_paid: isPaid })
        .eq('id', leaveTypeId);

      if (error) {
        console.error('Error updating leave type paid status:', error);
        setError('Failed to update leave type paid status');
        return;
      }

      // Refresh the data
      await loadLeaveRequests();
      
      // Update the selected employee requests if dialog is open
      if (showLeaveDetails) {
        const updatedRequests = selectedEmployeeRequests.map(req => 
          req.leave_type_id === leaveTypeId ? { ...req, leave_type_is_paid: isPaid } : req
        );
        setSelectedEmployeeRequests(updatedRequests);
      }
    } catch (err: any) {
      console.error('Error updating leave type paid status:', err);
      setError('Failed to update leave type paid status');
    } finally {
      setLoading(false);
    }
  };

  const filteredSummary = selectedEmployee && selectedEmployee !== 'all'
    ? summaryData.filter(emp => emp.employee_id === selectedEmployee)
    : summaryData;

  const selectedEmployeeDetails = selectedEmployee && selectedEmployee !== 'all'
    ? leaveBalances.filter(balance => balance.employee_id === selectedEmployee)
    : [];

  // If showOnlyDialog is true, only render the dialog
  if (showOnlyDialog) {
    return (
      <>
        {/* Leave Details Dialog */}
        <Dialog open={showLeaveDetails} onOpenChange={setShowLeaveDetails}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Leave Request Details</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Detailed view of all leave requests for the selected employee
              </p>
            </DialogHeader>
            <div className="space-y-4">
              {selectedEmployeeRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests found for this employee in {selectedYear}
                </div>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[60vh]">
                  <Table className="min-w-[1200px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Leave Type</TableHead>
                        <TableHead className="w-24">Start Date</TableHead>
                        <TableHead className="w-24">End Date</TableHead>
                        <TableHead className="w-16">Days</TableHead>
                        <TableHead className="w-24">Paid/Unpaid</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-24">Added By</TableHead>
                        <TableHead className="w-48">Reason</TableHead>
                        <TableHead className="w-24">Work From Home</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEmployeeRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.leave_type_name}</TableCell>
                          <TableCell>{new Date(request.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(request.end_date).toLocaleDateString()}</TableCell>
                          <TableCell>{request.days_requested}</TableCell>
                          <TableCell>
                            <Select 
                              value={request.leave_type_is_paid ? 'paid' : 'unpaid'} 
                              onValueChange={(value) => updateLeaveTypePaidStatus(request.leave_type_id, value === 'paid')}
                              disabled={loading}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paid">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    Paid
                                  </div>
                                </SelectItem>
                                <SelectItem value="unpaid">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                    Unpaid
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={request.status} 
                              onValueChange={(newStatus) => updateLeaveRequestStatus(request.id, newStatus)}
                              disabled={loading}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    Pending
                                  </div>
                                </SelectItem>
                                <SelectItem value="approved">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    Approved
                                  </div>
                                </SelectItem>
                                <SelectItem value="rejected">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    Rejected
                                  </div>
                                </SelectItem>
                                <SelectItem value="cancelled">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                    Cancelled
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {request.approved_by ? (
                              <Badge variant="outline" className="text-blue-600">
                                Admin Added
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600">
                                Employee Request
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div 
                              className="truncate cursor-help" 
                              title={request.reason || 'N/A'}
                            >
                              {request.reason || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {request.work_from_home ? (
                              <Badge variant="outline" className="text-green-600">Yes</Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600">No</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    Total approved leaves: {selectedEmployeeRequests
                      .filter(req => req.status === 'approved')
                      .reduce((sum, req) => sum + req.days_requested, 0)} days
                  </div>
                  <div className="flex gap-4">
                    <span>
                      Paid: {selectedEmployeeRequests
                        .filter(req => req.status === 'approved' && req.leave_type_is_paid)
                        .reduce((sum, req) => sum + req.days_requested, 0)} days
                    </span>
                    <span>
                      Unpaid: {selectedEmployeeRequests
                        .filter(req => req.status === 'approved' && !req.leave_type_is_paid)
                        .reduce((sum, req) => sum + req.days_requested, 0)} days
                    </span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowLeaveDetails(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employee Leave Balances</h2>
          <p className="text-muted-foreground">
            Track annual leave allocations and remaining balances for all employees
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getYearOptions().map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedMonth?.toString() || "all"} 
            onValueChange={(value) => setSelectedMonth(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {getMonthOptions().map(month => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AdminAddLeaveDialog onLeaveAdded={() => {
            loadLeaveBalances();
            loadLeaveRequests();
          }} />
          <Button onClick={refreshBalances} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}



      {/* Employee Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Employee</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEmployee || undefined} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an employee to view details" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {summaryData.map(employee => (
                <SelectItem key={employee.employee_id} value={employee.employee_id}>
                  {employee.employee_name} ({employee.employee_email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Balance Summary</CardTitle>
          <p className="text-sm text-muted-foreground">
            Overview of leave allocations and usage for {selectedYear}
            {selectedMonth !== null && ` - ${getMonthOptions().find(m => m.value === selectedMonth)?.label}`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allocated Days</TableHead>
                  <TableHead>Used Days</TableHead>
                  <TableHead>Leaves Taken (Days)</TableHead>
                  <TableHead>Remaining Days</TableHead>
                  <TableHead>Usage %</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummary.map((employee) => {
                  const totalDays = employee.is_on_probation 
                    ? employee.probation_days_used + employee.probation_days_remaining
                    : employee.total_allocated;
                  const usedDays = employee.is_on_probation 
                    ? employee.probation_days_used
                    : employee.total_used;
                  const remainingDays = employee.is_on_probation 
                    ? employee.probation_days_remaining
                    : employee.total_remaining;
                  const usagePercentage = totalDays > 0 ? Math.round((usedDays / totalDays) * 100) : 0;

                  return (
                    <TableRow key={employee.employee_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee.employee_name}</div>
                          <div className="text-sm text-muted-foreground">{employee.employee_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {employee.employee_category_name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.is_on_probation ? "destructive" : "default"}>
                          {employee.is_on_probation ? "On Probation" : "Confirmed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{totalDays}</TableCell>
                      <TableCell className="text-orange-600">{usedDays}</TableCell>
                      <TableCell 
                        className="text-blue-600 cursor-pointer hover:underline"
                        onClick={() => showEmployeeLeaveDetails(employee.employee_id)}
                        title={`${getEmployeeLeavesTakenCount(employee.employee_id)} leave requests`}
                      >
                        {getEmployeeLeavesTakenDays(employee.employee_id)} days
                      </TableCell>
                      <TableCell className="text-green-600">{remainingDays}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${getStatusColor(remainingDays, totalDays).replace('text-', 'bg-').replace('100', '500')}`}
                              style={{ width: `${usagePercentage}%` }}
                            />
                          </div>
                          <span className="text-sm">{usagePercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedEmployee(employee.employee_id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Leave Details - {employee.employee_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Total Allocated</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold">{totalDays}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Used Days</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-orange-600">{usedDays}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Remaining</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-green-600">{remainingDays}</div>
                                  </CardContent>
                                </Card>
                              </div>
                              
                              <div className="rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Leave Type</TableHead>
                                      <TableHead>Allocated</TableHead>
                                      <TableHead>Used</TableHead>
                                      <TableHead>Remaining</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {selectedEmployeeDetails.map((detail) => (
                                      <TableRow key={detail.leave_type_id}>
                                        <TableCell className="font-medium">{detail.leave_type_name}</TableCell>
                                        <TableCell>{detail.is_on_probation ? detail.probation_allocated_days : detail.allocated_days}</TableCell>
                                        <TableCell className="text-orange-600">
                                          {detail.is_on_probation ? detail.probation_used_days : detail.used_days}
                                        </TableCell>
                                        <TableCell className="text-green-600">
                                          {detail.is_on_probation ? detail.probation_remaining_days : detail.remaining_days}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Leave Details Dialog */}
      <Dialog open={showLeaveDetails} onOpenChange={setShowLeaveDetails}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Detailed view of all leave requests for the selected employee
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEmployeeRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave requests found for this employee in {selectedYear}
              </div>
            ) : (
              <div className="rounded-md border overflow-auto max-h-[60vh]">
                <Table className="min-w-[1200px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Leave Type</TableHead>
                      <TableHead className="w-24">Start Date</TableHead>
                      <TableHead className="w-24">End Date</TableHead>
                      <TableHead className="w-16">Days</TableHead>
                      <TableHead className="w-24">Paid/Unpaid</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-24">Added By</TableHead>
                      <TableHead className="w-48">Reason</TableHead>
                      <TableHead className="w-24">Work From Home</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEmployeeRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.leave_type_name}</TableCell>
                        <TableCell>{new Date(request.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(request.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>{request.days_requested}</TableCell>
                        <TableCell>
                          <Select 
                            value={request.leave_type_is_paid ? 'paid' : 'unpaid'} 
                            onValueChange={(value) => updateLeaveTypePaidStatus(request.leave_type_id, value === 'paid')}
                            disabled={loading}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  Paid
                                </div>
                              </SelectItem>
                              <SelectItem value="unpaid">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                  Unpaid
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={request.status} 
                            onValueChange={(newStatus) => updateLeaveRequestStatus(request.id, newStatus)}
                            disabled={loading}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                  Pending
                                </div>
                              </SelectItem>
                              <SelectItem value="approved">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  Approved
                                </div>
                              </SelectItem>
                              <SelectItem value="rejected">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                  Rejected
                                </div>
                              </SelectItem>
                              <SelectItem value="cancelled">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                  Cancelled
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {request.approved_by ? (
                            <Badge variant="outline" className="text-blue-600">
                              Admin Added
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-600">
                              Employee Request
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div 
                            className="truncate cursor-help" 
                            title={request.reason || 'N/A'}
                          >
                            {request.reason || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {request.work_from_home ? (
                            <Badge variant="outline" className="text-green-600">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-600">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  Total approved leaves: {selectedEmployeeRequests
                    .filter(req => req.status === 'approved')
                    .reduce((sum, req) => sum + req.days_requested, 0)} days
                </div>
                <div className="flex gap-4">
                  <span>
                    Paid: {selectedEmployeeRequests
                      .filter(req => req.status === 'approved' && req.leave_type_is_paid)
                      .reduce((sum, req) => sum + req.days_requested, 0)} days
                  </span>
                  <span>
                    Unpaid: {selectedEmployeeRequests
                      .filter(req => req.status === 'approved' && !req.leave_type_is_paid)
                      .reduce((sum, req) => sum + req.days_requested, 0)} days
                  </span>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowLeaveDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLeaveBalance;
