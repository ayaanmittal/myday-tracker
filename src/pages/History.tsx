import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { DatePicker } from '@/components/DatePicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HistoryEntry {
  id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  day_updates: Array<{
    today_focus: string;
    progress: string;
    blockers: string | null;
  }>;
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchHistory();
  }, [user, navigate, selectedDate]);

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
          )
        `)
        .eq('user_id', user.id)
        .gte('entry_date', startOfMonth.toISOString().split('T')[0])
        .lte('entry_date', endOfMonth.toISOString().split('T')[0])
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work History</h1>
            <p className="text-muted-foreground">
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
        <DialogContent className="max-w-2xl">
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
              {selectedEntry?.check_in_at &&
                `Checked in at ${new Date(selectedEntry.check_in_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
              {selectedEntry?.check_out_at &&
                ` • Checked out at ${new Date(selectedEntry.check_out_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry?.day_updates?.[0] && (
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">What they worked on:</h4>
                <p className="text-sm text-muted-foreground">{selectedEntry.day_updates[0].today_focus}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Tasks completed:</h4>
                <p className="text-sm text-muted-foreground">{selectedEntry.day_updates[0].progress}</p>
              </div>

              {selectedEntry.day_updates[0].blockers && (
                <div>
                  <h4 className="font-semibold mb-2">Blockers:</h4>
                  <p className="text-sm text-muted-foreground">{selectedEntry.day_updates[0].blockers}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}