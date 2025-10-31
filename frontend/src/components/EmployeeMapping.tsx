import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  getTeamOfficeEmployees, 
  getEmployeeMappings, 
  getUnmappedEmployees, 
  createEmployeeMapping, 
  deleteEmployeeMapping,
  syncTeamOfficeEmployees,
  fetchTeamOfficeEmployees,
  type EmployeeMapping,
  type UnmappedEmployee 
} from '@/services/teamOfficeEmployeesClient';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, RefreshCw, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

export function EmployeeMapping() {
  const [teamofficeEmployees, setTeamofficeEmployees] = useState<any[]>([]);
  const [mappings, setMappings] = useState<EmployeeMapping[]>([]);
  const [unmappedEmployees, setUnmappedEmployees] = useState<UnmappedEmployee[]>([]);
  const [ourUsers, setOurUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UnmappedEmployee | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamofficeData, mappingsData, unmappedData, usersData] = await Promise.all([
        getTeamOfficeEmployees(),
        getEmployeeMappings(),
        getUnmappedEmployees(),
        supabase.from('profiles').select('id, name, email').eq('is_active', true)
      ]);

      setTeamofficeEmployees(teamofficeData);
      setMappings(mappingsData);
      setUnmappedEmployees(unmappedData);
      setOurUsers(usersData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncEmployees = async () => {
    setLoading(true);
    try {
      const employees = await fetchTeamOfficeEmployees();
      await syncTeamOfficeEmployees(employees);
      await loadData();
      toast({
        title: 'Success',
        description: 'TeamOffice employees synced successfully',
      });
    } catch (error) {
      console.error('Error syncing employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync employees',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMapping = async () => {
    if (!selectedEmployee || !selectedUserId) return;

    setLoading(true);
    try {
      await createEmployeeMapping(selectedEmployee.emp_code, selectedUserId);
      await loadData();
      setIsDialogOpen(false);
      setSelectedEmployee(null);
      setSelectedUserId('');
      toast({
        title: 'Success',
        description: 'Employee mapping created successfully',
      });
    } catch (error) {
      console.error('Error creating mapping:', error);
      toast({
        title: 'Error',
        description: 'Failed to create mapping',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    setLoading(true);
    try {
      await deleteEmployeeMapping(mappingId);
      await loadData();
      toast({
        title: 'Success',
        description: 'Employee mapping deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete mapping',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openMappingDialog = (employee: UnmappedEmployee) => {
    setSelectedEmployee(employee);
    setSelectedUserId('');
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading employee data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Employee Mapping</h2>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSyncEmployees}>
            <Users className="h-4 w-4 mr-2" />
            Sync TeamOffice Employees
          </Button>
        </div>
      </div>

      <Tabs defaultValue="unmapped" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unmapped">
            Unmapped ({unmappedEmployees.length})
          </TabsTrigger>
          <TabsTrigger value="mapped">
            Mapped ({mappings.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All TeamOffice ({teamofficeEmployees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unmapped">
          <Card>
            <CardHeader>
              <CardTitle>Unmapped Employees</CardTitle>
              <CardDescription>
                TeamOffice employees that need to be mapped to our users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unmappedEmployees.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All employees are mapped!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {unmappedEmployees.map((employee) => (
                    <Card key={employee.emp_code} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{employee.name}</h4>
                            <Badge variant="outline">{employee.emp_code}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {employee.email && <p>Email: {employee.email}</p>}
                            {employee.department && <p>Department: {employee.department}</p>}
                            {employee.designation && <p>Designation: {employee.designation}</p>}
                          </div>
                          {employee.suggested_matches.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium mb-2">Suggested matches:</p>
                              <div className="space-y-1">
                                {employee.suggested_matches.map((match, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span>{match.name} ({match.email})</span>
                                    <Badge variant="secondary">
                                      {Math.round(match.match_score * 100)}% match
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button onClick={() => openMappingDialog(employee)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Map Employee
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapped">
          <Card>
            <CardHeader>
              <CardTitle>Mapped Employees</CardTitle>
              <CardDescription>
                TeamOffice employees that are mapped to our users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mappings found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mappings.map((mapping) => (
                    <Card key={mapping.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{mapping.teamoffice_name}</h4>
                            <Badge variant="outline">{mapping.teamoffice_emp_code}</Badge>
                            <Badge variant="secondary">→</Badge>
                            <span className="font-medium">{mapping.our_name || 'Unknown'}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Our User ID: {mapping.our_user_id}</p>
                            {mapping.our_email && <p>Our Email: {mapping.our_email}</p>}
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleDeleteMapping(mapping.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All TeamOffice Employees</CardTitle>
              <CardDescription>
                Complete list of employees from TeamOffice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teamofficeEmployees.map((employee) => (
                  <div key={employee.emp_code} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{employee.name}</span>
                        <Badge variant="outline">{employee.emp_code}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {employee.email && <span>{employee.email}</span>}
                        {employee.department && <span> • {employee.department}</span>}
                      </div>
                    </div>
                    <Badge variant={employee.is_active ? "default" : "secondary"}>
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mapping Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map Employee</DialogTitle>
            <DialogDescription>
              Map TeamOffice employee to one of our users
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <Label>TeamOffice Employee</Label>
                <div className="p-3 border rounded bg-muted">
                  <div className="font-medium">{selectedEmployee.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedEmployee.emp_code} • {selectedEmployee.email}
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="user-select">Select Our User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user to map to" />
                  </SelectTrigger>
                  <SelectContent>
                    {ourUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMapping} disabled={!selectedUserId}>
                  Create Mapping
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
