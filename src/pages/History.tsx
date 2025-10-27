import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Home, Edit, Save, X, Users, User, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExtraWorkLog {
  id: string;
  work_type: string;
  hours_worked: number;
  description: string | null;
  logged_at: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface RuleViolation {
  id: string;
  rule_id: string;
  warning_level: number;
  reason: string | null;
  flagged_by: string;
  flagged_at: string;
  created_at: string;
  office_rules: {
    id: string;
    title: string;
    description: string;
  };
  flagged_by_profile?: {
    id: string;
    name: string;
  };
}

interface HistoryEntry {
  id: string;
  user_id: string;
  employee_code?: string | null;
  employee_name?: string | null;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  manual_status?: string | null;
  manual_override_by?: string | null;
  manual_override_at?: string | null;
  manual_override_reason?: string | null;
  is_late?: boolean;
  device_info: string;
  device_id?: string | null;
  source: string;
  modification_reason?: string | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
  last_modified_by?: string | null;
  created_at: string;
  updated_at: string;
  day_updates?: Array<{
    id: string;
    today_focus: string;
    progress: string;
    blockers: string | null;
    created_at: string;
    updated_at: string;
  }>;
  extra_work_logs?: Array<{
    id: string;
    work_type: string;
    hours_worked: number;
    description: string | null;
    logged_at: string;
    created_at: string;
    updated_at: string;
  }>;
  rule_violations?: RuleViolation[];
}

export default function History() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of current month
    return date.toISOString().split('T')[0];
  });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<HistoryEntry | null>(null);
  const [editTimes, setEditTimes] = useState({
    check_in: '',
    check_out: '',
    lunch_start: '',
    lunch_end: ''
  });
  const [editOverride, setEditOverride] = useState({
    manual_status: 'none',
    manual_override_reason: ''
  });
  const [saving, setSaving] = useState(false);
  // Manager-specific state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading) {
      if (role === 'manager' || role === 'admin') {
        fetchEmployees();
      } else {
        // For employees, fetch their own history immediately
        fetchHistory();
      }
    }
  }, [user, roleLoading, navigate]);

  // Handle URL parameters after employees are loaded
  useEffect(() => {
    const employeeId = searchParams.get('employee');
    
    if (employeeId && (role === 'admin' || role === 'manager') && employees.length > 0) {
      setSelectedEmployeeId(employeeId);
      // Find employee name
      const employee = employees.find(emp => emp.id === employeeId);
      if (employee) {
        setSelectedEmployeeName(employee.name);
      }
    }
  }, [searchParams, role, employees]);

  // Fetch history when employee is selected or dates change
  useEffect(() => {
    if (selectedEmployeeId || role === 'employee') {
      fetchHistory();
    }
  }, [selectedEmployeeId, startDate, endDate, role]);

  // Separate effect to handle date changes for employees
  useEffect(() => {
    if (role === 'employee' && user) {
      fetchHistory();
    }
  }, [startDate, endDate, role, user]);

  const fetchEmployees = async () => {
    try {
      const { data: employeesData, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setEmployees(employeesData || []);
      
      // Set current user as default selected employee only if no employee is already selected
      if (user && !selectedEmployeeId) {
        setSelectedEmployeeId(user.id);
        // Find and set the current user's name
        const currentUser = employeesData?.find(emp => emp.id === user.id);
        if (currentUser) {
          setSelectedEmployeeName(currentUser.name);
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch employees',
        variant: 'destructive',
      });
    }
  };

  const fetchHistory = async (fetchAll = false) => {
    if (!user) return;

    // Determine target user ID based on role and URL parameters
    let targetUserId: string;
    if (role === 'admin' || role === 'manager') {
      // For admins and managers, use selectedEmployeeId from URL or current user
      targetUserId = selectedEmployeeId || user.id;
    } else {
      // For regular employees, only show their own data
      targetUserId = user.id;
    }

    if (!targetUserId) return;

    setLoading(true);
    console.log('Fetching history for user:', targetUserId, 'Date range:', startDate, 'to', endDate, 'Fetch all:', fetchAll);

    try {
      let query = supabase
        .from('unified_attendance')
        .select(`
          *,
          day_updates (
            id,
            today_focus,
            progress,
            blockers,
            created_at,
            updated_at
          ),
          extra_work_logs (
            id,
            work_type,
            hours_worked,
            description,
            logged_at,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', targetUserId);

      // Fetch rule violations for the user separately
      const { data: ruleViolations, error: violationsError } = await supabase
        .from('rule_violations')
        .select(`
          id,
          rule_id,
          warning_level,
          reason,
          flagged_by,
          flagged_at,
          created_at,
          office_rules!inner (
            id,
            title,
            description
          ),
        `)
        .eq('user_id', targetUserId)
        .gte('flagged_at', startDate)
        .lte('flagged_at', endDate + 'T23:59:59')
        .order('flagged_at', { ascending: false });

      if (violationsError) {
        console.warn('Error fetching rule violations:', violationsError);
      } else {
        console.log('Rule violations fetched:', ruleViolations);
        console.log('Date range for violations:', startDate, 'to', endDate);
        
        // Fetch flagged_by user names separately if violations exist
        if (ruleViolations && ruleViolations.length > 0) {
          const flaggedByIds = [...new Set(ruleViolations.map(v => v.flagged_by))];
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', flaggedByIds);
          
          if (profilesError) {
            console.warn('Error fetching flagged_by profiles:', profilesError);
          }
          
          // Add profile names to violations
          ruleViolations.forEach(violation => {
            violation.flagged_by_profile = profiles?.find(p => p.id === violation.flagged_by) || null;
          });
        }
      }

      if (!fetchAll) {
        query = query
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);
      }

      const { data, error } = await query.order('entry_date', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      console.log('Fetched entries:', data?.length || 0, 'records');
      console.log('Fetched rule violations:', ruleViolations?.length || 0, 'violations');
      
      if (!ruleViolations || ruleViolations.length === 0) {
        console.log('No rule violations found for user:', targetUserId, 'in date range:', startDate, 'to', endDate);
      }
      
      // Combine attendance entries with rule violations
      const entriesWithViolations = (data || []).map((entry: any) => {
        // Find rule violations for this specific date
        const entryViolations = (ruleViolations || []).filter((violation: any) => {
          const violationDate = new Date(violation.flagged_at).toISOString().split('T')[0];
          return violationDate === entry.entry_date;
        });
        
        if (entryViolations.length > 0) {
          console.log(`Found ${entryViolations.length} violations for ${entry.entry_date}:`, entryViolations);
        }
        
        return {
          ...entry,
          rule_violations: entryViolations
        };
      });
      
      // Create standalone entries for rule violations that don't have attendance records
      const violationDates = new Set((ruleViolations || []).map((violation: any) => 
        new Date(violation.flagged_at).toISOString().split('T')[0]
      ));
      
      const attendanceDates = new Set((data || []).map((entry: any) => entry.entry_date));
      
      const standaloneViolations = Array.from(violationDates).filter(date => !attendanceDates.has(date));
      
      console.log('Standalone violation dates:', standaloneViolations);
      
      const standaloneEntries = standaloneViolations.map((date: string) => {
        const dateViolations = (ruleViolations || []).filter((violation: any) => {
          const violationDate = new Date(violation.flagged_at).toISOString().split('T')[0];
          return violationDate === date;
        });
        
        console.log(`Creating standalone entry for ${date} with ${dateViolations.length} violations`);
        
        return {
          id: `violation-${date}`,
          user_id: targetUserId,
          entry_date: date,
          check_in_at: null,
          check_out_at: null,
          total_work_time_minutes: null,
          status: 'violation_only',
          is_late: false,
          device_info: 'Rule Violation',
          device_id: null,
          source: 'rule_violation',
          modification_reason: null,
          lunch_break_start: null,
          lunch_break_end: null,
          last_modified_by: null,
          created_at: dateViolations[0]?.flagged_at || new Date().toISOString(),
          updated_at: dateViolations[0]?.flagged_at || new Date().toISOString(),
          day_updates: [],
          extra_work_logs: [],
          rule_violations: dateViolations
        };
      });
      
      const allEntries = [...entriesWithViolations, ...standaloneEntries].sort((a, b) => 
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
      
      setEntries(allEntries);

      // If edit mode was requested via URL, find the first entry and open its edit dialog
      const editMode = searchParams.get('edit') === 'true';
      if (editMode && role === 'admin' && entriesWithViolations && entriesWithViolations.length > 0) {
        setSelectedEntry(entriesWithViolations[0] as HistoryEntry);
        startEditing(entriesWithViolations[0] as HistoryEntry);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch attendance history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (entry: HistoryEntry) => {
    setEditingEntry(entry);
    
    // Helper function to convert database timestamp to HTML time input format
    const formatTimeForInput = (timestamp: string | null) => {
      if (!timestamp) return '';
      try {
        const date = new Date(timestamp);
        // Format as HH:MM for HTML time input using local time
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch (error) {
        console.error('Error formatting time:', error, timestamp);
        return '';
      }
    };

    setEditTimes({
      check_in: formatTimeForInput(entry.check_in_at),
      check_out: formatTimeForInput(entry.check_out_at),
      lunch_start: formatTimeForInput(entry.lunch_break_start),
      lunch_end: formatTimeForInput(entry.lunch_break_end)
    });

    setEditOverride({
      manual_status: entry.manual_status || 'none',
      manual_override_reason: entry.manual_override_reason || ''
    });

    console.log('Starting edit with times:', {
      entry,
      editTimes: {
        check_in: formatTimeForInput(entry.check_in_at),
        check_out: formatTimeForInput(entry.check_out_at),
        lunch_start: formatTimeForInput(entry.lunch_break_start),
        lunch_end: formatTimeForInput(entry.lunch_break_end)
      }
    });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditTimes({
      check_in: '',
      check_out: '',
      lunch_start: '',
      lunch_end: ''
    });
  };

  const saveTimes = async () => {
    if (!editingEntry || !user) return;

    // Validation
    if (editTimes.check_in && editTimes.check_out) {
      const checkIn = new Date(`${editingEntry.entry_date}T${editTimes.check_in}:00`);
      const checkOut = new Date(`${editingEntry.entry_date}T${editTimes.check_out}:00`);
      
      if (checkOut <= checkIn) {
        toast({
          title: 'Invalid Times',
          description: 'Check-out time must be after check-in time.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (editTimes.lunch_start && editTimes.lunch_end) {
      const lunchStart = new Date(`${editingEntry.entry_date}T${editTimes.lunch_start}:00`);
      const lunchEnd = new Date(`${editingEntry.entry_date}T${editTimes.lunch_end}:00`);
      
      if (lunchEnd <= lunchStart) {
        toast({
          title: 'Invalid Lunch Times',
          description: 'Lunch end time must be after lunch start time.',
          variant: 'destructive',
        });
        return;
      }

      // Check if lunch break is within work hours
      if (editTimes.check_in && editTimes.check_out) {
        const checkIn = new Date(`${editingEntry.entry_date}T${editTimes.check_in}:00`);
        const checkOut = new Date(`${editingEntry.entry_date}T${editTimes.check_out}:00`);
        
        if (lunchStart < checkIn || lunchEnd > checkOut) {
          toast({
            title: 'Invalid Lunch Times',
            description: 'Lunch break must be within work hours.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const entryDate = editingEntry.entry_date;
      
      // Fix date parsing - handle both string and Date objects
      let dateStr: string;
      if (typeof entryDate === 'string') {
        dateStr = entryDate;
      } else {
        dateStr = new Date(entryDate).toISOString().split('T')[0];
      }

      // Convert time strings to full datetime strings with proper timezone handling
      const createDateTime = (timeStr: string) => {
        if (!timeStr) return null;
        // Ensure time is in HH:MM format
        const time = timeStr.includes(':') ? timeStr : `${timeStr}:00`;
        
        // Create a local datetime and convert to UTC
        const localDateTime = new Date(`${dateStr}T${time}:00`);
        return localDateTime.toISOString();
      };

      const checkInDateTime = createDateTime(editTimes.check_in);
      const checkOutDateTime = createDateTime(editTimes.check_out);
      const lunchStartDateTime = createDateTime(editTimes.lunch_start);
      const lunchEndDateTime = createDateTime(editTimes.lunch_end);

      console.log('Time conversion debug:', {
        entryDate,
        dateStr,
        editTimes,
        checkInDateTime,
        checkOutDateTime,
        lunchStartDateTime,
        lunchEndDateTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset()
      });

      // Calculate new total work time
      let newTotalMinutes = 0;
      if (checkInDateTime && checkOutDateTime) {
        const checkIn = new Date(checkInDateTime);
        const checkOut = new Date(checkOutDateTime);
        const totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
        
        // Subtract lunch break if both lunch times are provided
        if (lunchStartDateTime && lunchEndDateTime) {
          const lunchStart = new Date(lunchStartDateTime);
          const lunchEnd = new Date(lunchEndDateTime);
          const lunchMinutes = (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60);
          newTotalMinutes = Math.max(0, totalMinutes - lunchMinutes);
        } else {
          newTotalMinutes = totalMinutes;
        }
      }

      // Update the unified attendance entry with proper error handling
      // Note: Status will be automatically updated by database trigger based on check-in/out times
      const { data, error } = await supabase
        .from('unified_attendance')
        .update({
          check_in_at: checkInDateTime,
          check_out_at: checkOutDateTime,
          lunch_break_start: lunchStartDateTime,
          lunch_break_end: lunchEndDateTime,
          total_work_time_minutes: newTotalMinutes > 0 ? Math.round(newTotalMinutes) : 0,
          manual_status: editOverride.manual_status === 'none' ? null : editOverride.manual_status || null,
          manual_override_by: user.id,
          manual_override_at: new Date().toISOString(),
          manual_override_reason: editOverride.manual_override_reason || null,
          updated_at: new Date().toISOString(),
          modification_reason: 'Admin time correction',
          source: 'manual' // Mark as manually edited
        })
        .eq('id', editingEntry.id)
        .select();

      if (error) throw error;

      toast({
        title: 'Times Updated',
        description: `Employee times have been successfully updated. Changes logged for audit trail.`,
      });

      // Refresh the history
      fetchHistory();
      cancelEditing();

    } catch (error: any) {
      console.error('Error updating times:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      let errorMessage = 'Failed to update times';
      if (error.message?.includes('permission denied')) {
        errorMessage = 'Permission denied. Please ensure you have admin access.';
      } else if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        errorMessage = 'Database function not found. Please run the database setup script.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getWorkTypeLabel = (workType: string) => {
    switch (workType) {
      case 'remote':
        return 'Remote Work';
      case 'overtime':
        return 'Overtime';
      case 'weekend':
        return 'Weekend Work';
      case 'other':
        return 'Other';
      default:
        return workType;
    }
  };

  const getTotalExtraHours = (extraWorkLogs: Array<{hours_worked: number}>) => {
    return extraWorkLogs.reduce((total, log) => total + log.hours_worked, 0);
  };

  const getWarningLevelLabel = (level: number) => {
    switch (level) {
      case 1:
        return 'Warning';
      case 2:
        return 'Serious Warning';
      case 3:
        return 'Final Warning';
      default:
        return 'Unknown';
    }
  };

  const getWarningLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 3:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };


  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {selectedEmployeeName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/employees')}
                    className="flex items-center gap-2 hover:bg-white/50 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Employees
                  </Button>
                )}
                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {selectedEmployeeName ? `${selectedEmployeeName}'s Work History` : 'Work History'}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <p className="text-sm sm:text-base font-medium">
                      {new Date(startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start-date" className="text-sm font-medium">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-date" className="text-sm font-medium">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
            {(role === 'admin' || role === 'manager') && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="employee-select" className="text-sm font-medium">Employee</Label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={(value) => {
                    setSelectedEmployeeId(value);
                    const employee = employees.find(emp => emp.id === value);
                    if (employee) {
                      setSelectedEmployeeName(employee.name);
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-auto">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-transparent">Actions</Label>
              <Button
                variant="outline"
                onClick={() => fetchHistory(true)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Loading...' : 'Fetch All Records'}
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <Card className="border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {entries.filter(e => {
                    // Filter by date range for stats calculation
                    if (!startDate || !endDate) return true;
                    return e.entry_date >= startDate && e.entry_date <= endDate;
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">Total Days</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {entries.filter(e => {
                    // Filter by date range and status
                    if (!startDate || !endDate) return e.status === 'completed';
                    return e.entry_date >= startDate && e.entry_date <= endDate && e.status === 'completed';
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">Completed Days</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-amber-600">
                  {entries.filter(e => {
                    // Filter by date range and status
                    if (!startDate || !endDate) return e.status === 'in_progress';
                    return e.entry_date >= startDate && e.entry_date <= endDate && e.status === 'in_progress';
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {entries.filter(e => {
                    // Filter by date range and status
                    if (!startDate || !endDate) return e.status === 'absent';
                    return e.entry_date >= startDate && e.entry_date <= endDate && e.status === 'absent';
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">Absent Days</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {entries.filter(e => {
                    // Filter by date range and holiday status
                    const isInDateRange = !startDate || !endDate || (e.entry_date >= startDate && e.entry_date <= endDate);
                    const isHoliday = e.status === 'holiday' || e.manual_status === 'Office Holiday';
                    return isInDateRange && isHoliday;
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">Holiday Days</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {entries.filter(e => {
                    // Filter by date range and late status
                    if (!startDate || !endDate) return e.is_late;
                    return e.entry_date >= startDate && e.entry_date <= endDate && e.is_late;
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">Late Entries</p>
              </CardContent>
            </Card>
            <Card className="border-indigo-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-indigo-600">
                  {Math.round(entries.filter(e => {
                    // Filter by date range for work hours calculation
                    if (!startDate || !endDate) return true;
                    return e.entry_date >= startDate && e.entry_date <= endDate;
                  }).reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0) / 60)}h
                </div>
                <p className="text-sm text-muted-foreground">Total Work Hours</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No history yet. Start your first day!</p>
              </CardContent>
            </Card>
          ) : (
            entries.map((entry) => (
              <Card
                key={entry.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedEntry(entry)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {new Date(entry.entry_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </CardTitle>
                      <CardDescription className="space-y-2 mt-2">
                        <div className="flex items-center gap-4">
                          {entry.status === 'violation_only' ? (
                            <span className="flex items-center gap-1 text-red-600">
                              ⚠️ Rule Violations Only
                            </span>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {entry.check_in_at
                                  ? new Date(entry.check_in_at).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Not checked in'}
                              </span>
                              {entry.check_out_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(entry.check_out_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                              {entry.total_work_time_minutes > 0 && (
                                <span>
                                  {Math.floor(entry.total_work_time_minutes / 60)}h{' '}
                                  {entry.total_work_time_minutes % 60}m worked
                                  {entry.extra_work_logs && entry.extra_work_logs.length > 0 && (
                                    <span className="text-success">
                                      {' '}+ {getTotalExtraHours(entry.extra_work_logs).toFixed(1)}h extra
                                    </span>
                                  )}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {entry.status === 'violation_only' ? (
                            <span>Source: Rule Violation</span>
                          ) : (
                            <>
                              <span>Source: {entry.source === 'teamoffice' ? 'Biometric' : 'Manual'}</span>
                              {entry.device_info && (
                                <span>Device: {entry.device_info}</span>
                              )}
                              {entry.is_late && (
                                <span className="text-red-600 font-medium">LATE</span>
                              )}
                            </>
                          )}
                        </div>
                        {entry.rule_violations && entry.rule_violations.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {entry.rule_violations.map((violation) => (
                              <span
                                key={violation.id}
                                className={`px-2 py-1 rounded-full text-xs font-medium border ${getWarningLevelColor(violation.warning_level)}`}
                              >
                                ⚠️ {getWarningLevelLabel(violation.warning_level)}: {violation.office_rules.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const isSunday = new Date(entry.entry_date).getDay() === 0;
                        const effectiveStatus = entry.manual_status === 'leave_granted' ? 'leave_granted' : entry.status;
                        const badgeClass =
                          (isSunday && effectiveStatus !== 'violation_only')
                            ? 'bg-blue-100 text-blue-800'
                            : effectiveStatus === 'completed'
                            ? 'bg-success/10 text-success'
                            : effectiveStatus === 'in_progress'
                            ? 'bg-warning/10 text-warning'
                            : effectiveStatus === 'violation_only'
                            ? 'bg-red-100 text-red-800'
                            : effectiveStatus === 'unlogged'
                            ? 'bg-destructive/10 text-destructive'
                            : effectiveStatus === 'leave_granted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-muted text-muted-foreground';
                        const label = effectiveStatus === 'violation_only'
                          ? 'Rule Violations'
                          : isSunday
                          ? 'Office Holiday'
                          : effectiveStatus.replace('_', ' ');
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                      {entry.manual_status && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          MANUAL
                        </span>
                      )}
                      {role === 'admin' && entry.status !== 'violation_only' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                            startEditing(entry);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEntry &&
                new Date(selectedEntry.entry_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
            </DialogTitle>
            <DialogDescription>
              Work day details and updates
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4 mt-2">
              {/* Time tracking section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">
                    {selectedEntry.status === 'violation_only' ? 'Rule Violations' : 'Time Tracking'}
                  </h4>
                  {role === 'admin' && selectedEntry.status !== 'violation_only' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(selectedEntry)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      Edit Times
                    </Button>
                  )}
                </div>
                
                {editingEntry && editingEntry.id === selectedEntry.id ? (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="check_in" className="text-sm">Check-in Time</Label>
                        <Input
                          id="check_in"
                          type="time"
                          value={editTimes.check_in}
                          onChange={(e) => setEditTimes(prev => ({ ...prev, check_in: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="check_out" className="text-sm">Check-out Time</Label>
                        <Input
                          id="check_out"
                          type="time"
                          value={editTimes.check_out}
                          onChange={(e) => setEditTimes(prev => ({ ...prev, check_out: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lunch_start" className="text-sm">Lunch Start</Label>
                        <Input
                          id="lunch_start"
                          type="time"
                          value={editTimes.lunch_start}
                          onChange={(e) => setEditTimes(prev => ({ ...prev, lunch_start: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lunch_end" className="text-sm">Lunch End</Label>
                        <Input
                          id="lunch_end"
                          type="time"
                          value={editTimes.lunch_end}
                          onChange={(e) => setEditTimes(prev => ({ ...prev, lunch_end: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Manual Override Fields */}
                    <div className="space-y-4 border-t pt-4">
                      <h5 className="font-medium text-sm text-gray-700">Manual Override</h5>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="manual_status" className="text-sm">Override Status</Label>
                          <Select 
                            value={editOverride.manual_status} 
                            onValueChange={(value) => setEditOverride(prev => ({ ...prev, manual_status: value }))}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select status override" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Override (Use Original Status)</SelectItem>
                              <SelectItem value="present">Present (No Times Required)</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="holiday">Holiday</SelectItem>
                              <SelectItem value="leave_granted">Leave Granted</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="manual_override_reason" className="text-sm">Override Reason</Label>
                          <Input
                            id="manual_override_reason"
                            type="text"
                            value={editOverride.manual_override_reason}
                            onChange={(e) => setEditOverride(prev => ({ ...prev, manual_override_reason: e.target.value }))}
                            placeholder="Enter reason for this override..."
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveTimes}
                        disabled={saving}
                        className="flex items-center gap-1"
                      >
                        <Save className="h-3 w-3" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={saving}
                        className="flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : selectedEntry.status === 'violation_only' ? (
                  <div className="p-4 border rounded-lg bg-red-50 border-red-200">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ This day has rule violations but no attendance record
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Check the Rule Violations section below for details
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Check-in:</span>
                    <p className="font-medium">
                      {selectedEntry.check_in_at
                        ? new Date(selectedEntry.check_in_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Not checked in'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Check-out:</span>
                    <p className="font-medium">
                      {selectedEntry.check_out_at
                        ? new Date(selectedEntry.check_out_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Not checked out'}
                    </p>
                  </div>
                  {selectedEntry.lunch_break_start && selectedEntry.lunch_break_end && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Lunch start:</span>
                        <p className="font-medium">
                          {new Date(selectedEntry.lunch_break_start).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lunch end:</span>
                        <p className="font-medium">
                          {new Date(selectedEntry.lunch_break_end).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lunch duration:</span>
                        <p className="font-medium">
                          {Math.floor(
                            (new Date(selectedEntry.lunch_break_end).getTime() -
                              new Date(selectedEntry.lunch_break_start).getTime()) /
                              60000
                          )}{' '}
                          minutes
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-muted-foreground">Total work time:</span>
                    <p className="font-medium text-success">
                      {selectedEntry.total_work_time_minutes > 0 ? (
                        <>
                          {Math.floor(selectedEntry.total_work_time_minutes / 60)}h{' '}
                          {selectedEntry.total_work_time_minutes % 60}m
                          {selectedEntry.extra_work_logs && selectedEntry.extra_work_logs.length > 0 && (
                            <span className="text-success">
                              {' '}+ {getTotalExtraHours(selectedEntry.extra_work_logs).toFixed(1)}h extra
                            </span>
                          )}
                        </>
                      ) : (
                        'No work time recorded'
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p className="font-medium">
                      {selectedEntry.status === 'completed' ? 'Completed' :
                       selectedEntry.status === 'in_progress' ? 'In Progress' :
                       selectedEntry.status === 'absent' ? 'Absent' :
                       selectedEntry.status === 'holiday' ? 'Holiday' :
                       selectedEntry.status === 'leave_granted' ? 'Leave Granted' :
                       selectedEntry.status === 'violation_only' ? 'Rule Violations Only' :
                       selectedEntry.status.replace('_', ' ')}
                    </p>
                  </div>
                    {selectedEntry.last_modified_by && selectedEntry.modification_reason && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Last modified:</span>
                        <p className="font-medium text-amber-600 text-xs">
                          {selectedEntry.modification_reason} • {selectedEntry.updated_at ? new Date(selectedEntry.updated_at).toLocaleString() : 'Unknown time'}
                      </p>
                    </div>
                  )}
                  {selectedEntry.manual_status && (
                    <div className="col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">Manual Override Applied</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-yellow-700 font-medium">Status:</span>
                          <p className="text-yellow-900 capitalize">{selectedEntry.manual_status}</p>
                        </div>
                        <div>
                          <span className="text-yellow-700 font-medium">Override Date:</span>
                          <p className="text-yellow-900">
                            {selectedEntry.manual_override_at ? new Date(selectedEntry.manual_override_at).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        {selectedEntry.manual_override_reason && (
                          <div className="md:col-span-2">
                            <span className="text-yellow-700 font-medium">Reason:</span>
                            <p className="text-yellow-900">{selectedEntry.manual_override_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* Daily updates section */}
              {selectedEntry.day_updates && selectedEntry.day_updates.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="font-semibold text-sm">Daily Updates</h4>
                  
                  <div>
                    <h5 className="font-semibold mb-1 text-xs">What they worked on:</h5>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                      {selectedEntry.day_updates[0].today_focus}
                    </p>
                  </div>

                  <div>
                    <h5 className="font-semibold mb-1 text-xs">Tasks completed:</h5>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                      {selectedEntry.day_updates[0].progress}
                    </p>
                  </div>

                  {selectedEntry.day_updates[0].blockers && (
                    <div>
                      <h5 className="font-semibold mb-1 text-xs text-destructive">Blockers:</h5>
                      <p className="text-sm text-muted-foreground bg-destructive/5 p-2 rounded-md border border-destructive/20">
                        {selectedEntry.day_updates[0].blockers}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Extra work logs section */}
              {selectedEntry.extra_work_logs && selectedEntry.extra_work_logs.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="font-semibold text-sm">Extra Work Logs</h4>
                  
                  <div className="space-y-2">
                    {selectedEntry.extra_work_logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Home className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{getWorkTypeLabel(log.work_type)}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.hours_worked} hours • {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {log.description && (
                              <p className="text-xs text-muted-foreground mt-1">{log.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium">
                        Total Extra Hours: {getTotalExtraHours(selectedEntry.extra_work_logs).toFixed(1)} hours
                      </p>
                    </div>
                  </div>
                </div>
              )}

c              {/* Rule violations section */}
              {selectedEntry.rule_violations && selectedEntry.rule_violations.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="font-semibold text-sm text-red-600">⚠️ Rule Violations</h4>
                  
                  <div className="space-y-3">
                    {selectedEntry.rule_violations.map((violation) => (
                      <div key={violation.id} className="p-3 border rounded-lg bg-red-50 border-red-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getWarningLevelColor(violation.warning_level)}`}>
                              {getWarningLevelLabel(violation.warning_level)}
                            </span>
                            <span className="text-sm font-medium text-red-800">
                              {violation.office_rules.title}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(violation.flagged_at).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-2">
                          <p><strong>Rule:</strong> {violation.office_rules.description}</p>
                          {violation.reason && (
                            <p><strong>Reason:</strong> {violation.reason}</p>
                          )}
                          <p><strong>Flagged by:</strong> {violation.flagged_by_profile?.name || 'Unknown User'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}


