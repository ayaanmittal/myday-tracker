import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { User, Users, Settings, ArrowRight, Calendar, Edit, Clock, FileText, Phone, MapPin, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { EmployeeNotesDialog } from '@/components/EmployeeNotesDialog';
import { EmployeeDetailsDialog } from '@/components/EmployeeDetailsDialog';
import { EmployeeNotesService } from '@/services/employeeNotesService';
import { RulesAgreementService, RulesAgreementData } from '@/services/rulesAgreementService';

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

interface EmployeeWithNoteCount extends Employee {
  noteCount: number;
  rulesAgreement?: RulesAgreementData;
}

export default function Employees() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithNoteCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeRules, setSelectedEmployeeRules] = useState<RulesAgreementData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    team: '',
    designation: ''
  });

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

      // Fetch note counts and rules agreement data for each employee
      const employeesWithNoteCounts = await Promise.all(
        (employeesWithRoles || []).map(async (employee) => {
          const noteCount = await EmployeeNotesService.getEmployeeNoteCount(employee.id);
          
          // Only fetch rules agreement data for admins
          let rulesAgreement: RulesAgreementData | undefined;
          if (role === 'admin') {
            rulesAgreement = await RulesAgreementService.getRulesAgreementData(employee.id);
          }
          
          return {
            ...employee,
            noteCount,
            rulesAgreement
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

  const openDetailsDialog = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      address: employee.address || '',
      team: employee.team || '',
      designation: employee.designation || ''
    });
    
    // Fetch rules agreement data for the selected employee if user is admin
    if (role === 'admin') {
      const rulesData = await RulesAgreementService.getRulesAgreementData(employee.id);
      setSelectedEmployeeRules(rulesData);
    }
    
    setDetailsDialogOpen(true);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          address: editForm.address || null,
          team: editForm.team || null,
          designation: editForm.designation || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id 
          ? { ...emp, ...editForm }
          : emp
      ));

      toast({
        title: "Success",
        description: "Employee details updated successfully",
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: "Error",
        description: "Failed to update employee details",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (selectedEmployee) {
      setEditForm({
        name: selectedEmployee.name,
        email: selectedEmployee.email,
        phone: selectedEmployee.phone || '',
        address: selectedEmployee.address || '',
        team: selectedEmployee.team || '',
        designation: selectedEmployee.designation || ''
      });
    }
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
        <div className={`grid grid-cols-1 gap-6 ${role === 'admin' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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

          {/* Rules Compliance Stats - Only visible to admins */}
          {role === 'admin' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rules Compliance</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {employees.filter(emp => 
                    emp.rulesAgreement && 
                    RulesAgreementService.isFullyCompliant(emp.rulesAgreement)
                  ).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Fully compliant
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {employees.filter(emp => 
                    emp.rulesAgreement && 
                    !RulesAgreementService.isFullyCompliant(emp.rulesAgreement)
                  ).length} need attention
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Employees Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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

                {/* Rules Agreement Status - Only visible to admins */}
                {role === 'admin' && employee.rulesAgreement && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Rules Compliance</span>
                      <Badge 
                        variant={
                          RulesAgreementService.isFullyCompliant(employee.rulesAgreement) 
                            ? 'default' 
                            : RulesAgreementService.getComplianceStatus(employee.rulesAgreement).status === 'partial'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className={
                          RulesAgreementService.isFullyCompliant(employee.rulesAgreement)
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : RulesAgreementService.getComplianceStatus(employee.rulesAgreement).status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }
                      >
                        {RulesAgreementService.getComplianceStatus(employee.rulesAgreement).message}
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Contract:</span>
                        <span className={employee.rulesAgreement.hasSignedContract ? 'text-green-600' : 'text-red-600'}>
                          {employee.rulesAgreement.hasSignedContract ? '✓ Signed' : '✗ Not signed'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rules:</span>
                        <span>
                          {employee.rulesAgreement.acknowledgedRulesCount}/{employee.rulesAgreement.totalActiveRulesCount}
                        </span>
                      </div>
                      {employee.rulesAgreement.contractSignedAt && (
                        <div className="text-xs text-muted-foreground">
                          Signed: {new Date(employee.rulesAgreement.contractSignedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
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
                  
                  <div className="flex gap-2">
                    <EmployeeDetailsDialog
                      employeeId={employee.id}
                      employeeName={employee.name}
                      onSaved={fetchEmployees}
                      trigger={
                        <Button size="sm" variant="outline" className="text-xs">
                          <User className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      }
                    />
                    
                    {(role === 'admin' || role === 'manager') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/history?employee=${employee.id}`)}
                          className="text-xs"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          History
                        </Button>
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
                      </>
                    )}
                  </div>
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

        {/* Employee Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee Details</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Edit employee information' : 'View employee information'}
              </DialogDescription>
            </DialogHeader>
            
            {selectedEmployee && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    {isEditing ? (
                      <Input
                        id="name"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <User className="h-4 w-4" />
                        <span>{selectedEmployee.name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <Mail className="h-4 w-4" />
                        <span>{selectedEmployee.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    {isEditing ? (
                      <Input
                        id="phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <Phone className="h-4 w-4" />
                        <span>{selectedEmployee.phone || 'Not provided'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    {isEditing ? (
                      <Textarea
                        id="address"
                        value={editForm.address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter address"
                        rows={2}
                      />
                    ) : (
                      <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span>{selectedEmployee.address || 'Not provided'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Work Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="team">Team</Label>
                    {isEditing ? (
                      <Input
                        id="team"
                        value={editForm.team}
                        onChange={(e) => setEditForm(prev => ({ ...prev, team: e.target.value }))}
                        placeholder="Enter team"
                      />
                    ) : (
                      <div className="p-2 bg-muted rounded-md">
                        <span>{selectedEmployee.team || 'Not assigned'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    {isEditing ? (
                      <Input
                        id="designation"
                        value={editForm.designation}
                        onChange={(e) => setEditForm(prev => ({ ...prev, designation: e.target.value }))}
                        placeholder="Enter designation"
                      />
                    ) : (
                      <div className="p-2 bg-muted rounded-md">
                        <span>{selectedEmployee.designation || 'Not specified'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Role and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="p-2 bg-muted rounded-md">
                      <Badge variant={getRoleBadgeVariant(selectedEmployee.role)} className="capitalize">
                        {selectedEmployee.role}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="p-2 bg-muted rounded-md">
                      <Badge
                        variant={selectedEmployee.is_active ? 'default' : 'secondary'}
                        className={
                          selectedEmployee.is_active
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : ''
                        }
                      >
                        {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Rules Agreement Details - Only visible to admins */}
                {role === 'admin' && selectedEmployeeRules && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Rules Agreement Status</Label>
                      <div className="p-4 bg-muted rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Overall Compliance:</span>
                          <Badge 
                            variant={
                              RulesAgreementService.isFullyCompliant(selectedEmployeeRules) 
                                ? 'default' 
                                : RulesAgreementService.getComplianceStatus(selectedEmployeeRules).status === 'partial'
                                ? 'secondary'
                                : 'destructive'
                            }
                            className={
                              RulesAgreementService.isFullyCompliant(selectedEmployeeRules)
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : RulesAgreementService.getComplianceStatus(selectedEmployeeRules).status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }
                          >
                            {RulesAgreementService.getComplianceStatus(selectedEmployeeRules).message}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Contract Signed:</span>
                              <span className={selectedEmployeeRules.hasSignedContract ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {selectedEmployeeRules.hasSignedContract ? '✓ Yes' : '✗ No'}
                              </span>
                            </div>
                            {selectedEmployeeRules.contractSignedAt && (
                              <div className="text-xs text-muted-foreground">
                                Signed on: {new Date(selectedEmployeeRules.contractSignedAt).toLocaleDateString()}
                              </div>
                            )}
                            {selectedEmployeeRules.contractInitials && (
                              <div className="text-xs text-muted-foreground">
                                Initials: {selectedEmployeeRules.contractInitials}
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Rules Acknowledged:</span>
                              <span className="font-medium">
                                {selectedEmployeeRules.acknowledgedRulesCount}/{selectedEmployeeRules.totalActiveRulesCount}
                              </span>
                            </div>
                            {selectedEmployeeRules.lastAcknowledgmentAt && (
                              <div className="text-xs text-muted-foreground">
                                Last acknowledgment: {new Date(selectedEmployeeRules.lastAcknowledgmentAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {selectedEmployeeRules.unacknowledgedRules.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-red-600">Unacknowledged Rules:</span>
                            <div className="space-y-1">
                              {selectedEmployeeRules.unacknowledgedRules.map((rule) => (
                                <div key={rule.id} className="text-xs text-muted-foreground p-2 bg-red-50 rounded border-l-2 border-red-200">
                                  <div className="font-medium">{rule.title}</div>
                                  <div className="text-xs mt-1">{rule.description}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                        Close
                      </Button>
                      {(role === 'admin' || role === 'manager') && (
                        <Button onClick={handleEdit}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Details
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
