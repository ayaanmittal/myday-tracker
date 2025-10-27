import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Calendar,
  Clock,
  UserCheck,
  Building,
  UserCog,
  FileText,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import LeaveStatisticsCards from '@/components/LeaveStatisticsCards';
import EmployeeRankingCard from '@/components/EmployeeRankingCard';
import LeaveDetailsDialog from '@/components/LeaveDetailsDialog';
import { Layout } from '@/components/Layout';
import EmployeeLeaveBalance from '@/components/EmployeeLeaveBalance';
import LeaveRolloverManager from '@/components/LeaveRolloverManager';

interface EmployeeCategory {
  id: string;
  name: string;
  description: string;
  is_paid_leave_eligible: boolean;
  probation_period_months: number;
  is_active: boolean;
}

interface LeaveType {
  id: string;
  name: string;
  description: string;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
}

interface LeavePolicy {
  id: string;
  name: string;
  description: string;
  employee_category_id: string;
  leave_type_id: string;
  max_days_per_year: number;
  probation_max_days: number;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
  employee_category_name?: string;
  leave_type_name?: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  employee_category_id: string;
  employee_category_name?: string;
  joined_on_date: string;
  probation_period_months: number;
  is_on_probation: boolean;
}

const LeaveSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  // Employee Categories
  const [categories, setCategories] = useState<EmployeeCategory[]>([]);
  const [newCategory, setNewCategory] = useState<Partial<EmployeeCategory>>({
    name: '',
    description: '',
    is_paid_leave_eligible: false,
    probation_period_months: 3,
    is_active: true
  });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Leave Types
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [newLeaveType, setNewLeaveType] = useState<Partial<LeaveType>>({
    name: '',
    description: '',
    is_paid: true,
    requires_approval: true,
    is_active: true
  });
  const [editingLeaveType, setEditingLeaveType] = useState<string | null>(null);

  // Leave Policies
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [newPolicy, setNewPolicy] = useState<Partial<LeavePolicy>>({
    name: '',
    description: '',
    employee_category_id: '',
    leave_type_id: '',
    max_days_per_year: 0,
    probation_max_days: 0,
    is_paid: true,
    requires_approval: true,
    is_active: true
  });
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({});
  
  // Selected employee from ranking for showing leave details
  const [selectedEmployeeFromRanking, setSelectedEmployeeFromRanking] = useState<string | null>(null);
  const [showLeaveDetailsDialog, setShowLeaveDetailsDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCategories(),
        loadLeaveTypes(),
        loadPolicies(),
        loadEmployees(),
        loadLeaveRequests()
      ]);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaveRequests = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const { data: requests, error: requestsError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_types(name)
        `)
        .gte('start_date', `${currentYear}-01-01`)
        .lte('start_date', `${currentYear}-12-31`);

      if (requestsError) {
        console.error('Error loading leave requests:', requestsError);
        return;
      }

      const transformedRequests = requests?.map(request => ({
        id: request.id,
        user_id: request.user_id,
        leave_type_id: request.leave_type_id,
        leave_type_name: request.leave_types.name,
        start_date: request.start_date,
        end_date: request.end_date,
        days_requested: request.days_requested,
        reason: request.reason,
        work_from_home: request.work_from_home,
        status: request.status,
        approved_by: request.approved_by,
        approved_at: request.approved_at,
        rejection_reason: request.rejection_reason,
        created_at: request.created_at,
        updated_at: request.updated_at
      })) || [];

      setLeaveRequests(transformedRequests);
    } catch (err: any) {
      console.error('Error loading leave requests:', err);
    }
  };

  // Helper functions for statistics
  const getEmployeeLeaveRequests = (employeeId: string) => {
    return leaveRequests.filter(request => request.user_id === employeeId);
  };

  const getEmployeeRanking = () => {
    return employees
      .map(emp => {
        const employeeRequests = getEmployeeLeaveRequests(emp.id);
        const totalDays = employeeRequests
          .filter(request => request.status === 'approved')
          .reduce((total, request) => total + request.days_requested, 0);
        return {
          employee_id: emp.id,
          employee_name: emp.name,
          employee_email: emp.email,
          employee_category: emp.employee_categories?.name || 'Unknown',
          totalLeavesTaken: totalDays
        };
      })
      .sort((a, b) => b.totalLeavesTaken - a.totalLeavesTaken)
      .slice(0, 10);
  };

  const getSummaryData = () => {
    return employees.map(emp => {
      const employeeRequests = getEmployeeLeaveRequests(emp.id);
      const totalDays = employeeRequests
        .filter(request => request.status === 'approved')
        .reduce((total, request) => total + request.days_requested, 0);
      
      return {
        employee_id: emp.id,
        employee_name: emp.name,
        employee_email: emp.email,
        employee_category: emp.employee_categories?.name || 'Unknown',
        total_allocated: 0, // This would need to be calculated from leave policies
        total_used: totalDays,
        total_remaining: 0, // This would need to be calculated
        is_on_probation: emp.is_on_probation,
        probation_days_used: 0,
        probation_days_remaining: 0
      };
    });
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('employee_categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setCategories(data || []);
  };

  const loadLeaveTypes = async () => {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .order('name');
    
    if (error) throw error;
    setLeaveTypes(data || []);
  };

  const loadPolicies = async () => {
    const { data, error } = await supabase
      .from('leave_policies')
      .select(`
        *,
        employee_categories(name),
        leave_types(name)
      `)
      .order('name');
    
    if (error) throw error;
    
    const policiesWithNames = data?.map(policy => ({
      ...policy,
      employee_category_name: policy.employee_categories?.name,
      leave_type_name: policy.leave_types?.name
    })) || [];
    
    setPolicies(policiesWithNames);
  };

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        employee_category_id,
        joined_on_date,
        probation_period_months,
        employee_categories(name)
      `)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    
    const employeesWithProbation = data?.map(emp => ({
      ...emp,
      employee_category_name: emp.employee_categories?.name,
      is_on_probation: new Date(emp.joined_on_date) > new Date(Date.now() - (emp.probation_period_months || 3) * 30 * 24 * 60 * 60 * 1000)
    })) || [];
    
    setEmployees(employeesWithProbation);
  };

  const saveCategory = async () => {
    if (!newCategory.name) {
      setError('Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('employee_categories')
          .update(newCategory)
          .eq('id', editingCategory);
        
        if (error) throw error;
        setSuccess('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('employee_categories')
          .insert([newCategory]);
        
        if (error) throw error;
        setSuccess('Category created successfully');
      }
      
      setNewCategory({
        name: '',
        description: '',
        is_paid_leave_eligible: false,
        probation_period_months: 3,
        is_active: true
      });
      setEditingCategory(null);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveLeaveType = async () => {
    if (!newLeaveType.name) {
      setError('Leave type name is required');
      return;
    }

    try {
      if (editingLeaveType) {
        const { error } = await supabase
          .from('leave_types')
          .update(newLeaveType)
          .eq('id', editingLeaveType);
        
        if (error) throw error;
        setSuccess('Leave type updated successfully');
      } else {
        const { error } = await supabase
          .from('leave_types')
          .insert([newLeaveType]);
        
        if (error) throw error;
        setSuccess('Leave type created successfully');
      }
      
      setNewLeaveType({
        name: '',
        description: '',
        is_paid: true,
        requires_approval: true,
        is_active: true
      });
      setEditingLeaveType(null);
      await loadLeaveTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const savePolicy = async () => {
    if (!newPolicy.name || !newPolicy.employee_category_id || !newPolicy.leave_type_id) {
      setError('All fields are required');
      return;
    }

    try {
      // Get the actual category and leave type IDs
      const { data: categoryData } = await supabase
        .from('employee_categories')
        .select('id')
        .eq('name', newPolicy.employee_category_id)
        .single();
      
      const { data: leaveTypeData } = await supabase
        .from('leave_types')
        .select('id')
        .eq('name', newPolicy.leave_type_id)
        .single();

      if (!categoryData || !leaveTypeData) {
        setError('Invalid category or leave type selected');
        return;
      }

      const policyData = {
        ...newPolicy,
        employee_category_id: categoryData.id,
        leave_type_id: leaveTypeData.id
      };

      if (editingPolicy) {
        const { error } = await supabase
          .from('leave_policies')
          .update(policyData)
          .eq('id', editingPolicy);
        
        if (error) throw error;
        setSuccess('Policy updated successfully');
      } else {
        const { error } = await supabase
          .from('leave_policies')
          .insert([policyData]);
        
        if (error) throw error;
        setSuccess('Policy created successfully');
      }
      
      setNewPolicy({
        name: '',
        description: '',
        employee_category_id: '',
        leave_type_id: '',
        max_days_per_year: 0,
        probation_max_days: 0,
        is_paid: true,
        requires_approval: true,
        is_active: true
      });
      setEditingPolicy(null);
      await loadPolicies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateEmployee = async (employeeId: string, updates: Partial<Employee>) => {
    try {
      console.log('Updating employee:', employeeId, 'with data:', updates);
      
      // Prepare the update data, ensuring we only update valid fields
      const updateData: any = {};
      
      if (updates.employee_category_id !== undefined && updates.employee_category_id !== '') {
        updateData.employee_category_id = updates.employee_category_id;
      }
      if (updates.joined_on_date !== undefined && updates.joined_on_date !== '') {
        updateData.joined_on_date = updates.joined_on_date;
      }
      if (updates.probation_period_months !== undefined && updates.probation_period_months !== null) {
        updateData.probation_period_months = updates.probation_period_months;
      }

      console.log('Update data:', updateData);

      // Use a more specific update approach
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', employeeId)
        .select();
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      console.log('Update successful:', data);
      
      // Don't call refresh function automatically - let user do it manually
      setSuccess('Employee updated successfully');
      await loadEmployees();
      setShowEmployeeDialog(false);
      setEditingEmployee({});
    } catch (err: any) {
      console.error('Update failed:', err);
      setError(err.message);
    }
  };

  const openEmployeeDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditingEmployee({
      employee_category_id: employee.employee_category_id,
      joined_on_date: employee.joined_on_date,
      probation_period_months: employee.probation_period_months
    });
    setShowEmployeeDialog(true);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leave Settings</h1>
            <p className="text-muted-foreground">
              Configure employee leave policies and categories
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="leave-types" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Leave Types
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="leave-balances" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Leave Balances
            </TabsTrigger>
            <TabsTrigger value="rollover" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Rollover
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Statistics Cards */}
            <LeaveStatisticsCards
              summaryData={getSummaryData()}
              leaveRequests={leaveRequests}
              getEmployeeLeaveRequests={getEmployeeLeaveRequests}
              getEmployeeRanking={getEmployeeRanking}
              showAddLeave={true}
              onAddLeave={() => {
                loadData();
              }}
              onRefresh={() => {
                loadData();
              }}
              loading={loading}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Employee Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{categories.length}</div>
                  <p className="text-sm text-muted-foreground">Active categories</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setActiveTab('categories')}
                  >
                    Manage Categories
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Leave Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{leaveTypes.length}</div>
                  <p className="text-sm text-muted-foreground">Configured types</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setActiveTab('leave-types')}
                  >
                    Manage Types
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-purple-600" />
                    Employees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employees.length}</div>
                  <p className="text-sm text-muted-foreground">Total employees</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setActiveTab('employees')}
                  >
                    Manage Employees
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setActiveTab('categories')}
                  >
                    <Users className="h-6 w-6" />
                    <span>Manage Categories</span>
                    <span className="text-xs text-muted-foreground">Employee types & rules</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => setActiveTab('policies')}
                  >
                    <Settings className="h-6 w-6" />
                    <span>Configure Policies</span>
                    <span className="text-xs text-muted-foreground">Leave rules & allocations</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Top Leave Takers Slider */}
            <EmployeeRankingCard 
              rankings={getEmployeeRanking()}
              onEmployeeClick={(employeeId) => {
                // Show leave details dialog for this employee without switching tabs
                setSelectedEmployeeFromRanking(employeeId);
                setShowLeaveDetailsDialog(true);
              }}
            />

            {/* Leave Details Dialog */}
            <LeaveDetailsDialog 
              employeeId={selectedEmployeeFromRanking}
              isOpen={showLeaveDetailsDialog}
              onClose={() => {
                setShowLeaveDetailsDialog(false);
                setSelectedEmployeeFromRanking(null);
              }}
              year={new Date().getFullYear()}
            />
          </TabsContent>

          {/* Employee Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Employee Categories</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category-name">Name</Label>
                      <Input
                        id="category-name"
                        value={newCategory.name || ''}
                        onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                        placeholder="e.g., Permanent, Intern, Temporary"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category-description">Description</Label>
                      <Input
                        id="category-description"
                        value={newCategory.description || ''}
                        onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                        placeholder="Brief description"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="paid-leave"
                        checked={newCategory.is_paid_leave_eligible || false}
                        onCheckedChange={(checked) => setNewCategory({...newCategory, is_paid_leave_eligible: checked})}
                      />
                      <Label htmlFor="paid-leave">Paid Leave Eligible</Label>
                    </div>
                    
                    <div>
                      <Label htmlFor="probation-period">Probation Period (months)</Label>
                      <Input
                        id="probation-period"
                        type="number"
                        min="0"
                        value={newCategory.probation_period_months || 3}
                        onChange={(e) => setNewCategory({...newCategory, probation_period_months: parseInt(e.target.value) || 3})}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="category-active"
                        checked={newCategory.is_active || false}
                        onCheckedChange={(checked) => setNewCategory({...newCategory, is_active: checked})}
                      />
                      <Label htmlFor="category-active">Active</Label>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button onClick={saveCategory} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {editingCategory ? 'Update' : 'Create'} Category
                    </Button>
                    {editingCategory && (
                      <Button variant="outline" onClick={() => {
                        setEditingCategory(null);
                        setNewCategory({
                          name: '',
                          description: '',
                          is_paid_leave_eligible: false,
                          probation_period_months: 3,
                          is_active: true
                        });
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid Leave</TableHead>
                      <TableHead>Probation Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>{category.description}</TableCell>
                        <TableCell>
                          <Badge variant={category.is_paid_leave_eligible ? "default" : "secondary"}>
                            {category.is_paid_leave_eligible ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{category.probation_period_months} months</TableCell>
                        <TableCell>
                          <Badge variant={category.is_active ? "default" : "secondary"}>
                            {category.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewCategory(category);
                                setEditingCategory(category.id);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{category.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('employee_categories')
                                        .delete()
                                        .eq('id', category.id);
                                      
                                      if (error) throw error;
                                      setSuccess('Category deleted successfully');
                                      await loadCategories();
                                    } catch (err: any) {
                                      setError(err.message);
                                    }
                                  }}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Types Tab */}
          <TabsContent value="leave-types" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Leave Types</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="leave-type-name">Name</Label>
                      <Input
                        id="leave-type-name"
                        value={newLeaveType.name || ''}
                        onChange={(e) => setNewLeaveType({...newLeaveType, name: e.target.value})}
                        placeholder="e.g., Annual Leave, Sick Leave, Personal Leave"
                      />
                    </div>
                    <div>
                      <Label htmlFor="leave-type-description">Description</Label>
                      <Input
                        id="leave-type-description"
                        value={newLeaveType.description || ''}
                        onChange={(e) => setNewLeaveType({...newLeaveType, description: e.target.value})}
                        placeholder="Brief description"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="leave-type-paid"
                        checked={newLeaveType.is_paid || false}
                        onCheckedChange={(checked) => setNewLeaveType({...newLeaveType, is_paid: checked})}
                      />
                      <Label htmlFor="leave-type-paid">Paid Leave</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="leave-type-approval"
                        checked={newLeaveType.requires_approval || false}
                        onCheckedChange={(checked) => setNewLeaveType({...newLeaveType, requires_approval: checked})}
                      />
                      <Label htmlFor="leave-type-approval">Requires Approval</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="leave-type-active"
                        checked={newLeaveType.is_active || false}
                        onCheckedChange={(checked) => setNewLeaveType({...newLeaveType, is_active: checked})}
                      />
                      <Label htmlFor="leave-type-active">Active</Label>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button onClick={saveLeaveType} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {editingLeaveType ? 'Update' : 'Create'} Leave Type
                    </Button>
                    {editingLeaveType && (
                      <Button variant="outline" onClick={() => {
                        setEditingLeaveType(null);
                        setNewLeaveType({
                          name: '',
                          description: '',
                          is_paid: true,
                          requires_approval: true,
                          is_active: true
                        });
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Leave Types</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Requires Approval</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveTypes.map((leaveType) => (
                      <TableRow key={leaveType.id}>
                        <TableCell className="font-medium">{leaveType.name}</TableCell>
                        <TableCell>{leaveType.description}</TableCell>
                        <TableCell>
                          <Badge variant={leaveType.is_paid ? "default" : "secondary"}>
                            {leaveType.is_paid ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={leaveType.requires_approval ? "default" : "secondary"}>
                            {leaveType.requires_approval ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={leaveType.is_active ? "default" : "secondary"}>
                            {leaveType.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewLeaveType(leaveType);
                                setEditingLeaveType(leaveType.id);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{leaveType.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('leave_types')
                                        .delete()
                                        .eq('id', leaveType.id);
                                      
                                      if (error) throw error;
                                      setSuccess('Leave type deleted successfully');
                                      await loadLeaveTypes();
                                    } catch (err: any) {
                                      setError(err.message);
                                    }
                                  }}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Leave Policies</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="policy-name">Policy Name</Label>
                      <Input
                        id="policy-name"
                        value={newPolicy.name || ''}
                        onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})}
                        placeholder="e.g., Annual Leave for Permanent Employees"
                      />
                    </div>
                    <div>
                      <Label htmlFor="policy-description">Description</Label>
                      <Input
                        id="policy-description"
                        value={newPolicy.description || ''}
                        onChange={(e) => setNewPolicy({...newPolicy, description: e.target.value})}
                        placeholder="Brief description"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="policy-category">Employee Category</Label>
                      <Select
                        value={newPolicy.employee_category_id || undefined}
                        onValueChange={(value) => setNewPolicy({...newPolicy, employee_category_id: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="policy-leave-type">Leave Type</Label>
                      <Select
                        value={newPolicy.leave_type_id || undefined}
                        onValueChange={(value) => setNewPolicy({...newPolicy, leave_type_id: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((leaveType) => (
                            <SelectItem key={leaveType.id} value={leaveType.name}>
                              {leaveType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max-days">Max Days Per Year</Label>
                      <Input
                        id="max-days"
                        type="number"
                        min="0"
                        value={newPolicy.max_days_per_year || 0}
                        onChange={(e) => setNewPolicy({...newPolicy, max_days_per_year: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="probation-days">Probation Max Days</Label>
                      <Input
                        id="probation-days"
                        type="number"
                        min="0"
                        value={newPolicy.probation_max_days || 0}
                        onChange={(e) => setNewPolicy({...newPolicy, probation_max_days: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="policy-paid"
                        checked={newPolicy.is_paid || false}
                        onCheckedChange={(checked) => setNewPolicy({...newPolicy, is_paid: checked})}
                      />
                      <Label htmlFor="policy-paid">Paid Leave</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="policy-approval"
                        checked={newPolicy.requires_approval || false}
                        onCheckedChange={(checked) => setNewPolicy({...newPolicy, requires_approval: checked})}
                      />
                      <Label htmlFor="policy-approval">Requires Approval</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="policy-active"
                        checked={newPolicy.is_active || false}
                        onCheckedChange={(checked) => setNewPolicy({...newPolicy, is_active: checked})}
                      />
                      <Label htmlFor="policy-active">Active</Label>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button onClick={savePolicy} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {editingPolicy ? 'Update' : 'Create'} Policy
                    </Button>
                    {editingPolicy && (
                      <Button variant="outline" onClick={() => {
                        setEditingPolicy(null);
                        setNewPolicy({
                          name: '',
                          description: '',
                          employee_category_id: '',
                          leave_type_id: '',
                          max_days_per_year: 0,
                          probation_max_days: 0,
                          is_paid: true,
                          requires_approval: true,
                          is_active: true
                        });
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Max Days</TableHead>
                      <TableHead>Probation Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">{policy.name}</TableCell>
                        <TableCell>{policy.employee_category_name}</TableCell>
                        <TableCell>{policy.leave_type_name}</TableCell>
                        <TableCell>{policy.max_days_per_year}</TableCell>
                        <TableCell>{policy.probation_max_days}</TableCell>
                        <TableCell>
                          <Badge variant={policy.is_active ? "default" : "secondary"}>
                            {policy.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewPolicy(policy);
                                setEditingPolicy(policy.id);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Policy</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{policy.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('leave_policies')
                                        .delete()
                                        .eq('id', policy.id);
                                      
                                      if (error) throw error;
                                      setSuccess('Policy deleted successfully');
                                      await loadPolicies();
                                    } catch (err: any) {
                                      setError(err.message);
                                    }
                                  }}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  Employee Management
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage employee categories, join dates, and probation periods
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Joined Date</TableHead>
                        <TableHead>Probation Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-sm text-muted-foreground">{employee.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {employee.employee_category_name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(employee.joined_on_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.is_on_probation ? "destructive" : "default"}>
                              {employee.is_on_probation ? "On Probation" : "Confirmed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openEmployeeDialog(employee)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Employee Edit Dialog */}
            <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Employee Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="emp-name">Employee Name</Label>
                    <Input
                      id="emp-name"
                      value={selectedEmployee?.name || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="emp-category">Employee Category</Label>
                    <Select
                      value={editingEmployee.employee_category_id || undefined}
                      onValueChange={(value) => setEditingEmployee({...editingEmployee, employee_category_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="joined-date">Joined Date</Label>
                    <Input
                      id="joined-date"
                      type="date"
                      value={editingEmployee.joined_on_date || ''}
                      onChange={(e) => setEditingEmployee({...editingEmployee, joined_on_date: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="probation-period">Probation Period (months)</Label>
                    <Input
                      id="probation-period"
                      type="number"
                      min="0"
                      value={editingEmployee.probation_period_months || 0}
                      onChange={(e) => setEditingEmployee({...editingEmployee, probation_period_months: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowEmployeeDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => selectedEmployee && updateEmployee(selectedEmployee.id, editingEmployee)}
                      disabled={loading}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Leave Balances Tab */}
          <TabsContent value="leave-balances" className="space-y-4">
            <EmployeeLeaveBalance selectedEmployeeId={selectedEmployeeFromRanking} />
          </TabsContent>

          {/* Leave Rollover Tab */}
          <TabsContent value="rollover" className="space-y-4">
            <LeaveRolloverManager />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default LeaveSettings;