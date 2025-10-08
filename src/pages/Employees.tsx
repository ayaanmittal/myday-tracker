import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { Calendar, Clock, MessageSquare, Search, TrendingUp, User, AlertTriangle, Edit, Save, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/DatePicker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Employee {
  id: string;
  name: string;
  email: string;
  team: string | null;
  is_active: boolean;
  role: string;
  violation_count?: number;
}

interface Violation {
  id: string;
  rule_id: string;
  warning_level: number;
  reason: string | null;
  flagged_at: string;
  office_rules: {
    title: string;
  };
}

interface EmployeeHistory {
  id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  total_work_time_minutes: number | null;
  status: string;
  last_modified_by: string | null;
  modification_reason: string | null;
  updated_at: string | null;
  today_focus: string | null;
  progress: string | null;
  blockers: string | null;
}

export default function Employees() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<EmployeeHistory[]>([]);
  const [employeeViolations, setEmployeeViolations] = useState<Violation[]>([]);
  const [showViolations, setShowViolations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<EmployeeHistory | null>(null);
  const [editTimes, setEditTimes] = useState({
    check_in: '',
    check_out: '',
    lunch_start: '',
    lunch_end: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'admin') {
      navigate('/today');
      return;
    }

    if (role === 'admin') {
      fetchEmployees();
    }
  }, [user, role, roleLoading, navigate]);

  const fetchEmployees = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) throw profilesError;

      // Fetch roles for each employee
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Fetch violation counts for each employee
      const { data: violationsData } = await supabase
        .from('rule_violations')
        .select('user_id');

      const violationCounts = violationsData?.reduce((acc, v) => {
        acc[v.user_id] = (acc[v.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const employeesWithRoles = profilesData?.map((profile) => ({
        ...profile,
        role: rolesData?.find((r) => r.user_id === profile.id)?.role || 'employee',
        violation_count: violationCounts?.[profile.id] || 0,
      }));

      setEmployees(employeesWithRoles || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeHistory = async (employeeId: string) => {
    try {
      // Get entries around the selected date (15 days before and after)
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 15);
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 15);

      const { data, error } = await supabase
        .from('day_entries')
        .select(`
          id,
          entry_date,
          check_in_at,
          check_out_at,
          lunch_break_start,
          lunch_break_end,
          total_work_time_minutes,
          status,
          last_modified_by,
          modification_reason,
          updated_at,
          day_updates (
            today_focus,
            progress,
            blockers
          )
        `)
        .eq('user_id', employeeId)
        .gte('entry_date', startDate.toISOString().split('T')[0])
        .lte('entry_date', endDate.toISOString().split('T')[0])
        .order('entry_date', { ascending: false });

      if (error) throw error;

      const formatted = data?.map((entry) => ({
        ...entry,
        today_focus: entry.day_updates?.[0]?.today_focus || null,
        progress: entry.day_updates?.[0]?.progress || null,
        blockers: entry.day_updates?.[0]?.blockers || null,
      }));

      setEmployeeHistory(formatted || []);
    } catch (error) {
      console.error('Error fetching employee history:', error);
    }
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViolations(false);
    fetchEmployeeHistory(employee.id);
  };

  const handleViewViolations = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViolations(true);
    
    try {
      const { data, error } = await supabase
        .from('rule_violations')
        .select('id, rule_id, warning_level, reason, flagged_at, office_rules(title)')
        .eq('user_id', employee.id)
        .order('flagged_at', { ascending: false });

      if (error) throw error;
      setEmployeeViolations(data as Violation[]);
    } catch (error) {
      console.error('Error fetching violations:', error);
    }
  };

  const getWarningColor = (level: number) => {
    if (level === 1) return "bg-yellow-500 hover:bg-yellow-600";
    if (level === 2) return "bg-orange-500 hover:bg-orange-600";
    return "bg-red-500 hover:bg-red-600";
  };

  const startEditing = (entry: EmployeeHistory) => {
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

      // Update the day entry with proper error handling
      const { data, error } = await supabase
        .from('day_entries')
        .update({
          check_in_at: checkInDateTime,
          check_out_at: checkOutDateTime,
          lunch_break_start: lunchStartDateTime,
          lunch_break_end: lunchEndDateTime,
          total_work_time_minutes: newTotalMinutes > 0 ? Math.round(newTotalMinutes) : null,
          updated_at: new Date().toISOString(),
          last_modified_by: user.id,
          modification_reason: 'Admin time correction'
        })
        .eq('id', editingEntry.id)
        .select();

      if (error) throw error;

      toast({
        title: 'Times Updated',
        description: `Employee times have been successfully updated. Changes logged for audit trail.`,
      });

      // Refresh the employee history
      if (selectedEmployee) {
        fetchEmployeeHistory(selectedEmployee.id);
      }
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

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (roleLoading || loading) {
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">Manage and monitor employee activity</p>
          </div>
          <DatePicker
            date={selectedDate}
            onDateChange={(date) => date && setSelectedDate(date)}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Employees</CardTitle>
                <CardDescription>View detailed attendance and work history</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.team || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={employee.is_active ? 'default' : 'secondary'}
                        className={
                          employee.is_active
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : ''
                        }
                      >
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {employee.violation_count && employee.violation_count > 0 ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => handleViewViolations(employee)}
                        >
                          <AlertTriangle className="h-4 w-4" />
                          {employee.violation_count} Flag{employee.violation_count !== 1 ? 's' : ''}
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewEmployee(employee)}
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        View History
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/messages?to=${employee.id}`)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredEmployees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No employees found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedEmployee && !showViolations} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedEmployee?.name} - Work History
            </DialogTitle>
            <DialogDescription>{selectedEmployee?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {employeeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No work history available
              </div>
            ) : (
              employeeHistory.map((entry) => (
                <Card key={entry.entry_date} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(entry.entry_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {entry.check_in_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              In: {new Date(entry.check_in_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {entry.check_out_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Out: {new Date(entry.check_out_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {entry.total_work_time_minutes && (
                            <span className="font-medium">
                              Total: {Math.floor(entry.total_work_time_minutes / 60)}h{' '}
                              {entry.total_work_time_minutes % 60}m
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(entry)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit Times
                        </Button>
                        <Badge
                          variant={
                            entry.status === 'completed'
                              ? 'default'
                              : entry.status === 'in_progress'
                              ? 'secondary'
                              : entry.status === 'unlogged'
                              ? 'destructive'
                              : 'outline'
                          }
                          className={
                            entry.status === 'completed'
                              ? 'bg-success/10 text-success'
                              : entry.status === 'in_progress'
                              ? 'bg-info/10 text-info'
                              : entry.status === 'unlogged'
                              ? 'bg-destructive/10 text-destructive'
                              : ''
                          }
                        >
                          {entry.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {editingEntry && editingEntry.id === entry.id ? (
                    <CardContent className="space-y-4 p-4 border rounded-lg bg-muted/50">
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
                    </CardContent>
                  ) : (
                    <>
                      {(entry.today_focus || entry.progress || entry.blockers) && (
                        <CardContent className="space-y-3">
                          {entry.today_focus && (
                            <div>
                              <p className="text-sm font-semibold mb-1">Focus:</p>
                              <p className="text-sm text-muted-foreground">{entry.today_focus}</p>
                            </div>
                          )}
                          {entry.progress && (
                            <div>
                              <p className="text-sm font-semibold mb-1">Progress:</p>
                              <p className="text-sm text-muted-foreground">{entry.progress}</p>
                            </div>
                          )}
                          {entry.blockers && (
                            <div>
                              <p className="text-sm font-semibold mb-1 text-warning">Blockers:</p>
                              <p className="text-sm text-muted-foreground">{entry.blockers}</p>
                            </div>
                          )}
                        </CardContent>
                      )}
                      {entry.last_modified_by && entry.modification_reason && (
                        <CardContent className="pt-0">
                          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                            <strong>Last modified:</strong> {entry.modification_reason} • {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : 'Unknown time'}
                          </div>
                        </CardContent>
                      )}
                    </>
                  )}
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEmployee && showViolations} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              {selectedEmployee?.name} - Rule Violations
            </DialogTitle>
            <DialogDescription>{selectedEmployee?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {employeeViolations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No violations found
              </div>
            ) : (
              employeeViolations.map((violation) => (
                <Card key={violation.id} className="border-destructive">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {violation.office_rules.title}
                      </CardTitle>
                      <Badge className={getWarningColor(violation.warning_level)}>
                        {violation.warning_level === 1 ? "1st Warning" : 
                         violation.warning_level === 2 ? "2nd Warning" : "3rd Warning"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {violation.reason && (
                      <div>
                        <p className="text-sm font-semibold mb-1">Reason:</p>
                        <p className="text-sm text-muted-foreground">{violation.reason}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Flagged on {new Date(violation.flagged_at).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span>
                        {new Date(violation.flagged_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}