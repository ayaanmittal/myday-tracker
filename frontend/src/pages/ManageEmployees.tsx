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
import { UserPlus, Edit, Trash2, User, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteDataCounts, setDeleteDataCounts] = useState({
    attendance: 0,
    dayUpdates: 0,
    extraWorkLogs: 0,
    leaveRequests: 0,
    leaveBalances: 0,
    employeeMappings: 0,
    employeeWorkDays: 0,
    tasks: 0,
  });
  const [deleteSelections, setDeleteSelections] = useState({
    deleteProfile: true,
    deleteAttendance: true,
    deleteDayUpdates: true,
    deleteExtraWorkLogs: true,
    deleteLeaveRequests: true,
    deleteLeaveBalances: true,
    deleteEmployeeMappings: true,
    deleteEmployeeWorkDays: true,
    deleteTasks: false, // Keep tasks by default (might be assigned to others)
    deleteAuthUser: false, // Keep auth user by default for safety
  });

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

  const handleDeleteClick = async (employee: Employee) => {
    setEmployeeToDelete(employee);
    
    // Count data for this employee
    try {
      // Get attendance records first (needed for day_updates count)
      const { data: attendanceData } = await supabase
        .from('unified_attendance')
        .select('id')
        .eq('user_id', employee.id);
      
      const attendanceIds = attendanceData?.map(a => a.id) || [];
      const attendanceCount = attendanceIds.length;

      // Count all data in parallel
      const [
        dayUpdatesResult,
        extraWorkLogsResult,
        leaveRequestsResult,
        leaveBalancesResult,
        employeeMappingsResult,
        employeeWorkDaysResult,
        tasksResult
      ] = await Promise.all([
        attendanceIds.length > 0
          ? supabase.from('day_updates').select('id', { count: 'exact', head: true }).in('unified_attendance_id', attendanceIds)
          : Promise.resolve({ count: 0 }),
        supabase.from('extra_work_logs').select('id', { count: 'exact', head: true }).eq('user_id', employee.id),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('user_id', employee.id),
        supabase.from('leave_balances').select('id', { count: 'exact', head: true }).eq('user_id', employee.id),
        supabase.from('employee_mappings').select('id', { count: 'exact', head: true }).eq('our_user_id', employee.id),
        supabase.from('employee_work_days').select('id', { count: 'exact', head: true }).eq('user_id', employee.id),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).or(`assigned_to.eq.${employee.id},assigned_by.eq.${employee.id}`),
      ]);

      setDeleteDataCounts({
        attendance: attendanceCount,
        dayUpdates: dayUpdatesResult.count || 0,
        extraWorkLogs: extraWorkLogsResult.count || 0,
        leaveRequests: leaveRequestsResult.count || 0,
        leaveBalances: leaveBalancesResult.count || 0,
        employeeMappings: employeeMappingsResult.count || 0,
        employeeWorkDays: employeeWorkDaysResult.count || 0,
        tasks: tasksResult.count || 0,
      });

      setDeleteDialogOpen(true);
    } catch (error) {
      console.error('Error counting employee data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee data counts',
        variant: 'destructive',
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!employeeToDelete) return;

    setLoading(true);
    try {
      const errors: string[] = [];

      // Delete selected data in order (respecting foreign key constraints)
      if (deleteSelections.deleteExtraWorkLogs) {
        const { error } = await supabase
          .from('extra_work_logs')
          .delete()
          .eq('user_id', employeeToDelete.id);
        if (error) errors.push(`Extra work logs: ${error.message}`);
      }

      if (deleteSelections.deleteDayUpdates) {
        // First get unified_attendance IDs
        const { data: attendanceData } = await supabase
          .from('unified_attendance')
          .select('id')
          .eq('user_id', employeeToDelete.id);
        
        if (attendanceData && attendanceData.length > 0) {
          const { error } = await supabase
            .from('day_updates')
            .delete()
            .in('unified_attendance_id', attendanceData.map(a => a.id));
          if (error) errors.push(`Day updates: ${error.message}`);
        }
      }

      if (deleteSelections.deleteAttendance) {
        const { error } = await supabase
          .from('unified_attendance')
          .delete()
          .eq('user_id', employeeToDelete.id);
        if (error) errors.push(`Attendance: ${error.message}`);
      }

      if (deleteSelections.deleteLeaveRequests) {
        const { error } = await supabase
          .from('leave_requests')
          .delete()
          .eq('user_id', employeeToDelete.id);
        if (error) errors.push(`Leave requests: ${error.message}`);
      }

      if (deleteSelections.deleteLeaveBalances) {
        const { error } = await supabase
          .from('leave_balances')
          .delete()
          .eq('user_id', employeeToDelete.id);
        if (error) errors.push(`Leave balances: ${error.message}`);
      }

      if (deleteSelections.deleteTasks) {
        // Delete tasks where employee is assigned_to or assigned_by
        const { error: assignedError } = await supabase
          .from('tasks')
          .delete()
          .eq('assigned_to', employeeToDelete.id);
        if (assignedError) errors.push(`Tasks (assigned): ${assignedError.message}`);

        // For tasks assigned_by, we might want to keep them but change assigned_by
        // For now, we'll delete them too if selected
        const { error: createdError } = await supabase
          .from('tasks')
          .delete()
          .eq('assigned_by', employeeToDelete.id);
        if (createdError) errors.push(`Tasks (created): ${createdError.message}`);
      }

      if (deleteSelections.deleteEmployeeMappings) {
        const { error } = await supabase
          .from('employee_mappings')
          .delete()
          .eq('our_user_id', employeeToDelete.id);
        if (error) errors.push(`Employee mappings: ${error.message}`);
      }

      if (deleteSelections.deleteEmployeeWorkDays) {
        const { error } = await supabase
          .from('employee_work_days')
          .delete()
          .eq('user_id', employeeToDelete.id);
        if (error) errors.push(`Employee work days: ${error.message}`);
      }

      if (deleteSelections.deleteProfile) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', employeeToDelete.id);
        if (error) errors.push(`Profile: ${error.message}`);
      }

      // Delete user role
      if (deleteSelections.deleteProfile) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', employeeToDelete.id);
        if (error) errors.push(`User role: ${error.message}`);
      }

      // Delete auth user (this requires admin privileges and should be done carefully)
      if (deleteSelections.deleteAuthUser) {
        // Note: Deleting auth.users requires service role or admin API access
        // This might need to be done via a backend function or Supabase admin API
        toast({
          title: 'Warning',
          description: 'Auth user deletion requires admin API access. Please delete manually from Supabase Dashboard if needed.',
          variant: 'destructive',
        });
      }

      if (errors.length > 0) {
        toast({
          title: 'Partial Deletion',
          description: `Some data could not be deleted: ${errors.join('; ')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Employee Deleted',
          description: `Selected data for ${employeeToDelete.name} has been permanently deleted.`,
        });
      }

      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      // Reset selections
      setDeleteSelections({
        deleteProfile: true,
        deleteAttendance: true,
        deleteDayUpdates: true,
        deleteExtraWorkLogs: true,
        deleteLeaveRequests: true,
        deleteLeaveBalances: true,
        deleteEmployeeMappings: true,
        deleteEmployeeWorkDays: true,
        deleteTasks: false,
        deleteAuthUser: false,
      });
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
                      {employee.is_active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(employee)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(employee)}
                          >
                            <User className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(employee)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Permanently Delete Employee
              </DialogTitle>
              <DialogDescription>
                Select which data to delete for <strong>{employeeToDelete?.name}</strong>. 
                Checked items will be deleted, unchecked items will be kept.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive mb-2">
                  ⚠️ Warning: This action cannot be undone!
                </p>
                <p className="text-sm text-muted-foreground">
                  Make sure you've selected the correct data to delete. Some data may be required for system integrity.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteProfile"
                    checked={deleteSelections.deleteProfile}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteProfile: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteProfile" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Profile & User Role</span>
                      <span className="text-sm text-muted-foreground">Always required for deletion</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteAttendance"
                    checked={deleteSelections.deleteAttendance}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteAttendance: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteAttendance" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Attendance Records</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.attendance} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteDayUpdates"
                    checked={deleteSelections.deleteDayUpdates}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteDayUpdates: checked as boolean })
                    }
                    disabled={!deleteSelections.deleteAttendance}
                  />
                  <Label htmlFor="deleteDayUpdates" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className={!deleteSelections.deleteAttendance ? 'text-muted-foreground' : ''}>
                        Day Updates
                      </span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.dayUpdates} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteExtraWorkLogs"
                    checked={deleteSelections.deleteExtraWorkLogs}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteExtraWorkLogs: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteExtraWorkLogs" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Extra Work Logs</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.extraWorkLogs} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteLeaveRequests"
                    checked={deleteSelections.deleteLeaveRequests}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteLeaveRequests: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteLeaveRequests" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Leave Requests</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.leaveRequests} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteLeaveBalances"
                    checked={deleteSelections.deleteLeaveBalances}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteLeaveBalances: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteLeaveBalances" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Leave Balances</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.leaveBalances} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteEmployeeMappings"
                    checked={deleteSelections.deleteEmployeeMappings}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteEmployeeMappings: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteEmployeeMappings" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Employee Mappings (TeamOffice)</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.employeeMappings} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteEmployeeWorkDays"
                    checked={deleteSelections.deleteEmployeeWorkDays}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteEmployeeWorkDays: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteEmployeeWorkDays" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Work Day Settings</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.employeeWorkDays} records</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteTasks"
                    checked={deleteSelections.deleteTasks}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteTasks: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteTasks" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Tasks (assigned to or created by)</span>
                      <span className="text-sm text-muted-foreground">{deleteDataCounts.tasks} records</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ⚠️ This will delete all tasks where this employee is assigned or created tasks
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deleteAuthUser"
                    checked={deleteSelections.deleteAuthUser}
                    onCheckedChange={(checked) =>
                      setDeleteSelections({ ...deleteSelections, deleteAuthUser: checked as boolean })
                    }
                  />
                  <Label htmlFor="deleteAuthUser" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span>Authentication User Account</span>
                      <span className="text-sm text-muted-foreground">⚠️ Requires admin access</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Note: Auth user deletion requires Supabase admin API access and may need to be done manually
                    </p>
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setEmployeeToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={loading || !deleteSelections.deleteProfile}
              >
                {loading ? 'Deleting...' : 'Delete Selected Data'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}