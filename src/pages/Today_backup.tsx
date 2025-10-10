import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Clock, CheckCircle, Plus, Home, Trash2, Calendar, Users, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { AttendanceLogs } from '@/components/AttendanceLogs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DayEntry {
  id: string;
  user_id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  total_work_time_minutes: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DayUpdate {
  today_focus: string;
  progress: string;
  blockers: string;
}

interface ExtraWorkLog {
  id: string;
  work_type: string;
  hours_worked: number;
  description: string | null;
  logged_at: string;
}

export default function Today() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const [entry, setEntry] = useState<DayEntry | null>(null);
  const [update, setUpdate] = useState<DayUpdate>({ today_focus: '', progress: '', blockers: '' });
  const [extraWorkLogs, setExtraWorkLogs] = useState<ExtraWorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkInSource, setCheckInSource] = useState<string>('');
  const [checkOutSource, setCheckOutSource] = useState<string>('');
  const [extraWorkForm, setExtraWorkForm] = useState({
    work_type: 'remote',
    hours_worked: '',
    description: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // For admin role, fetch their own work data AND show team management
    if (!roleLoading && role === 'admin') {
      fetchTodayEntry();
      return;
    }

    // For manager role, fetch their own work data AND show team management
    if (!roleLoading && role === 'manager') {
    fetchTodayEntry();
      return;
    }

    // For regular users, fetch their today entry
    if (!roleLoading && role === 'employee') {
    fetchTodayEntry();
    }
  }, [user, role, roleLoading, navigate]);

  const fetchTodayEntry = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: entryData, error: entryError } = await supabase
        .from('day_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_date', today)
        .maybeSingle();

      if (entryError) throw entryError;

      if (entryData) {
        setEntry(entryData);

        const { data: updateData } = await supabase
          .from('day_updates')
          .select('*')
          .eq('day_entry_id', entryData.id)
          .maybeSingle();

        if (updateData) {
          setUpdate({
            today_focus: updateData.today_focus || '',
            progress: updateData.progress || '',
            blockers: updateData.blockers || '',
          });
        }

        // Fetch extra work logs for this day
        const { data: extraWorkData } = await supabase
          .from('extra_work_logs')
          .select('*')
          .eq('day_entry_id', entryData.id)
          .order('logged_at', { ascending: false });

        setExtraWorkLogs(extraWorkData || []);
        
        // Fetch check-in/out sources
        if (entryData.check_in_at) {
          const source = await getCheckInOutSource(entryData.check_in_at, 'checkin');
          setCheckInSource(source);
        }
        if (entryData.check_out_at) {
          const source = await getCheckInOutSource(entryData.check_out_at, 'checkout');
          setCheckOutSource(source);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingPage(false);
    }
  };

  // Function to determine if check-in/out was manual or biometric
  const getCheckInOutSource = async (timestamp: string, type: 'checkin' | 'checkout') => {
    if (!user) return 'Manual';

    try {
      // Check if there's a corresponding attendance log for this timestamp
      const logTime = new Date(timestamp);
      const startTime = new Date(logTime.getTime() - 60000); // 1 minute before
      const endTime = new Date(logTime.getTime() + 60000); // 1 minute after

      // Note: attendance_logs table might not be in Supabase types yet
      // This is a fallback approach - in production, you'd want to add the table to your types
      try {
        const { data: attendanceLogs } = await supabase
          .from('attendance_logs' as any)
          .select('source, log_type')
          .eq('employee_id', user.id)
          .eq('log_type', type)
          .gte('log_time', startTime.toISOString())
          .lte('log_time', endTime.toISOString())
          .limit(1);

        if (attendanceLogs && attendanceLogs.length > 0) {
          return (attendanceLogs[0] as any).source === 'teamoffice' ? 'Biometric' : 'Manual';
        }
      } catch (error) {
        // If table doesn't exist or has issues, default to Manual
        console.log('Attendance logs table not accessible:', error);
      }

      // If no attendance log found, it's likely manual
      return 'Manual';
    } catch (error) {
      console.error('Error checking attendance source:', error);
      return 'Manual';
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('day_entries')
        .insert({
          user_id: user.id,
          entry_date: new Date().toISOString().split('T')[0],
          check_in_at: now,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;

      setEntry(data);
      toast({
        title: 'Day started!',
        description: 'Your check-in has been recorded.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!entry) return;
    setLoading(true);

    try {
      const checkOutTime = new Date();
      const checkInTime = new Date(entry.check_in_at!);
      let minutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

      // Subtract lunch break time if both start and end are recorded
      if (entry.lunch_break_start && entry.lunch_break_end) {
        const lunchStart = new Date(entry.lunch_break_start);
        const lunchEnd = new Date(entry.lunch_break_end);
        const lunchMinutes = Math.floor((lunchEnd.getTime() - lunchStart.getTime()) / 60000);
        minutes -= lunchMinutes;
      }

      const { error } = await supabase
        .from('day_entries')
        .update({
          check_out_at: checkOutTime.toISOString(),
          total_work_time_minutes: minutes,
          status: 'completed',
          updated_at: checkOutTime.toISOString(),
        })
        .eq('id', entry.id);

      if (error) throw error;

      setEntry({ ...entry, check_out_at: checkOutTime.toISOString(), total_work_time_minutes: minutes, status: 'completed' });
      toast({
        title: 'Day completed!',
        description: `You worked for ${Math.floor(minutes / 60)}h ${minutes % 60}m today.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLunchBreakStart = async () => {
    if (!entry) return;
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('day_entries')
        .update({
          lunch_break_start: now,
          updated_at: now,
        })
        .eq('id', entry.id);

      if (error) throw error;

      setEntry({ ...entry, lunch_break_start: now });
      toast({
        title: 'Lunch break started',
        description: 'Enjoy your lunch break!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLunchBreakEnd = async () => {
    if (!entry) return;
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('day_entries')
        .update({
          lunch_break_end: now,
          updated_at: now,
        })
        .eq('id', entry.id);

      if (error) throw error;

      setEntry({ ...entry, lunch_break_end: now });
      toast({
        title: 'Lunch break ended',
        description: 'Welcome back!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpdate = async () => {
    if (!entry || !update.today_focus || !update.progress) return;
    setLoading(true);

    try {
      const updateData = {
        today_focus: update.today_focus,
        progress: update.progress,
        blockers: update.blockers,
      };

      const { data: existingUpdate } = await supabase
        .from('day_updates')
        .select('id')
        .eq('day_entry_id', entry.id)
        .maybeSingle();

      if (existingUpdate) {
        const { error } = await supabase
          .from('day_updates')
          .update(updateData)
          .eq('id', existingUpdate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('day_updates')
          .insert({
            day_entry_id: entry.id,
            ...updateData,
          });

        if (error) throw error;
      }

      toast({
        title: 'Update saved!',
        description: 'Your daily update has been recorded.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddExtraWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry || !user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('extra_work_logs')
        .insert({
          day_entry_id: entry.id,
          user_id: user.id,
          work_type: extraWorkForm.work_type,
          hours_worked: parseFloat(extraWorkForm.hours_worked),
          description: extraWorkForm.description || null,
          logged_at: new Date().toISOString(),
        });

      if (error) throw error;

      setExtraWorkForm({ work_type: 'remote', hours_worked: '', description: '' });
      setDialogOpen(false);
      fetchTodayEntry();
      toast({
        title: 'Extra work logged!',
        description: 'Your additional hours have been recorded.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExtraWork = async (logId: string) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('extra_work_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      fetchTodayEntry();
      toast({
        title: 'Work log deleted',
        description: 'The extra work log has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      remote: 'Remote Work',
      overtime: 'Overtime',
      weekend: 'Weekend Work',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getTotalExtraHours = () => {
    return extraWorkLogs.reduce((total, log) => total + log.hours_worked, 0);
  };

  if (loadingPage) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  // For admin role, show admin dashboard with personal work tracking
  if (role === 'admin') {
  return (
    <Layout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
              Admin Dashboard
            </h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">
              Personal Work Tracking & Team Management
          </p>
        </div>

          {/* Admin's Personal Work Section */}
          <Card className="elegant-card border-2 border-primary/20 elegant-shadow-lg">
            <CardHeader>
              <CardTitle className="font-heading text-xl font-bold flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Work Today
              </CardTitle>
              <CardDescription>
                Track your own work hours, tasks, and daily updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!entry ? (
                <div className="text-center py-8">
              <div className="flex justify-center mb-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-10 w-10 text-primary" />
                </div>
              </div>
                  <h3 className="text-lg font-semibold mb-2">Ready to start your day?</h3>
                  <p className="text-muted-foreground mb-6">
                    Begin your workday by checking in and setting your focus for today.
                  </p>
                  <Button onClick={handleCheckIn} className="w-full sm:w-auto">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Check In
              </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Work Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {entry.check_in_at ? new Date(entry.check_in_at).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : 'Not started'}
                      </div>
                      <div className="text-sm text-muted-foreground">Check In</div>
                      {entry.check_in_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {checkInSource || 'Manual'}
                        </div>
                      )}
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {entry.check_out_at ? new Date(entry.check_out_at).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : 'Still working'}
                      </div>
                      <div className="text-sm text-muted-foreground">Check Out</div>
                      {entry.check_out_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {checkOutSource || 'Manual'}
                        </div>
                      )}
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {entry.total_work_time_minutes ? 
                          `${Math.floor(entry.total_work_time_minutes / 60)}h ${entry.total_work_time_minutes % 60}m` : 
                          '0h 0m'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">Total Time</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {!entry.check_in_at && (
                      <Button onClick={handleCheckIn}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Check In
                  </Button>
                )}
                    {entry.check_in_at && !entry.check_out_at && (
                      <Button onClick={handleCheckOut} variant="outline">
                        <Clock className="mr-2 h-4 w-4" />
                        Check Out
                  </Button>
                )}
                    {entry.check_in_at && !entry.check_out_at && (
                      <Button onClick={entry.lunch_break_start && !entry.lunch_break_end ? handleLunchBreakEnd : handleLunchBreakStart} variant="outline">
                        <Clock className="mr-2 h-4 w-4" />
                        {entry.lunch_break_start && !entry.lunch_break_end ? 'End Lunch' : 'Start Lunch'}
                  </Button>
                )}

                  {/* Daily Updates Form */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold mb-4">Daily Updates</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="admin-today-focus">Today's Focus</Label>
                  <Textarea
                          id="admin-today-focus"
                          placeholder="What are you focusing on today?"
                    value={update.today_focus}
                    onChange={(e) => setUpdate({ ...update, today_focus: e.target.value })}
                          className="mt-1"
                  />
                </div>
                      <div>
                        <Label htmlFor="admin-progress">Progress</Label>
                  <Textarea
                          id="admin-progress"
                          placeholder="What progress have you made?"
                    value={update.progress}
                    onChange={(e) => setUpdate({ ...update, progress: e.target.value })}
                          className="mt-1"
                  />
                </div>
                      <div>
                        <Label htmlFor="admin-blockers">Blockers</Label>
                  <Textarea
                          id="admin-blockers"
                          placeholder="Any blockers or challenges?"
                    value={update.blockers}
                    onChange={(e) => setUpdate({ ...update, blockers: e.target.value })}
                          className="mt-1"
                  />
                </div>
                      <Button 
                        onClick={handleSaveUpdate} 
                        disabled={loading || !update.today_focus || !update.progress}
                        className="w-full"
                      >
                  {loading ? 'Saving...' : 'Save Update'}
                </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Team Management Section */}
          <Card className="elegant-card border-2 border-primary/20 elegant-shadow-lg">
              <CardHeader>
              <CardTitle className="font-heading text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Attendance
              </CardTitle>
                <CardDescription>
                Monitor your team's attendance and activity
                </CardDescription>
              </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="admin-date-selector">Date</Label>
                    <Input
                      id="admin-date-selector"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                    >
                      Today
                </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setSelectedDate(yesterday.toISOString().split('T')[0]);
                      }}
                    >
                      Yesterday
                    </Button>
                </div>
                </div>
                <AttendanceLogs 
                  key={`admin-${selectedDate}`}
                  startDate={selectedDate}
                  endDate={selectedDate}
                  showAllEmployees={true}
                />
                </div>
              </CardContent>
            </Card>
            </div>
      </Layout>
    );
  }

  // For manager role, show hybrid dashboard with both admin and employee features
  if (role === 'manager') {
    return (
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
              Manager Dashboard
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg font-medium">
              Team Management & Personal Work Tracking
            </p>
          </div>

          {/* Manager's Personal Work Section */}
          <Card className="elegant-card border-2 border-primary/20 elegant-shadow-lg">
            <CardHeader>
              <CardTitle className="font-heading text-xl font-bold flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Work Today
              </CardTitle>
              <CardDescription>
                Track your own work hours, tasks, and daily updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!entry ? (
                <div className="text-center py-8">
                  <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Ready to start your day?</h3>
                  <p className="text-muted-foreground mb-6">
                    Begin your workday by checking in and setting your focus for today.
                  </p>
                  <Button onClick={handleCheckIn} className="w-full sm:w-auto">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Check In
              </Button>
            </div>
              ) : (
                <div className="space-y-6">
                  {/* Work Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {entry.check_in_at ? new Date(entry.check_in_at).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : 'Not started'}
                      </div>
                      <div className="text-sm text-muted-foreground">Check In</div>
                      {entry.check_in_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {checkInSource || 'Manual'}
          </div>
        )}
                </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {entry.check_out_at ? new Date(entry.check_out_at).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : 'Still working'}
              </div>
                      <div className="text-sm text-muted-foreground">Check Out</div>
                      {entry.check_out_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {checkOutSource || 'Manual'}
                        </div>
                            )}
                          </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {entry.total_work_time_minutes ? 
                          `${Math.floor(entry.total_work_time_minutes / 60)}h ${entry.total_work_time_minutes % 60}m` : 
                          '0h 0m'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">Total Time</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {!entry.check_in_at && (
                      <Button onClick={handleCheckIn}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Check In
              </Button>
                    )}
                    {entry.check_in_at && !entry.check_out_at && (
                      <Button onClick={handleCheckOut} variant="outline">
                        <Clock className="mr-2 h-4 w-4" />
                        Check Out
                      </Button>
                    )}
                    {entry.check_in_at && !entry.check_out_at && (
                      <Button onClick={entry.lunch_break_start && !entry.lunch_break_end ? handleLunchBreakEnd : handleLunchBreakStart} variant="outline">
                        <Clock className="mr-2 h-4 w-4" />
                        {entry.lunch_break_start && !entry.lunch_break_end ? 'End Lunch' : 'Start Lunch'}
                      </Button>
                    )}

                  {/* Daily Updates Form */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold mb-4">Daily Updates</h4>
                    <div className="space-y-4">
                  <div>
                        <Label htmlFor="manager-today-focus">Today's Focus</Label>
                        <Textarea
                          id="manager-today-focus"
                          placeholder="What are you focusing on today?"
                          value={update.today_focus}
                          onChange={(e) => setUpdate({ ...update, today_focus: e.target.value })}
                          className="mt-1"
                        />
                  </div>
                      <div>
                        <Label htmlFor="manager-progress">Progress</Label>
                        <Textarea
                          id="manager-progress"
                          placeholder="What progress have you made?"
                          value={update.progress}
                          onChange={(e) => setUpdate({ ...update, progress: e.target.value })}
                          className="mt-1"
                          />
                        </div>
                      <div>
                        <Label htmlFor="manager-blockers">Blockers</Label>
                          <Textarea
                          id="manager-blockers"
                          placeholder="Any blockers or challenges?"
                          value={update.blockers}
                          onChange={(e) => setUpdate({ ...update, blockers: e.target.value })}
                          className="mt-1"
                          />
                        </div>
                          <Button
                        onClick={handleSaveUpdate} 
                        disabled={loading || !update.today_focus || !update.progress}
                        className="w-full"
                      >
                        {loading ? 'Saving...' : 'Save Update'}
                          </Button>
                        </div>
                </div>
                )}
              </CardContent>
            </Card>

          {/* Team Management Section */}
          <Card className="elegant-card border-2 border-primary/20 elegant-shadow-lg">
            <CardHeader>
              <CardTitle className="font-heading text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Attendance
              </CardTitle>
              <CardDescription>
                Monitor your team's attendance and activity
              </CardDescription>
              </CardHeader>
              <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="team-date-selector">Date</Label>
                    <Input
                      id="team-date-selector"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="mt-1"
                    />
                          </div>
                  <div className="flex gap-2">
                        <Button
                      variant="outline"
                          size="sm"
                      onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setSelectedDate(yesterday.toISOString().split('T')[0]);
                      }}
                    >
                      Yesterday
                        </Button>
                      </div>
                    </div>
                <AttendanceLogs 
                  key={`manager-${selectedDate}`}
                  startDate={selectedDate}
                  endDate={selectedDate}
                  showAllEmployees={true}
                />
                  </div>
              </CardContent>
            </Card>
          </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">Today</h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          </div>

        <Card className="elegant-card border-2 border-primary/20 elegant-shadow-lg">
          <CardHeader>
            <CardTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Your Work Today
            </CardTitle>
            <CardDescription>
              Track your work hours, tasks, and daily updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!entry ? (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Ready to start your day?</h3>
                <p className="text-muted-foreground mb-6">
                  Begin your workday by checking in and setting your focus for today.
                </p>
                <Button onClick={handleCheckIn} className="w-full sm:w-auto">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Check In
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Work Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {entry.check_in_at ? new Date(entry.check_in_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : 'Not started'}
                    </div>
                    <div className="text-sm text-muted-foreground">Check In</div>
                    {entry.check_in_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {checkInSource || 'Manual'}
                      </div>
                    )}
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {entry.check_out_at ? new Date(entry.check_out_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : 'Still working'}
                    </div>
                    <div className="text-sm text-muted-foreground">Check Out</div>
                    {entry.check_out_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {checkOutSource || 'Manual'}
                      </div>
                    )}
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {entry.total_work_time_minutes ? 
                        `${Math.floor(entry.total_work_time_minutes / 60)}h ${entry.total_work_time_minutes % 60}m` : 
                        '0h 0m'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Total Time</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {!entry.check_in_at && (
                    <Button onClick={handleCheckIn}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Check In
                    </Button>
                  )}
                  {entry.check_in_at && !entry.check_out_at && (
                    <Button onClick={handleCheckOut} variant="outline">
                      <Clock className="mr-2 h-4 w-4" />
                      Check Out
                    </Button>
                  )}
                  {entry.check_in_at && !entry.check_out_at && (
                    <Button onClick={entry.lunch_break_start && !entry.lunch_break_end ? handleLunchBreakEnd : handleLunchBreakStart} variant="outline">
                      <Clock className="mr-2 h-4 w-4" />
                      {entry.lunch_break_start && !entry.lunch_break_end ? 'End Lunch' : 'Start Lunch'}
                    </Button>
                  )}

                {/* Daily Updates Form */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-semibold mb-4">Daily Updates</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="employee-today-focus">Today's Focus</Label>
                      <Textarea
                        id="employee-today-focus"
                        placeholder="What are you focusing on today?"
                        value={update.today_focus}
                        onChange={(e) => setUpdate({ ...update, today_focus: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="employee-progress">Progress</Label>
                      <Textarea
                        id="employee-progress"
                        placeholder="What progress have you made?"
                        value={update.progress}
                        onChange={(e) => setUpdate({ ...update, progress: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="employee-blockers">Blockers</Label>
                      <Textarea
                        id="employee-blockers"
                        placeholder="Any blockers or challenges?"
                        value={update.blockers}
                        onChange={(e) => setUpdate({ ...update, blockers: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <Button 
                      onClick={handleSaveUpdate} 
                      disabled={loading || !update.today_focus || !update.progress}
                      className="w-full"
                    >
                      {loading ? 'Saving...' : 'Save Update'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
