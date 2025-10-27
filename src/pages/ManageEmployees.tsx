import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Edit, Trash2, User } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Employee {
  id: string;
  name: string;
  email: string;
  team: string | null;
  designation: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  role: string;
}

export default function ManageEmployees() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    team: '',
    designation: '',
    phone: '',
    address: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'admin') {
      navigate('/today');
      return;
    }

    if (role === 'admin') {
      fetchEmployees();
    }
  }, [user, role, roleLoading, navigate, showInactive]);

  const fetchEmployees = async () => {
    try {
      // Fetch employees based on active/inactive filter
      let query = supabase
        .from('profiles')
        .select('*');
      
      // Filter by is_active status
      if (showInactive) {
        query = query.eq('is_active', false);
      } else {
        query = query.eq('is_active', true);
      }
      
      const { data: profilesData, error: profilesError } = await query.order('name');

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const employeesWithRoles = profilesData?.map((profile) => ({
        ...profile,
        role: rolesData?.find((r) => r.user_id === profile.id)?.role || 'employee',
      }));

      setEmployees(employeesWithRoles || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingEmployee) {
        // Update existing employee
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            team: formData.team || null,
            designation: formData.designation || null,
            phone: formData.phone || null,
            address: formData.address || null,
          })
          .eq('id', editingEmployee.id);

        if (profileError) throw profileError;

        // Update role
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: formData.role })
          .eq('user_id', editingEmployee.id);

        if (roleError) throw roleError;

        toast({
          title: 'Employee updated',
          description: 'Employee information has been updated successfully.',
        });
      } else {
        // Create employee profile (auth user must exist in Supabase Dashboard)
        const { data: result, error: createError } = await supabase
          .rpc('create_employee_profile_for_existing_auth_user', {
            p_name: formData.name,
            p_email: formData.email,
            p_team: formData.team || null,
            p_designation: formData.designation || null,
            p_role: formData.role
          });

        if (createError) {
          throw new Error(`Failed to create employee: ${createError.message}`);
        }

        if (!result || !result.success) {
          throw new Error(result?.error || 'Failed to create employee profile');
        }

        toast({
          title: 'Employee profile created',
          description: 'Profile created successfully and linked to existing auth user.',
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchEmployees();
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

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: '',
      team: employee.team || '',
      designation: employee.designation || '',
      phone: employee.phone || '',
      address: employee.address || '',
      role: employee.role as 'admin' | 'manager' | 'employee',
    });
    setDialogOpen(true);
  };

  const handleToggleActive = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: employee.is_active ? 'Employee deactivated' : 'Employee activated',
        description: `${employee.name} has been ${employee.is_active ? 'deactivated' : 'activated'}.`,
      });

      fetchEmployees();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      team: '',
      designation: '',
      phone: '',
      address: '',
      role: 'employee',
    });
    setEditingEmployee(null);
  };

  if (roleLoading || loading) {
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {showInactive ? 'Inactive Employees' : 'Active Employees'}
            </h1>
            <p className="text-muted-foreground">
              {showInactive 
                ? 'View and manage inactive employee accounts' 
                : 'Add, edit, and manage active employee accounts'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInactive(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !showInactive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setShowInactive(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  showInactive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Inactive
              </button>
            </div>
          {!showInactive && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </DialogTitle>
                 <DialogDescription>
                   {editingEmployee
                     ? 'Update employee information and permissions'
                     : 'Create employee profile. You must first create the auth user in Supabase Dashboard (Authentication → Users → Add User) with the same email.'}
                 </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {!editingEmployee && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Must match the email of an existing auth user in Supabase Dashboard.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="team">Team (optional)</Label>
                  <Input
                    id="team"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    placeholder="e.g., Engineering, Sales, Marketing"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation">Designation (optional)</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g., Senior Developer, Team Lead, Manager"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., +1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address (optional)</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter full address"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'admin' | 'manager' | 'employee') =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Admin: Full access • Manager: Team access • Employee: Personal access only
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : editingEmployee ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{showInactive ? 'Inactive' : 'Active'} Employees</CardTitle>
            <CardDescription>
              {showInactive 
                ? 'View and manage inactive employee accounts' 
                : 'Manage active employee accounts and permissions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.team || '-'}</TableCell>
                    <TableCell>{employee.designation || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(employee)}
                      >
                        {employee.is_active ? (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        ) : (
                          <User className="h-4 w-4 text-success" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {employees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No employees found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}