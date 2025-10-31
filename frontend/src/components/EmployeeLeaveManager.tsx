import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  Edit, 
  Save, 
  X,
  Calendar,
  Clock,
  UserCheck,
  Settings,
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  employee_category: string;
  joined_on_date: string;
  probation_period_months: number;
  is_on_probation: boolean;
  profile_id: string;
}

interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  employee_category_id: string;
  probation_eligible: boolean;
  leave_type_name?: string;
}

interface LeaveType {
  id: string;
  name: string;
  description: string;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
}

interface EmployeeLeaveSettings {
  id: string;
  user_id: string;
  employee_category_id: string;
  custom_leave_days: Record<string, number>;
  is_custom_settings: boolean;
  notes: string;
  employee_category_name?: string;
}

const EmployeeLeaveManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeLeaveBalances, setEmployeeLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employeeLeaveSettings, setEmployeeLeaveSettings] = useState<EmployeeLeaveSettings | null>(null);
  
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  const [customLeaveDays, setCustomLeaveDays] = useState<Record<string, number>>({});
  const [settingsNotes, setSettingsNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEmployees(),
        loadLeaveTypes()
      ]);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        employee_category,
        joined_on_date,
        probation_period_months,
        user_id
      `)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    
    const employeesWithProbation = data?.map(emp => ({
      ...emp,
      profile_id: emp.id,
      is_on_probation: new Date(emp.joined_on_date) > new Date(Date.now() - (emp.probation_period_months || 3) * 30 * 24 * 60 * 60 * 1000)
    })) || [];
    
    setEmployees(employeesWithProbation);
  };

  const loadLeaveTypes = async () => {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    setLeaveTypes(data || []);
  };

  const loadEmployeeLeaveBalances = async (userId: string) => {
    const { data, error } = await supabase
      .from('leave_balances')
      .select(`
        *,
        leave_types!inner(name)
      `)
      .eq('user_id', userId)
      .eq('year', new Date().getFullYear());
    
    if (error) throw error;
    
    const balancesWithNames = data?.map(balance => ({
      ...balance,
      leave_type_name: balance.leave_types?.name
    })) || [];
    
    setEmployeeLeaveBalances(balancesWithNames);
  };

  const loadEmployeeLeaveSettings = async (userId: string) => {
    const { data, error } = await supabase
      .from('employee_leave_settings')
      .select(`
        *,
        employee_categories!inner(name)
      `)
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }
    
    if (data) {
      const settingsWithNames = {
        ...data,
        employee_category_name: data.employee_categories?.name
      };
      setEmployeeLeaveSettings(settingsWithNames);
      setCustomLeaveDays(data.custom_leave_days || {});
      setSettingsNotes(data.notes || '');
    } else {
      setEmployeeLeaveSettings(null);
      setCustomLeaveDays({});
      setSettingsNotes('');
    }
  };

  const selectEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDialog(true);
    await Promise.all([
      loadEmployeeLeaveBalances(employee.id),
      loadEmployeeLeaveSettings(employee.id)
    ]);
  };

  const updateEmployeeCategory = async (employeeId: string, newCategory: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ employee_category: newCategory })
        .eq('id', employeeId);
      
      if (error) throw error;
      
      setSuccess('Employee category updated successfully');
      await loadEmployees();
      if (selectedEmployee?.id === employeeId) {
        setSelectedEmployee({...selectedEmployee, employee_category: newCategory});
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateEmployeeJoinedDate = async (employeeId: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ joined_on_date: newDate })
        .eq('id', employeeId);
      
      if (error) throw error;
      
      setSuccess('Employee joined date updated successfully');
      await loadEmployees();
      if (selectedEmployee?.id === employeeId) {
        setSelectedEmployee({...selectedEmployee, joined_on_date: newDate});
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateEmployeeProbationPeriod = async (employeeId: string, newPeriod: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ probation_period_months: newPeriod })
        .eq('id', employeeId);
      
      if (error) throw error;
      
      setSuccess('Employee probation period updated successfully');
      await loadEmployees();
      if (selectedEmployee?.id === employeeId) {
        setSelectedEmployee({...selectedEmployee, probation_period_months: newPeriod});
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveEmployeeLeaveSettings = async () => {
    if (!selectedEmployee) return;

    try {
      const settingsData = {
        user_id: selectedEmployee.id,
        custom_leave_days: customLeaveDays,
        is_custom_settings: Object.keys(customLeaveDays).length > 0,
        notes: settingsNotes
      };

      if (employeeLeaveSettings) {
        // Update existing settings
        const { error } = await supabase
          .from('employee_leave_settings')
          .update(settingsData)
          .eq('id', employeeLeaveSettings.id);
        
        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from('employee_leave_settings')
          .insert([settingsData]);
        
        if (error) throw error;
      }
      
      setSuccess('Employee leave settings saved successfully');
      setShowSettingsDialog(false);
      await loadEmployeeLeaveSettings(selectedEmployee.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateCustomLeaveDay = (leaveTypeId: string, days: number) => {
    setCustomLeaveDays(prev => ({
      ...prev,
      [leaveTypeId]: days
    }));
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const getProbationStatus = (employee: Employee) => {
    const joinDate = new Date(employee.joined_on_date);
    const probationEndDate = new Date(joinDate);
    probationEndDate.setMonth(probationEndDate.getMonth() + employee.probation_period_months);
    
    return {
      isOnProbation: new Date() < probationEndDate,
      probationEndDate: probationEndDate.toLocaleDateString(),
      daysRemaining: Math.ceil((probationEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employee Leave Management</h2>
          <p className="text-muted-foreground">
            Manage individual employee leave settings and balances
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Employees</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead>Probation Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const probationStatus = getProbationStatus(employee);
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.employee_category}</Badge>
                    </TableCell>
                    <TableCell>{new Date(employee.joined_on_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={probationStatus.isOnProbation ? "destructive" : "default"}>
                          {probationStatus.isOnProbation ? "On Probation" : "Confirmed"}
                        </Badge>
                        {probationStatus.isOnProbation && (
                          <div className="text-xs text-muted-foreground">
                            Ends: {probationStatus.probationEndDate}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectEmployee(employee)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employee Details Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>Employee Details - {selectedEmployee?.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Employee Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Employee Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emp-name">Name</Label>
                      <Input
                        id="emp-name"
                        value={selectedEmployee.name}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="emp-email">Email</Label>
                      <Input
                        id="emp-email"
                        value={selectedEmployee.email}
                        disabled
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="emp-category">Employee Category</Label>
                      <Select
                        value={selectedEmployee.employee_category}
                        onValueChange={(value) => updateEmployeeCategory(selectedEmployee.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="permanent">Permanent</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                          <SelectItem value="temporary">Temporary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="joined-date">Joined Date</Label>
                      <Input
                        id="joined-date"
                        type="date"
                        value={selectedEmployee.joined_on_date}
                        onChange={(e) => updateEmployeeJoinedDate(selectedEmployee.id, e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="probation-period">Probation Period (months)</Label>
                      <Input
                        id="probation-period"
                        type="number"
                        min="0"
                        value={selectedEmployee.probation_period_months}
                        onChange={(e) => updateEmployeeProbationPeriod(selectedEmployee.id, parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowSettingsDialog(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Custom Leave Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Leave Balances */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Leave Balances ({new Date().getFullYear()})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Total Days</TableHead>
                        <TableHead>Used Days</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Probation Eligible</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeLeaveBalances.map((balance) => (
                        <TableRow key={balance.id}>
                          <TableCell className="font-medium">{balance.leave_type_name}</TableCell>
                          <TableCell>{balance.total_days}</TableCell>
                          <TableCell>{balance.used_days}</TableCell>
                          <TableCell>
                            <Badge variant={balance.remaining_days > 0 ? "default" : "destructive"}>
                              {balance.remaining_days}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={balance.probation_eligible ? "default" : "secondary"}>
                              {balance.probation_eligible ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Leave Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Custom Leave Settings</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="settings-notes">Notes</Label>
              <Input
                id="settings-notes"
                value={settingsNotes}
                onChange={(e) => setSettingsNotes(e.target.value)}
                placeholder="Additional notes for this employee's leave settings"
              />
            </div>
            
            <div>
              <Label>Custom Leave Days Override</Label>
              <div className="space-y-2 mt-2">
                {leaveTypes.map((leaveType) => (
                  <div key={leaveType.id} className="flex items-center space-x-2">
                    <Label htmlFor={`custom-${leaveType.id}`} className="w-32 text-sm">
                      {leaveType.name}:
                    </Label>
                    <Input
                      id={`custom-${leaveType.id}`}
                      type="number"
                      min="0"
                      value={customLeaveDays[leaveType.id] || ''}
                      onChange={(e) => updateCustomLeaveDay(leaveType.id, parseInt(e.target.value) || 0)}
                      placeholder="Override days"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={saveEmployeeLeaveSettings}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLeaveManager;
