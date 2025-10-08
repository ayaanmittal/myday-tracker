import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { Calendar, Clock, MessageSquare, Search, TrendingUp, User, AlertTriangle } from 'lucide-react';
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
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
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
          entry_date,
          check_in_at,
          check_out_at,
          total_work_time_minutes,
          status,
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
                      <Badge
                        variant={
                          entry.status === 'completed'
                            ? 'default'
                            : entry.status === 'in_progress'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={
                          entry.status === 'completed'
                            ? 'bg-success/10 text-success'
                            : entry.status === 'in_progress'
                            ? 'bg-info/10 text-info'
                            : ''
                        }
                      >
                        {entry.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>

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