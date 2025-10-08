import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Clock, Bell, Users } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [workdayStartTime, setWorkdayStartTime] = useState('10:30');
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState('15');
  const [allowMultipleUpdates, setAllowMultipleUpdates] = useState(false);
  const [enableReminders, setEnableReminders] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'admin') {
      navigate('/today');
      return;
    }
  }, [user, role, roleLoading, navigate]);

  const handleSave = async () => {
    setSaving(true);
    
    // Simulate save (in a real app, save to database)
    setTimeout(() => {
      toast({
        title: 'Settings saved',
        description: 'Your settings have been updated successfully.',
      });
      setSaving(false);
    }, 1000);
  };

  if (roleLoading) {
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
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure system preferences and policies</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Hours Configuration
            </CardTitle>
            <CardDescription>Set default work hours and attendance policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Workday Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={workdayStartTime}
                onChange={(e) => setWorkdayStartTime(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Expected check-in time for employees
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="late-threshold">Late Threshold (minutes)</Label>
              <Input
                id="late-threshold"
                type="number"
                min="0"
                max="120"
                value={lateThresholdMinutes}
                onChange={(e) => setLateThresholdMinutes(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Mark employees as late after this many minutes past start time
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daily Updates
            </CardTitle>
            <CardDescription>Configure how employees submit their daily updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Multiple Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Let employees edit their updates throughout the day
                </p>
              </div>
              <Switch
                checked={allowMultipleUpdates}
                onCheckedChange={setAllowMultipleUpdates}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications & Reminders
            </CardTitle>
            <CardDescription>Manage system notifications and reminders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Send reminders for check-in and daily updates
                </p>
              </div>
              <Switch
                checked={enableReminders}
                onCheckedChange={setEnableReminders}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>Application details and version information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Version:</div>
              <div className="font-medium">1.0.0</div>
              
              <div className="text-muted-foreground">Database:</div>
              <div className="font-medium">Supabase</div>
              
              <div className="text-muted-foreground">Total Employees:</div>
              <div className="font-medium">--</div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          © Zoogol Systems
        </div>
      </div>
    </Layout>
  );
}