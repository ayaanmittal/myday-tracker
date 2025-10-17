import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { User, Users, Settings, ArrowRight, Calendar, Edit, Clock, FileText } from 'lucide-react';
import { EmployeeNotesDialog } from '@/components/EmployeeNotesDialog';
import { EmployeeDetailsDialog } from '@/components/EmployeeDetailsDialog';
import { EmployeeNotesService } from '@/services/employeeNotesService';

interface Employee {
  id: string;
  name: string;
  email: string;
  team: string | null;
  designation: string | null;
  is_active: boolean;
  role: string;
}

interface EmployeeWithNoteCount extends Employee {
  noteCount: number;
}

export default function Employees() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithNoteCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchEmployees();
  }, [user, navigate]);

  const fetchEmployees = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const employeesWithRoles = profilesData?.map((profile) => ({
        ...profile,
        role: rolesData?.find((r) => r.user_id === profile.id)?.role || 'employee',
      }));

      // Fetch note counts for each employee
      const employeesWithNoteCounts = await Promise.all(
        (employeesWithRoles || []).map(async (employee) => {
          const noteCount = await EmployeeNotesService.getEmployeeNoteCount(employee.id);
          return {
            ...employee,
            noteCount
          };
        })
      );

      setEmployees(employeesWithNoteCounts);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      case 'employee':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTeamColor = (team: string | null) => {
    if (!team) return 'bg-gray-100 text-gray-800';
    
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
    ];
    
    const hash = team.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading employees...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">View and manage your team members</p>
          </div>
          {role === 'admin' && (
            <Button onClick={() => navigate('/manage-employees')}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Employees
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground">
                Active team members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {employees.filter(emp => emp.role === 'manager').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Team leaders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Teams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(employees.map(emp => emp.team).filter(Boolean)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Different teams
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Employees Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <Card key={employee.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                    </div>
                  </div>
                  <Badge variant={getRoleBadgeVariant(employee.role)} className="capitalize">
                    {employee.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {employee.team && (
                  <div className="flex items-center space-x-2">
                    <Badge className={`${getTeamColor(employee.team)} border-0`}>
                      {employee.team}
                    </Badge>
                  </div>
                )}
                
                {employee.designation && (
                  <p className="text-sm text-muted-foreground">
                    {employee.designation}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Badge
                    variant={employee.is_active ? 'default' : 'secondary'}
                    className={
                      employee.is_active
                        ? 'bg-success/10 text-success hover:bg-success/20'
                        : ''
                    }
                  >
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  
                  {(role === 'admin' || role === 'manager') && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/history?employee=${employee.id}`)}
                        className="text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        View History
                      </Button>
                      <EmployeeDetailsDialog
                        employeeId={employee.id}
                        employeeName={employee.name}
                        onSaved={fetchEmployees}
                        trigger={
                          <Button size="sm" variant="outline" className="text-xs">
                            <Edit className="h-3 w-3 mr-1" />
                            Employee Details
                          </Button>
                        }
                      />
                      {role === 'admin' && (
                        <EmployeeNotesDialog
                          employeeId={employee.id}
                          employeeName={employee.name}
                          onNotesChange={fetchEmployees}
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs relative"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Notes
                              {employee.noteCount > 0 && (
                                <Badge 
                                  variant="destructive" 
                                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0"
                                >
                                  {employee.noteCount}
                                </Badge>
                              )}
                            </Button>
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {employees.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No employees found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {role === 'admin' 
                  ? 'Start by adding your first employee to the system.'
                  : 'No team members are currently registered.'
                }
              </p>
              {role === 'admin' && (
                <Button onClick={() => navigate('/manage-employees')}>
                  <User className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
