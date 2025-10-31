import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Save, Users, Calendar, Loader2 } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  designation?: string;
}

interface WorkDays {
  id?: string;
  user_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
] as const;

export default function WorkDaysSettings() {
  const { user } = useAuth();
  const { role, loading: roleLoading, error: roleError } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workDays, setWorkDays] = useState<Record<string, WorkDays>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle role errors
  useEffect(() => {
    if (roleError) {
      console.error('Role error:', roleError);
      setError('Failed to load user permissions. Please try again.');
      setLoading(false);
    }
  }, [roleError]);

  // Load data when user and role are available
  useEffect(() => {
    if (!user || roleLoading) return;
    
    if (role !== 'admin' && role !== 'manager') {
      setError('Access denied. You need admin or manager permissions.');
      setLoading(false);
      return;
    }

    loadData();
  }, [user, role, roleLoading]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, email, designation')
        .eq('is_active', true)
        .order('name');

      if (employeesError) {
        throw new Error(`Failed to load employees: ${employeesError.message}`);
      }

      setEmployees(employeesData || []);

      // Load work days configurations
      const { data: workDaysData, error: workDaysError } = await supabase
        .from('employee_work_days')
        .select('*');

      if (workDaysError) {
        throw new Error(`Failed to load work days: ${workDaysError.message}`);
      }

      // Convert to record format
      const workDaysRecord: Record<string, WorkDays> = {};
      (workDaysData || []).forEach(wd => {
        workDaysRecord[wd.user_id] = wd;
      });

      // Create default work days for employees without configuration
      (employeesData || []).forEach(emp => {
        if (!workDaysRecord[emp.id]) {
          workDaysRecord[emp.id] = {
            user_id: emp.id,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false
          };
        }
      });

      setWorkDays(workDaysRecord);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateWorkDay = (userId: string, day: keyof Omit<WorkDays, 'id' | 'user_id'>, value: boolean) => {
    setWorkDays(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [day]: value
      }
    }));
  };

  const saveWorkDays = async () => {
    if (!user) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const updates = Object.values(workDays).map(wd => ({
        user_id: wd.user_id,
        monday: wd.monday,
        tuesday: wd.tuesday,
        wednesday: wd.wednesday,
        thursday: wd.thursday,
        friday: wd.friday,
        saturday: wd.saturday,
        sunday: wd.sunday
      }));

      const { error } = await supabase
        .from('employee_work_days')
        .upsert(updates, { onConflict: 'user_id' });

      if (error) {
        throw new Error(`Failed to save work days: ${error.message}`);
      }

      toast({
        title: 'Success',
        description: 'Work days settings saved successfully',
      });
    } catch (err) {
      console.error('Error saving work days:', err);
      setError(err instanceof Error ? err.message : 'Failed to save work days');
      toast({
        title: 'Error',
        description: 'Failed to save work days settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const setAllEmployees = (day: keyof Omit<WorkDays, 'id' | 'user_id'>, value: boolean) => {
    const newWorkDays = { ...workDays };
    Object.keys(newWorkDays).forEach(userId => {
      newWorkDays[userId] = {
        ...newWorkDays[userId],
        [day]: value
      };
    });
    setWorkDays(newWorkDays);
  };

  // Loading state
  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading work days settings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium text-red-600 mb-2">Error</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Access denied
  if (role !== 'admin' && role !== 'manager') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Work Days Settings
            </h1>
            <p className="text-muted-foreground">
              Configure work days for each employee to calculate accurate attendance metrics
            </p>
          </div>
          <Button onClick={saveWorkDays} disabled={saving} className="flex items-center gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Bulk Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Actions</CardTitle>
            <CardDescription>Quickly set work days for all employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {DAYS.map(day => (
                <div key={day.key} className="space-y-2">
                  <Label className="text-sm font-medium">{day.label}</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAllEmployees(day.key, true)}
                      className="text-xs"
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAllEmployees(day.key, false)}
                      className="text-xs"
                    >
                      None
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Employee Work Days */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Work Days ({employees.length} employees)
            </CardTitle>
            <CardDescription>
              Configure individual work days for each employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {employees.map(employee => (
                <div key={employee.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {employee.email} {employee.designation && `• ${employee.designation}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {DAYS.map(day => (
                      <div key={day.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${employee.id}-${day.key}`}
                          checked={workDays[employee.id]?.[day.key] || false}
                          onCheckedChange={(checked) => 
                            updateWorkDay(employee.id, day.key, checked as boolean)
                          }
                        />
                        <Label 
                          htmlFor={`${employee.id}-${day.key}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {day.label}
                        </Label>
                      </div>
                    ))}
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