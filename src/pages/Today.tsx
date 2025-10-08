import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Clock, CheckCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DayEntry {
  id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
}

interface DayUpdate {
  today_focus: string;
  progress: string;
  blockers: string;
}

export default function Today() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<DayEntry | null>(null);
  const [update, setUpdate] = useState<DayUpdate>({ today_focus: '', progress: '', blockers: '' });
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchTodayEntry();
  }, [user, navigate]);

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

  const handleCheckOut = async () => {
    if (!entry) return;
    setLoading(true);

    try {
      const checkOutTime = new Date();
      const checkInTime = new Date(entry.check_in_at!);
      const minutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

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

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container max-w-4xl mx-auto p-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">MyDay</h1>
            <p className="text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {!entry && (
          <Card className="border-2 border-primary/20">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Ready to start your day?</CardTitle>
              <CardDescription>Click below to check in and begin tracking your work</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Button size="lg" onClick={handleCheckIn} disabled={loading} className="min-w-[200px]">
                <Clock className="mr-2 h-5 w-5" />
                {loading ? 'Starting...' : 'Start Day'}
              </Button>
            </CardContent>
          </Card>
        )}

        {entry && entry.status === 'in_progress' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Update</CardTitle>
                <CardDescription>Share what you're working on today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="focus">What are you working on today? (max 300 chars)</Label>
                  <Textarea
                    id="focus"
                    placeholder="Today I'm focusing on..."
                    value={update.today_focus}
                    onChange={(e) => setUpdate({ ...update, today_focus: e.target.value })}
                    maxLength={300}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">{update.today_focus.length}/300</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="progress">Top 1-3 tasks completed / progress (max 300 chars)</Label>
                  <Textarea
                    id="progress"
                    placeholder="Tasks completed..."
                    value={update.progress}
                    onChange={(e) => setUpdate({ ...update, progress: e.target.value })}
                    maxLength={300}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">{update.progress.length}/300</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blockers">Any blockers or help needed? (optional, max 200 chars)</Label>
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

            <div className="text-center">
              <Button variant="link" onClick={() => navigate('/history')}>
                View History
              </Button>
            </div>
          </div>
        )}

        {entry && entry.status === 'completed' && (
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
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4 pb-6">
              <Button variant="outline" onClick={() => navigate('/history')}>
                View History
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}