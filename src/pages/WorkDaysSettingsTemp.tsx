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
import { Save, Users, Calendar, Loader2, AlertCircle, Shield } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  designation?: string;
}

interface WorkDays {
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

export default function WorkDaysSettingsTemp() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading, error: roleError } = useUserRole();
  
  // Debug logging
  console.log('WorkDaysSettingsTemp render:', { 
    user: !!user, 
    userId: user?.id, 
    role, 
    roleType: typeof role, 
    roleLoading, 
    roleError 
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workDays, setWorkDays] = useState<Record<string, WorkDays>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigningRole, setAssigningRole] = useState(false);

  useEffect(() => {
    console.log('WorkDaysSettingsTemp useEffect:', { 
      user: !!user, 
      userId: user?.id, 
      role, 
      roleType: typeof role, 
      roleLoading, 
      error 
    });
    
    if (!user) {
      setLoading(false);
      return;
    }

    // Wait for role to load
    if (roleLoading) {
      console.log('Role is still loading...');
      return;
    }

    // Check if user has admin role
    if (role !== 'admin') {
      console.log('User is not admin, role:', role, 'type:', typeof role);
      setError(`Access denied. Only administrators can access this page. Current role: ${role || 'None'}`);
      setLoading(false);
      return;
    }

    // Load data if user is admin
    if (role === 'admin') {
      console.log('User is admin, loading data...');
      loadData();
    }
  }, [user, role, roleLoading]);

  const assignAdminRole = async () => {
    if (!user) return;
    
    setAssigningRole(true);
    try {
      // First, try to update existing role
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', user.id);
      
      if (updateError) {
        // If update fails (no existing record), insert new one
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'admin' });
        
        if (insertError) {
          console.error('Error assigning admin role:', insertError);
          setError(`Failed to assign admin role: ${insertError.message}`);
          setLoading(false);
          return;
        }
      }

      console.log('Admin role assigned successfully');
      toast({
        title: 'Success',
        description: 'Admin role assigned successfully! Refreshing page...',
      });

      // Reload the page to refresh the role
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error assigning role:', error);
      setError(`Failed to assign admin role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    } finally {
      setAssigningRole(false);
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading employees...');
      
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, email, designation')
        .eq('is_active', true)
        .order('name');

      if (employeesError) {
        throw new Error(`Failed to load employees: ${employeesError.message}`);
      }

      if (!employeesData || employeesData.length === 0) {
        setEmployees([]);
        setWorkDays({});
        return;
      }

      console.log('Employees loaded:', employeesData.length);
      setEmployees(employeesData);

      // Load work days configurations
      console.log('Loading work days...');
      const { data: workDaysData, error: workDaysError } = await supabase
        .from('employee_work_days')
        .select('user_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday');

      if (workDaysError) {
        console.warn('Work days table might not exist or have RLS issues:', workDaysError);
        // Continue with default work days
      }

      // Create work days record
      const workDaysRecord: Record<string, WorkDays> = {};
      
      // Add existing work days
      (workDaysData || []).forEach(wd => {
        workDaysRecord[wd.user_id] = {
          user_id: wd.user_id,
          monday: wd.monday ?? true,
          tuesday: wd.tuesday ?? true,
          wednesday: wd.wednesday ?? true,
          thursday: wd.thursday ?? true,
          friday: wd.friday ?? true,
          saturday: wd.saturday ?? false,
          sunday: wd.sunday ?? false
        };
      });

      // Add default work days for employees without configuration
      employeesData.forEach(emp => {
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

      console.log('Work days record created:', Object.keys(workDaysRecord).length);
      setWorkDays(workDaysRecord);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateWorkDay = (userId: string, day: keyof Omit<WorkDays, 'user_id'>, value: boolean) => {
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

  const setAllEmployees = (day: keyof Omit<WorkDays, 'user_id'>, value: boolean) => {
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
  if (roleLoading || loading || assigningRole) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {assigningRole ? 'Assigning admin role...' : 'Loading work days settings...'}
            </p>
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
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-red-600 mb-2">Access Denied</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={assignAdminRole} disabled={assigningRole} className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {assigningRole ? 'Assigning...' : 'Assign Admin Role'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Click the button above to assign yourself admin permissions
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium">Not Logged In</p>
            <p className="text-sm text-muted-foreground">Please log in to access this page.</p>
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
            <p className="text-xs text-green-600 mt-1">
              ✅ Admin access granted
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
              {employees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No employees found. Make sure you have active employees in the system.
                </p>
              ) : (
                employees.map(employee => (
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
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
