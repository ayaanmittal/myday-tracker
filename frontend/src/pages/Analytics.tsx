import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Calendar, Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface AnalyticsData {
  totalDays: number;
  completedDays: number;
  unloggedDays: number;
  avgWorkHours: number;
  weeklyData: Array<{ day: string; hours: number }>;
  statusBreakdown: Array<{ name: string; value: number }>;
  recentUpdates: Array<{
    date: string;
    focus: string;
    progress: string;
    blockers: string | null;
    hours: number;
  }>;
}

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAnalytics();
  }, [user, navigate, selectedPeriod]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      // Calculate date range based on selected period
      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0); // All time
      }

      const { data: entries, error } = await supabase
        .from('unified_attendance')
        .select(`
          id,
          user_id,
          entry_date,
          total_work_time_minutes,
          status,
          manual_status,
          day_updates (
            today_focus,
            progress,
            blockers
          )
        `)
        .eq('user_id', user.id)
        .gte('entry_date', startDate.toISOString().split('T')[0])
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Process data
      const totalDays = entries?.length || 0;
      const completedDays = entries?.filter(e => e.status === 'completed').length || 0;
      const unloggedDays = entries?.filter(e => e.status === 'unlogged').length || 0;
      
      const totalMinutes = entries?.reduce((sum: number, e: any) => sum + (e.total_work_time_minutes || 0), 0) || 0;
      const avgWorkHours = completedDays > 0 ? totalMinutes / completedDays / 60 : 0;

      // Weekly data for chart
      const last7Days = (entries || []).slice(0, 7).reverse().map((e: any) => ({
        day: new Date(e.entry_date).toLocaleDateString('en-US', { weekday: 'short' }),
        hours: (e.total_work_time_minutes || 0) / 60,
      })) || [];

      // Status breakdown
      const statusBreakdown = [
        { name: 'Completed', value: completedDays },
        { name: 'In Progress', value: (entries || []).filter((e: any) => e.status === 'in_progress').length || 0 },
        { name: 'Unlogged', value: unloggedDays },
      ].filter((s: any) => s.value > 0);

      // Recent updates with details
      const recentUpdates = (entries || []).slice(0, 10).map((e: any) => ({
        date: new Date(e.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        focus: e.day_updates?.[0]?.today_focus || 'No update',
        progress: e.day_updates?.[0]?.progress || 'No progress',
        blockers: e.day_updates?.[0]?.blockers || null,
        hours: (e.total_work_time_minutes || 0) / 60,
      })) || [];

      setAnalytics({
        totalDays,
        completedDays,
        unloggedDays,
        avgWorkHours,
        weeklyData: last7Days,
        statusBreakdown,
        recentUpdates,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading analytics...</div>
        </div>
      </Layout>
    );
  }

  if (!analytics) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">No data available</div>
        </div>
      </Layout>
    );
  }

  const COLORS = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Analytics</h1>
            <p className="text-gray-300">Track your progress and patterns</p>
          </div>
          <div className="flex gap-2">
            {(['week', 'month', 'all'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md transition-colors font-medium ${
                  selectedPeriod === period
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Days</CardTitle>
              <Calendar className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalDays}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Days</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{analytics.completedDays}</div>
              <p className="text-xs text-gray-600 mt-1">
                {analytics.totalDays > 0 
                  ? `${Math.round((analytics.completedDays / analytics.totalDays) * 100)}% completion rate`
                  : 'No data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Work Hours</CardTitle>
              <Clock className="h-4 w-4 text-gray-600" />
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
              <div className="text-2xl font-bold text-destructive">{analytics.unloggedDays}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Work Hours (Last 7 Days)</CardTitle>
              <CardDescription>Your work hours over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  hours: {
                    label: "Hours",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
              <CardDescription>Distribution of your day statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  completed: {
                    label: "Completed",
                    color: "hsl(var(--success))",
                  },
                  in_progress: {
                    label: "In Progress",
                    color: "hsl(var(--warning))",
                  },
                  unlogged: {
                    label: "Unlogged",
                    color: "hsl(var(--destructive))",
                  },
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

        {/* Recent Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Work Updates</CardTitle>
            <CardDescription>Your latest daily updates and progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recentUpdates.map((update, index) => (
                <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{update.date}</h4>
                    <span className="text-sm text-gray-600">
                      {update.hours > 0 ? `${update.hours.toFixed(1)}h` : 'No time logged'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Focus: </span>
                      <span className="text-gray-600">{update.focus}</span>
                    </div>
                    <div>
                      <span className="font-medium">Completed: </span>
                      <span className="text-gray-600">{update.progress}</span>
                    </div>
                    {update.blockers && (
                      <div>
                        <span className="font-medium text-destructive">Blockers: </span>
                        <span className="text-gray-600">{update.blockers}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
