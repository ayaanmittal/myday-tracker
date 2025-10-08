import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Clock, CheckCircle, Plus, Home, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
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
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  total_work_time_minutes: number | null;
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

    if (!roleLoading && role === 'admin') {
      navigate('/dashboard');
      return;
    }

    fetchTodayEntry();
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

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('day_entries')
        .insert({
          user_id: user.id,
          entry_date: today,
          check_in_at: new Date().toISOString(),
          status: 'in_progress',
          device_info: navigator.userAgent,
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

  const handleLunchBreakStart = async () => {
    if (!entry) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('day_entries')
        .update({
          lunch_break_start: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (error) throw error;

      setEntry({ ...entry, lunch_break_start: new Date().toISOString() });
      toast({
        title: 'Lunch break started',
        description: 'Enjoy your break!',
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
      const { error } = await supabase
        .from('day_entries')
        .update({
          lunch_break_end: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (error) throw error;

      setEntry({ ...entry, lunch_break_end: new Date().toISOString() });
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
        })
        .eq('id', entry.id);

      if (error) throw error;

      toast({
        title: 'Day ended!',
        description: `You worked for ${Math.floor(minutes / 60)}h ${minutes % 60}m today.`,
      });
      
      fetchTodayEntry();
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
    if (!entry) return;
    setLoading(true);

    try {
      const { data: existingUpdate } = await supabase
        .from('day_updates')
        .select('id')
        .eq('day_entry_id', entry.id)
        .maybeSingle();

      if (existingUpdate) {
        const { error } = await supabase
          .from('day_updates')
          .update(update)
          .eq('id', existingUpdate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('day_updates')
          .insert({
            day_entry_id: entry.id,
            ...update,
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
        });

      if (error) throw error;

      toast({
        title: 'Extra work logged!',
        description: `${extraWorkForm.hours_worked} hours of ${extraWorkForm.work_type} work has been recorded.`,
      });

      setDialogOpen(false);
      setExtraWorkForm({
        work_type: 'remote',
        hours_worked: '',
        description: '',
      });

      // Refresh extra work logs
      const { data: extraWorkData } = await supabase
        .from('extra_work_logs')
        .select('*')
        .eq('day_entry_id', entry.id)
        .order('logged_at', { ascending: false });

      setExtraWorkLogs(extraWorkData || []);
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
    if (!confirm('Are you sure you want to delete this work log?')) return;

    try {
      const { error } = await supabase
        .from('extra_work_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: 'Work log deleted',
        description: 'The extra work log has been removed.',
      });

      // Refresh extra work logs
      if (entry) {
        const { data: extraWorkData } = await supabase
          .from('extra_work_logs')
          .select('*')
          .eq('day_entry_id', entry.id)
          .order('logged_at', { ascending: false });

        setExtraWorkLogs(extraWorkData || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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

  const getTotalExtraHours = () => {
    return extraWorkLogs.reduce((total, log) => total + log.hours_worked, 0);
  };

  if (loadingPage || roleLoading) {
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">Today</h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {!entry && (
          <Card className="elegant-card border-2 border-primary/20 elegant-shadow-lg">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-10 w-10 text-primary" />
                </div>
              </div>
              <CardTitle className="font-heading text-3xl font-bold mb-3">Ready to start your day?</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">Click below to check in and begin tracking your work</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <Button size="lg" onClick={handleCheckIn} disabled={loading} className="min-w-[200px] elegant-button text-lg py-6">
                <Clock className="mr-2 h-5 w-5" />
                {loading ? 'Starting...' : 'Start Day'}
              </Button>
            </CardContent>
          </Card>
        )}

        {entry && entry.status === 'in_progress' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center pb-4">
                <CardTitle>Lunch Break</CardTitle>
                <CardDescription>Track your lunch break</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center gap-4 pb-6">
                {!entry.lunch_break_start && (
                  <Button size="lg" onClick={handleLunchBreakStart} disabled={loading} className="min-w-[200px]">
                    <Clock className="mr-2 h-5 w-5" />
                    {loading ? 'Starting...' : 'Start Lunch Break'}
                  </Button>
                )}
                {entry.lunch_break_start && !entry.lunch_break_end && (
                  <Button size="lg" onClick={handleLunchBreakEnd} disabled={loading} className="min-w-[200px]">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    {loading ? 'Ending...' : 'End Lunch Break'}
                  </Button>
                )}
                {entry.lunch_break_start && entry.lunch_break_end && (
                  <div className="text-center text-muted-foreground">
                    <p>Lunch break: {new Date(entry.lunch_break_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(entry.lunch_break_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Update</CardTitle>
                <CardDescription>Share what you worked on today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="focus">What did you work on today? (max 300 chars)</Label>
                  <Textarea
                    id="focus"
                    placeholder="Today I worked on..."
                    value={update.today_focus}
                    onChange={(e) => setUpdate({ ...update, today_focus: e.target.value })}
                    maxLength={300}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">{update.today_focus.length}/300</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="progress">What tasks did you complete today? (max 300 chars)</Label>
                  <Textarea
                    id="progress"
                    placeholder="I completed..."
                    value={update.progress}
                    onChange={(e) => setUpdate({ ...update, progress: e.target.value })}
                    maxLength={300}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">{update.progress.length}/300</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blockers">Did you face any blockers or need help? (optional, max 200 chars)</Label>
                  <Textarea
                    id="blockers"
                    placeholder="No blockers..."
                    value={update.blockers}
                    onChange={(e) => setUpdate({ ...update, blockers: e.target.value })}
                    maxLength={200}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">{update.blockers.length}/200</p>
                </div>

                <Button onClick={handleSaveUpdate} disabled={loading || !update.today_focus || !update.progress}>
                  {loading ? 'Saving...' : 'Save Update'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-success/20">
              <CardHeader className="text-center pb-4">
                <CardTitle>End Your Day</CardTitle>
                <CardDescription>
                  Started at {new Date(entry.check_in_at!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                <Button size="lg" variant="secondary" onClick={handleCheckOut} disabled={loading} className="min-w-[200px]">
                  <CheckCircle className="mr-2 h-5 w-5" />
                  {loading ? 'Ending...' : 'End Day'}
                </Button>
              </CardContent>
            </Card>

            <div className="text-center space-x-4">
              <Button variant="link" onClick={() => navigate('/history')}>
                View History
              </Button>
              <Button variant="link" onClick={() => navigate('/analytics')}>
                View Analytics
              </Button>
            </div>
          </div>
        )}

        {entry && entry.status === 'completed' && (
          <div className="space-y-6">
            <Card className="border-2 border-success/20">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Day Complete!</CardTitle>
                <CardDescription>
                  You worked for {Math.floor(entry.total_work_time_minutes! / 60)}h {entry.total_work_time_minutes! % 60}m today
                  {getTotalExtraHours() > 0 && (
                    <span> + {getTotalExtraHours().toFixed(1)}h extra work</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center gap-4 pb-6">
                <Button variant="outline" onClick={() => navigate('/history')}>
                  View History
                </Button>
              </CardContent>
            </Card>

            {/* Extra Work Logs Section - Under Day Complete */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Extra Work Logs</CardTitle>
                    <CardDescription>Log additional hours worked from home or other locations</CardDescription>
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Extra Work
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Extra Work Log</DialogTitle>
                        <DialogDescription>
                          Log additional hours worked from home or other locations
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddExtraWork} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="work_type">Work Type</Label>
                          <Select
                            value={extraWorkForm.work_type}
                            onValueChange={(value) => setExtraWorkForm({ ...extraWorkForm, work_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="remote">Remote Work</SelectItem>
                              <SelectItem value="overtime">Overtime</SelectItem>
                              <SelectItem value="weekend">Weekend Work</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="hours_worked">Hours Worked</Label>
                          <Input
                            id="hours_worked"
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="24"
                            value={extraWorkForm.hours_worked}
                            onChange={(e) => setExtraWorkForm({ ...extraWorkForm, hours_worked: e.target.value })}
                            placeholder="e.g., 2.5"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description (optional)</Label>
                          <Textarea
                            id="description"
                            value={extraWorkForm.description}
                            onChange={(e) => setExtraWorkForm({ ...extraWorkForm, description: e.target.value })}
                            placeholder="e.g., Worked on project documentation from home"
                            rows={3}
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading || !extraWorkForm.hours_worked}>
                            {loading ? 'Adding...' : 'Add Work Log'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {extraWorkLogs.length > 0 ? (
                  <div className="space-y-3">
                    {extraWorkLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{getWorkTypeLabel(log.work_type)}</p>
                            <p className="text-sm text-muted-foreground">
                              {log.hours_worked} hours • {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {log.description && (
                              <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteExtraWork(log.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium">
                        Total Extra Hours: {getTotalExtraHours().toFixed(1)} hours
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No extra work logged yet</p>
                    <p className="text-sm">Click "Add Extra Work" to log additional hours</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}