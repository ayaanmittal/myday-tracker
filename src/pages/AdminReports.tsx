import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Users, TrendingUp, Clock, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AdminAnalytics {
  totalEmployees: number;
  activeEmployees: number;
  avgCompletionRate: number;
  avgWorkHours: number;
  totalUnloggedDays: number;
  weeklyTrend: Array<{ date: string; completed: number; unlogged: number }>;
  teamPerformance: Array<{ team: string; completionRate: number; avgHours: number }>;
  topPerformers: Array<{ name: string; completionRate: number; avgHours: number }>;
  recentActivity: Array<{
    employeeName: string;
    date: string;
    status: string;
    hours: number;
    focus: string;
  }>;
  statusBreakdown: Array<{ name: string; value: number }>;
  employeeDetails: Array<{
    id: string;
    name: string;
    email: string;
    team: string;
    totalDays: number;
    completedDays: number;
    unloggedDays: number;
    avgHours: number;
    lastActivity: string;
  }>;
}

export default function AdminReports() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

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
      fetchAdminAnalytics();
    }
  }, [user, role, roleLoading, navigate, selectedPeriod]);

  const fetchAdminAnalytics = async () => {
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const totalEmployees = profiles?.length || 0;
      const activeEmployees = profiles?.filter(p => p.is_active).length || 0;

      // Fetch all day entries for the period
      const { data: entries, error: entriesError } = await supabase
        .from('day_entries')
        .select(`
          *,
          day_updates (
            today_focus,
            progress,
            blockers
          )
        `)
        .gte('entry_date', startDate.toISOString().split('T')[0])
        .order('entry_date', { ascending: false });

      if (entriesError) throw entriesError;

      // Calculate overall metrics
      const completedDays = entries?.filter(e => e.status === 'completed').length || 0;
      const totalDays = entries?.length || 0;
      const avgCompletionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
      
      const totalMinutes = entries?.reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0) || 0;
      const avgWorkHours = completedDays > 0 ? totalMinutes / completedDays / 60 : 0;
      
      const totalUnloggedDays = entries?.filter(e => e.status === 'unlogged').length || 0;

      // Weekly trend (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const weeklyTrend = last7Days.map(date => {
        const dayEntries = entries?.filter(e => e.entry_date === date) || [];
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          completed: dayEntries.filter(e => e.status === 'completed').length,
          unlogged: dayEntries.filter(e => e.status === 'unlogged').length,
        };
      });

      // Team performance
      const teams = [...new Set(profiles?.map(p => p.team).filter(Boolean))];
      const teamPerformance = teams.map(team => {
        const teamProfiles = profiles?.filter(p => p.team === team) || [];
        const teamEntries = entries?.filter(e => 
          teamProfiles.some(p => p.id === e.user_id)
        ) || [];
        
        const teamCompleted = teamEntries.filter(e => e.status === 'completed').length;
        const teamTotal = teamEntries.length;
        const teamMinutes = teamEntries.reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0);
        
        return {
          team: team || 'No Team',
          completionRate: teamTotal > 0 ? (teamCompleted / teamTotal) * 100 : 0,
          avgHours: teamCompleted > 0 ? teamMinutes / teamCompleted / 60 : 0,
        };
      });

      // Top performers
      const employeeStats = profiles?.map(profile => {
        const userEntries = entries?.filter(e => e.user_id === profile.id) || [];
        const completed = userEntries.filter(e => e.status === 'completed').length;
        const total = userEntries.length;
        const minutes = userEntries.reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0);
        
        return {
          name: profile.name,
          completionRate: total > 0 ? (completed / total) * 100 : 0,
          avgHours: completed > 0 ? minutes / completed / 60 : 0,
        };
      }) || [];

      const topPerformers = employeeStats
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);

      // Recent activity
      const recentActivity = entries?.slice(0, 20).map(e => {
        const employee = profiles?.find(p => p.id === e.user_id);
        return {
          employeeName: employee?.name || 'Unknown',
          date: new Date(e.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          status: e.status,
          hours: (e.total_work_time_minutes || 0) / 60,
          focus: e.day_updates?.[0]?.today_focus || 'No update',
        };
      }) || [];

      // Status breakdown
      const statusBreakdown = [
        { name: 'Completed', value: entries?.filter(e => e.status === 'completed').length || 0 },
        { name: 'In Progress', value: entries?.filter(e => e.status === 'in_progress').length || 0 },
        { name: 'Unlogged', value: totalUnloggedDays },
        { name: 'Not Started', value: entries?.filter(e => e.status === 'not_started').length || 0 },
      ].filter(s => s.value > 0);

      // Employee details
      const employeeDetails = profiles?.map(profile => {
        const userEntries = entries?.filter(e => e.user_id === profile.id) || [];
        const completed = userEntries.filter(e => e.status === 'completed').length;
        const unlogged = userEntries.filter(e => e.status === 'unlogged').length;
        const total = userEntries.length;
        const minutes = userEntries.reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0);
        const lastEntry = userEntries[0];
        
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          team: profile.team || 'No Team',
          totalDays: total,
          completedDays: completed,
          unloggedDays: unlogged,
          avgHours: completed > 0 ? minutes / completed / 60 : 0,
          lastActivity: lastEntry ? new Date(lastEntry.entry_date).toLocaleDateString() : 'No activity',
        };
      }) || [];

      setAnalytics({
        totalEmployees,
        activeEmployees,
        avgCompletionRate,
        avgWorkHours,
        totalUnloggedDays,
        weeklyTrend,
        teamPerformance,
        topPerformers,
        recentActivity,
        statusBreakdown,
        employeeDetails,
      });
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading reports...</div>
        </div>
      </Layout>
    );
  }

  if (!analytics) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">No data available</div>
        </div>
      </Layout>
    );
  }

  const COLORS = [
    'hsl(var(--success))',
    'hsl(var(--warning))',
    'hsl(var(--destructive))',
    'hsl(var(--muted))',
  ];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
            <p className="text-muted-foreground">Comprehensive workforce insights and performance metrics</p>
          </div>
          <div className="flex gap-2">
            {(['week', 'month', 'quarter'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedPeriod === period
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalEmployees}</div>
              <p className="text-xs text-success mt-1">
                {analytics.activeEmployees} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {analytics.avgCompletionRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Work Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.avgWorkHours.toFixed(1)}h
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unlogged Days</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {analytics.totalUnloggedDays}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="employees">Employee Details</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Trend</CardTitle>
                  <CardDescription>Completed vs Unlogged days over the last week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      completed: { label: "Completed", color: "hsl(var(--success))" },
                      unlogged: { label: "Unlogged", color: "hsl(var(--destructive))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.weeklyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="completed" stroke="hsl(var(--success))" strokeWidth={2} />
                        <Line type="monotone" dataKey="unlogged" stroke="hsl(var(--destructive))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Overall day entry status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      completed: { label: "Completed", color: "hsl(var(--success))" },
                      in_progress: { label: "In Progress", color: "hsl(var(--warning))" },
                      unlogged: { label: "Unlogged", color: "hsl(var(--destructive))" },
                      not_started: { label: "Not Started", color: "hsl(var(--muted))" },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.statusBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analytics.statusBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
                <CardDescription>Completion rates and average hours by team</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    completionRate: { label: "Completion Rate (%)", color: "hsl(var(--primary))" },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.teamPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="team" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="completionRate" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Employees with highest completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topPerformers.map((performer, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{performer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Avg: {performer.avgHours.toFixed(1)}h/day
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-success/10 text-success border-success">
                        {performer.completionRate.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Employee Performance Details</CardTitle>
                <CardDescription>Comprehensive breakdown of each employee's activity</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Total Days</TableHead>
                      <TableHead className="text-center">Completed</TableHead>
                      <TableHead className="text-center">Unlogged</TableHead>
                      <TableHead className="text-center">Avg Hours</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.employeeDetails.map((employee) => {
                      const completionRate = employee.totalDays > 0 
                        ? (employee.completedDays / employee.totalDays) * 100 
                        : 0;
                      
                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{employee.name}</p>
                              <p className="text-sm text-muted-foreground">{employee.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{employee.team}</TableCell>
                          <TableCell className="text-center">{employee.totalDays}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-medium">{employee.completedDays}</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  completionRate >= 80 
                                    ? 'bg-success/10 text-success border-success' 
                                    : completionRate >= 50 
                                    ? 'bg-warning/10 text-warning border-warning'
                                    : 'bg-destructive/10 text-destructive border-destructive'
                                }`}
                              >
                                {completionRate.toFixed(0)}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={employee.unloggedDays > 0 
                                ? 'bg-destructive/10 text-destructive border-destructive' 
                                : 'bg-muted/10 text-muted-foreground border-muted'}
                            >
                              {employee.unloggedDays}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {employee.avgHours > 0 ? `${employee.avgHours.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {employee.lastActivity}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity Feed</CardTitle>
                <CardDescription>Latest employee check-ins and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="mt-1">
                        {activity.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : activity.status === 'unlogged' ? (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Clock className="h-5 w-5 text-warning" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium">{activity.employeeName}</p>
                          <span className="text-sm text-muted-foreground">{activity.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{activity.focus}</p>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              activity.status === 'completed'
                                ? 'bg-success/10 text-success'
                                : activity.status === 'in_progress'
                                ? 'bg-warning/10 text-warning'
                                : activity.status === 'unlogged'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted/10 text-muted-foreground'
                            }
                          >
                            {activity.status.replace('_', ' ')}
                          </Badge>
                          {activity.hours > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {activity.hours.toFixed(1)}h worked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
