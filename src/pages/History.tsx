import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Home, Edit, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { DatePicker } from '@/components/DatePicker';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExtraWorkLog {
  id: string;
  work_type: string;
  hours_worked: number;
  description: string | null;
  logged_at: string;
}

interface HistoryEntry {
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
  day_updates: Array<{
    today_focus: string;
    progress: string;
    blockers: string | null;
  }>;
  extra_work_logs: ExtraWorkLog[];
}

export default function History() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading) {
    fetchHistory();
    }
  }, [user, roleLoading, navigate, selectedDate]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      // Get entries for the selected month
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('day_entries')
        .select(`
          *,
          day_updates (
            today_focus,
            progress,
            blockers
          ),
          extra_work_logs (
            id,
            work_type,
            hours_worked,
            description,
            logged_at
          )
        `)
        .eq('user_id', user.id)
        .gte('entry_date', startOfMonth.toISOString().split('T')[0])
        .lte('entry_date', endOfMonth.toISOString().split('T')[0])
        .order('entry_date', { ascending: false });

      if (error) {
        // Check if it's a table doesn't exist error
        if (error.message?.includes('relation "extra_work_logs" does not exist') || 
            error.message?.includes('relation "public.extra_work_logs" does not exist')) {
          console.log('Extra work logs table not found. Please run the database setup script.');
          // Fetch without extra work logs
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('day_entries')
            .select(`
              *,
              day_updates (
                today_focus,
                progress,
                blockers
              )
            `)
            .eq('user_id', user.id)
            .gte('entry_date', startOfMonth.toISOString().split('T')[0])
            .lte('entry_date', endOfMonth.toISOString().split('T')[0])
            .order('entry_date', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          setEntries(fallbackData as any || []);
          return;
        }
        throw error;
      }
      setEntries(data as any || []);
    } catch (error) {
      console.error('Error fetching history:', error);
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

  const getTotalExtraHours = (extraWorkLogs: ExtraWorkLog[]) => {
    return extraWorkLogs.reduce((total, log) => total + log.hours_worked, 0);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Work History</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <DatePicker
            date={selectedDate}
            onDateChange={(date) => date && setSelectedDate(date)}
          />
        </div>

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
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {entry.check_in_at
                            ? new Date(entry.check_in_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Not checked in'}
                        </span>
                        {entry.total_work_time_minutes && (
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
                      </CardDescription>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        entry.status === 'completed'
                          ? 'bg-success/10 text-success'
                          : entry.status === 'in_progress'
                          ? 'bg-warning/10 text-warning'
                          : entry.status === 'unlogged'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {entry.status.replace('_', ' ')}
                    </span>
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
                  <h4 className="font-semibold text-sm">Time Tracking</h4>
                  {role === 'admin' && (
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
                  {selectedEntry.total_work_time_minutes && (
                    <div>
                      <span className="text-muted-foreground">Total work time:</span>
                      <p className="font-medium text-success">
                        {Math.floor(selectedEntry.total_work_time_minutes / 60)}h{' '}
                        {selectedEntry.total_work_time_minutes % 60}m
                          {selectedEntry.extra_work_logs && selectedEntry.extra_work_logs.length > 0 && (
                            <span className="text-success">
                              {' '}+ {getTotalExtraHours(selectedEntry.extra_work_logs).toFixed(1)}h extra
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    {selectedEntry.last_modified_by && selectedEntry.modification_reason && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Last modified:</span>
                        <p className="font-medium text-amber-600 text-xs">
                          {selectedEntry.modification_reason} • {selectedEntry.updated_at ? new Date(selectedEntry.updated_at).toLocaleString() : 'Unknown time'}
                      </p>
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* Daily updates section */}
              {selectedEntry.day_updates?.[0] ? (
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
              ) : (
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground italic">No daily updates recorded</p>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}