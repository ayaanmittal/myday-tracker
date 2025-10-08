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
  }, [user, role, roleLoading, navigate]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all employees with today's entry
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, team')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Fetch today's entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('day_entries')
        .select(`
          user_id,
          entry_date,
          check_in_at,
          check_out_at,
          status,
          day_updates (today_focus)
        `)
        .eq('entry_date', today);

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
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <Clock className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.checkedIn}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Not Checked In</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.notCheckedIn}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Activity</CardTitle>
            <CardDescription>Real-time employee status and updates</CardDescription>
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
                        <p className="text-sm text-muted-foreground">{employee.team || 'No team'}</p>
                      </div>
                    </div>
                    {employee.today_focus && (
                      <p className="text-sm text-muted-foreground mt-2 ml-13">
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
                          : 'outline'
                      }
                      className={
                        employee.status === 'completed'
                          ? 'bg-success/10 text-success hover:bg-success/20'
                          : employee.status === 'in_progress'
                          ? 'bg-info/10 text-info hover:bg-info/20'
                          : ''
                      }
                    >
                      {employee.status === 'completed'
                        ? 'Completed'
                        : employee.status === 'in_progress'
                        ? 'Working'
                        : 'Not Started'}
                    </Badge>

                    {employee.check_in_at && (
                      <span className="text-sm text-muted-foreground">
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
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {employees.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
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