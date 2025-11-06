import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { DatePicker } from '@/components/DatePicker';
import { AttendanceRefreshButton } from '@/components/AttendanceRefreshButton';

interface EmployeeStats {
  total: number;
  checkedIn: number;
  notCheckedIn: number;
  completed: number;
}

interface EmployeeEntry {
  id: string;
  name: string;
  email: string;
  team: string | null;
  entry_date: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string | null;
  today_focus: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stats, setStats] = useState<EmployeeStats>({ total: 0, checkedIn: 0, notCheckedIn: 0, completed: 0 });
  const [employees, setEmployees] = useState<EmployeeEntry[]>([]);
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
      fetchDashboardData();
    }
  }, [user, role, roleLoading, navigate, selectedDate]);

  const fetchDashboardData = async () => {
    try {
      const targetDate = selectedDate.toISOString().split('T')[0];

      // Fetch all employees with today's entry
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, team')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Fetch entries for selected date from unified_attendance
      const { data: entriesData, error: entriesError } = await supabase
        .from('unified_attendance')
        .select(`
          user_id,
          entry_date,
          check_in_at,
          check_out_at,
          status,
          day_updates (today_focus)
        `)
        .eq('entry_date', targetDate);

      if (entriesError) throw entriesError;

      // Combine data
      const combined = profilesData.map((profile) => {
        const entry = entriesData?.find((e) => e.user_id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          team: profile.team,
          entry_date: entry?.entry_date || null,
          check_in_at: entry?.check_in_at || null,
          check_out_at: entry?.check_out_at || null,
          status: entry?.status || 'not_started',
          today_focus: entry?.day_updates?.[0]?.today_focus || null,
        };
      });

      setEmployees(combined);

      // Calculate stats
      const checkedIn = combined.filter((e) => e.status === 'in_progress').length;
      const completed = combined.filter((e) => e.status === 'completed').length;
      const notCheckedIn = combined.filter((e) => e.status === 'not_started').length;

      setStats({
        total: combined.length,
        checkedIn,
        notCheckedIn,
        completed,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">Dashboard</h1>
            <p className="text-gray-300 text-base sm:text-lg font-medium">Employee activity and attendance</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <DatePicker
              date={selectedDate}
              onDateChange={(date) => date && setSelectedDate(date)}
            />
            <AttendanceRefreshButton />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="elegant-card elegant-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Total Employees</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="elegant-card elegant-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Checked In</CardTitle>
              <Clock className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats.checkedIn}</div>
            </CardContent>
          </Card>

          <Card className="elegant-card elegant-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Not Checked In</CardTitle>
              <AlertCircle className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats.notCheckedIn}</div>
            </CardContent>
          </Card>

          <Card className="elegant-card elegant-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">Completed</CardTitle>
              <CheckCircle className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate.toDateString() === new Date().toDateString()
                ? "Today's Activity"
                : `Activity for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </CardTitle>
            <CardDescription>Employee status and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {employee.name.split(' ').map((n) => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-sm text-gray-600">{employee.team || 'No team'}</p>
                      </div>
                    </div>
                    {employee.today_focus && (
                      <p className="text-sm text-gray-600 mt-2 ml-13">
                        {employee.today_focus.substring(0, 100)}
                        {employee.today_focus.length > 100 && '...'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        employee.status === 'completed'
                          ? 'default'
                          : employee.status === 'in_progress'
                          ? 'secondary'
                          : employee.status === 'unlogged'
                          ? 'destructive'
                          : 'outline'
                      }
                      className={
                        employee.status === 'completed'
                          ? 'bg-green-100 text-green-800 border-0 hover:bg-green-200'
                          : employee.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 border-0 hover:bg-blue-200'
                          : employee.status === 'unlogged'
                          ? 'bg-red-100 text-red-800 border-0 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-800 border-0 hover:bg-gray-200'
                      }
                    >
                      {employee.status === 'completed'
                        ? 'Completed'
                        : employee.status === 'in_progress'
                        ? 'Working'
                        : employee.status === 'unlogged'
                        ? 'Unlogged'
                        : 'Not Started'}
                    </Badge>

                    {employee.check_in_at && (
                      <span className="text-sm text-gray-600">
                        {new Date(employee.check_in_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/messages?to=${employee.id}`)}
                      className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <MessageSquare className="h-4 w-4 text-gray-700" />
                    </Button>
                  </div>
                </div>
              ))}

              {employees.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  No employees found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}