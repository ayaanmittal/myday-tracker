import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, Home, Calendar, User, AlertCircle, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  work_from_home: boolean;
  status: string;
  created_at: string;
  leave_types: {
    id: string;
    name: string;
    is_paid: boolean;
  };
}

interface Leave {
  id: string;
  user_id: string;
  profile_id: string;
  leave_date: string;
  leave_type_id: string;
  leave_type_name: string;
  is_paid_leave: boolean;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  leave_request_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function LeaveApproval() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [leaveTypes, setLeaveTypes] = useState<Array<{id: string, name: string, is_paid: boolean}>>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [leaveFilter, setLeaveFilter] = useState('all');
  
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Add manual leave dialog state
  const [showAddLeaveDialog, setShowAddLeaveDialog] = useState(false);
  const [addLeaveForm, setAddLeaveForm] = useState({
    user_id: '',
    leave_date: '',
    end_date: '',
    leave_type_name: '',
    is_paid_leave: true,
    notes: '',
    is_date_range: false
  });
  
  // Employee leave history dialog state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [employeeLeaves, setEmployeeLeaves] = useState<Leave[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'admin') {
      navigate('/today');
      return;
    }

    fetchLeaveRequests();
    fetchLeaves();
    fetchAllEmployees();
    fetchLeaveTypes();
  }, [user, role, roleLoading, navigate]);

  const fetchAllEmployees = async () => {
    try {
      // Fetch all employees including managers for the dropdown
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .order('name');

      if (profilesError) {
        console.warn('Error fetching all employees:', profilesError);
      } else if (profilesData) {
        const profilesMap = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, UserProfile>);
        setUserProfiles(profilesMap);
      }
    } catch (error: any) {
      console.error('Error fetching all employees:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const { data: leaveTypesData, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('id, name, is_paid')
        .order('name');

      if (leaveTypesError) {
        console.warn('Error fetching leave types:', leaveTypesError);
      } else if (leaveTypesData) {
        setLeaveTypes(leaveTypesData);
      }
    } catch (error: any) {
      console.error('Error fetching leave types:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      
      // Check if tables exist first
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_types (id, name, is_paid)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // If tables don't exist, show helpful message
        if (error.message.includes('relation "leave_requests" does not exist')) {
          toast({
            title: 'Leave System Not Set Up',
            description: 'Please run the database migration to set up the leave management system.',
            variant: 'destructive',
          });
          setLeaveRequests([]);
          return;
        }
        throw error;
      }
      
      setLeaveRequests(data || []);

    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch leave requests',
        variant: 'destructive',
      });
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!user) return;

    setProcessing(requestId);

    try {
      // Use the fresh database function
      const { data, error } = await supabase.rpc('approve_leave_request', {
        p_request_id: requestId,
        p_approved_by: user.id
      });

      if (error) {
        console.error('Error approving leave request:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve leave request');
      }

      toast({
        title: 'Leave Approved',
        description: data.message || 'The leave request has been approved successfully.',
      });

      fetchLeaveRequests();
      setSelectedRequest(null);
      setAction(null);

    } catch (error: any) {
      console.error('Error approving leave:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve leave request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user) return;

    setProcessing(requestId);

    try {
      // Use the fresh database function
      const { data, error } = await supabase.rpc('reject_leave_request', {
        p_request_id: requestId,
        p_rejected_by: user.id,
        p_rejection_reason: rejectionReason
      });

      if (error) {
        console.error('Error rejecting leave request:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject leave request');
      }

      toast({
        title: 'Leave Rejected',
        description: data.message || 'The leave request has been rejected.',
      });

      fetchLeaveRequests();
      setSelectedRequest(null);
      setAction(null);
      setRejectionReason('');

    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject leave request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const fetchLeaves = async () => {
    try {
      // First, try to fetch leaves without join
      const { data: leavesData, error: leavesError } = await supabase
        .from('leaves')
        .select('*')
        .order('leave_date', { ascending: false });

      if (leavesError) {
        console.error('Error fetching leaves:', leavesError);
        
        // Check if it's a table doesn't exist error
        if (leavesError.message.includes('relation "leaves" does not exist')) {
          toast({
            title: 'Leaves Table Not Found',
            description: 'The leaves table does not exist. Please run the database migration to create it.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: `Failed to fetch leaves: ${leavesError.message}`,
            variant: 'destructive',
          });
        }
        return;
      }
      
      console.log('Fetched leaves:', leavesData);
      console.log('Number of leaves found:', leavesData?.length || 0);
      setLeaves(leavesData || []);

      // If we have leaves, fetch user profiles separately
      if (leavesData && leavesData.length > 0) {
        // Try both user_id and profile_id approaches
        const userIds = [...new Set(leavesData.map(leave => leave.user_id))];
        const profileIds = [...new Set(leavesData.map(leave => leave.profile_id))];
        
        // First try with user_id
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, user_id')
          .in('user_id', userIds);

        if (profilesError) {
          console.warn('Error fetching user profiles by user_id:', profilesError);
          // Try with profile_id as fallback
          const { data: profilesData2, error: profilesError2 } = await supabase
            .from('profiles')
            .select('id, name, email, user_id')
            .in('id', profileIds);

          if (profilesError2) {
            console.warn('Error fetching user profiles by profile_id:', profilesError2);
          } else if (profilesData2) {
            const profilesMap = profilesData2.reduce((acc, profile) => {
              acc[profile.user_id] = { id: profile.id, name: profile.name, email: profile.email };
              return acc;
            }, {} as Record<string, UserProfile>);
            setUserProfiles(prev => ({ ...prev, ...profilesMap }));
          }
        } else if (profilesData) {
          const profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.user_id] = { id: profile.id, name: profile.name, email: profile.email };
            return acc;
          }, {} as Record<string, UserProfile>);
          setUserProfiles(prev => ({ ...prev, ...profilesMap }));
        }
      }

    } catch (error: any) {
      console.error('Error fetching leaves:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch leaves',
        variant: 'destructive',
      });
    }
  };

  const handleAddManualLeave = async () => {
    // Validate required fields
    if (!user || !addLeaveForm.user_id || !addLeaveForm.leave_date || !addLeaveForm.leave_type_name) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Validate date range if enabled
    if (addLeaveForm.is_date_range && (!addLeaveForm.end_date || addLeaveForm.end_date < addLeaveForm.leave_date)) {
      toast({
        title: 'Error',
        description: 'End date must be after start date',
        variant: 'destructive',
      });
      return;
    }

    setProcessing('add-leave');

    try {
      if (addLeaveForm.is_date_range) {
        // Add leave for date range
        const startDate = new Date(addLeaveForm.leave_date);
        const endDate = new Date(addLeaveForm.end_date);
        
        console.log('Date range:', { startDate, endDate, start: addLeaveForm.leave_date, end: addLeaveForm.end_date });
        
        // Generate all dates in the range
        const dates = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          dates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log('Generated dates:', dates);

        // Add leave for each date
        let successCount = 0;
        let errorCount = 0;
        for (const date of dates) {
          console.log(`Adding leave for ${date}...`);
          const { data, error } = await supabase
            .rpc('add_manual_leave', {
              p_user_id: addLeaveForm.user_id,
              p_leave_date: date,
              p_leave_type_name: addLeaveForm.leave_type_name,
              p_is_paid_leave: addLeaveForm.is_paid_leave,
              p_reason: addLeaveForm.notes || null,
              p_approved_by: user.id
            });

          if (error) {
            console.error(`Error adding leave for ${date}:`, error);
            errorCount++;
          } else if (data && data[0]?.success) {
            console.log(`Successfully added leave for ${date}`);
            successCount++;
          } else {
            console.error(`Failed to add leave for ${date}:`, data);
            errorCount++;
          }
        }

        console.log(`Final result: ${successCount} successful, ${errorCount} errors`);

        toast({
          title: successCount > 0 ? 'Success' : 'Error',
          description: `Added ${successCount} days of leave from ${addLeaveForm.leave_date} to ${addLeaveForm.end_date}${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
          variant: successCount > 0 ? 'default' : 'destructive',
        });
      } else {
        // Add single day leave
        const { data, error } = await supabase
          .rpc('add_manual_leave', {
            p_user_id: addLeaveForm.user_id,
            p_leave_date: addLeaveForm.leave_date,
            p_leave_type_name: addLeaveForm.leave_type_name,
            p_is_paid_leave: addLeaveForm.is_paid_leave,
            p_reason: addLeaveForm.notes || null,
            p_approved_by: user.id
          });

        if (error) throw error;

        if (data && data[0]?.success) {
          toast({
            title: 'Success',
            description: 'Leave added successfully',
          });
        } else {
          throw new Error(data?.[0]?.message || 'Failed to add leave');
        }
      }
      
      setAddLeaveForm({
        user_id: '',
        leave_date: '',
        end_date: '',
        leave_type_name: '',
        is_paid_leave: true,
        notes: '',
        is_date_range: false
      });
      setShowAddLeaveDialog(false);
      fetchLeaves();

    } catch (error: any) {
      console.error('Error adding leave:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add leave',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to delete this leave?')) return;

    setProcessing(leaveId);

    try {
      const { error } = await supabase
        .from('leaves')
        .delete()
        .eq('id', leaveId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Leave deleted successfully',
      });

      fetchLeaves();
      // Refresh employee leaves if viewing an employee
      if (selectedEmployee) {
        fetchEmployeeLeaves(selectedEmployee);
      }

    } catch (error: any) {
      console.error('Error deleting leave:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete leave',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteLeaveGroup = async (leaveGroup: any) => {
    const leaveCount = leaveGroup.individual_leaves.length;
    const startDate = leaveGroup.start_date;
    const endDate = leaveGroup.end_date;
    
    if (!confirm(`Are you sure you want to delete this leave period (${startDate} to ${endDate})? This will delete ${leaveCount} leave record(s).`)) return;

    setProcessing(leaveGroup.id);

    try {
      // Delete all individual leaves in this group
      const leaveIds = leaveGroup.individual_leaves.map((leave: Leave) => leave.id);
      
      const { error } = await supabase
        .from('leaves')
        .delete()
        .in('id', leaveIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Leave period deleted successfully (${leaveCount} record(s) removed)`,
      });

      fetchLeaves();
      // Refresh employee leaves if viewing an employee
      if (selectedEmployee) {
        fetchEmployeeLeaves(selectedEmployee);
      }

    } catch (error: any) {
      console.error('Error deleting leave group:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete leave period',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const fetchEmployeeLeaves = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .order('leave_date', { ascending: false });

      if (error) {
        console.error('Error fetching employee leaves:', error);
        return;
      }
      
      // Group consecutive leaves into date ranges
      const groupedLeaves = groupConsecutiveLeaves(data || []);
      setEmployeeLeaves(groupedLeaves);
    } catch (error: any) {
      console.error('Error fetching employee leaves:', error);
    }
  };

  const groupConsecutiveLeaves = (leaves: Leave[]) => {
    if (leaves.length === 0) return [];

    // Sort leaves by date
    const sortedLeaves = [...leaves].sort((a, b) => 
      new Date(a.leave_date).getTime() - new Date(b.leave_date).getTime()
    );

    const grouped: any[] = [];
    let currentGroup: any = null;

    for (const leave of sortedLeaves) {
      if (!currentGroup) {
        // Start a new group
        currentGroup = {
          id: leave.id,
          user_id: leave.user_id,
          leave_type_name: leave.leave_type_name,
          is_paid_leave: leave.is_paid_leave,
          is_approved: leave.is_approved,
          approved_by: leave.approved_by,
          approved_at: leave.approved_at,
          created_at: leave.created_at,
          notes: leave.notes,
          start_date: leave.leave_date,
          end_date: leave.leave_date,
          duration: 1,
          individual_leaves: [leave]
        };
      } else {
        // Check if this leave can be grouped with the current group
        const currentEndDate = new Date(currentGroup.end_date);
        const leaveDate = new Date(leave.leave_date);
        const dayDifference = (leaveDate.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60 * 24);

        if (
          leave.leave_type_name === currentGroup.leave_type_name &&
          leave.is_paid_leave === currentGroup.is_paid_leave &&
          dayDifference === 1 // Consecutive day
        ) {
          // Extend the current group
          currentGroup.end_date = leave.leave_date;
          currentGroup.duration += 1;
          currentGroup.individual_leaves.push(leave);
        } else {
          // Save current group and start a new one
          grouped.push(currentGroup);
          currentGroup = {
            id: leave.id,
            user_id: leave.user_id,
            leave_type_name: leave.leave_type_name,
            is_paid_leave: leave.is_paid_leave,
            is_approved: leave.is_approved,
            approved_by: leave.approved_by,
            approved_at: leave.approved_at,
            created_at: leave.created_at,
            notes: leave.notes,
            start_date: leave.leave_date,
            end_date: leave.leave_date,
            duration: 1,
            individual_leaves: [leave]
          };
        }
      }
    }

    // Don't forget to add the last group
    if (currentGroup) {
      grouped.push(currentGroup);
    }

    // Sort by start date (newest first)
    return grouped.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  };

  const handleEmployeeClick = (userId: string) => {
    setSelectedEmployee(userId);
    fetchEmployeeLeaves(userId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = leaveRequests.filter(request => {
    if (filter === 'all') return true;
    return request.status === filter;
  });

  // Group leaves by employee to show employee-based view
  const employeeLeaveSummary = leaves.reduce((acc, leave) => {
    if (!acc[leave.user_id]) {
      acc[leave.user_id] = {
        user_id: leave.user_id,
        total_leaves: 0,
        paid_leaves: 0,
        unpaid_leaves: 0,
        leave_dates: [],
        leave_types: new Set(),
        latest_leave: null
      };
    }
    
    acc[leave.user_id].total_leaves++;
    acc[leave.user_id].leave_dates.push(leave.leave_date);
    acc[leave.user_id].leave_types.add(leave.leave_type_name);
    
    if (leave.is_paid_leave) {
      acc[leave.user_id].paid_leaves++;
    } else {
      acc[leave.user_id].unpaid_leaves++;
    }
    
    // Keep track of latest leave
    if (!acc[leave.user_id].latest_leave || new Date(leave.leave_date) > new Date(acc[leave.user_id].latest_leave.leave_date)) {
      acc[leave.user_id].latest_leave = leave;
    }
    
    return acc;
  }, {} as Record<string, any>);

  // Convert to array and filter
  const filteredEmployees = Object.values(employeeLeaveSummary).filter((employee: any) => {
    if (leaveFilter === 'all') return true;
    if (leaveFilter === 'paid') return employee.paid_leaves > 0;
    if (leaveFilter === 'unpaid') return employee.unpaid_leaves > 0;
    return true;
  });

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">Leaves Management</h1>
          <p className="text-gray-300 text-base sm:text-lg font-medium">Manage employee leaves and approve leave requests</p>
        </div>

        <Tabs defaultValue="leaves" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaves">All Leaves</TabsTrigger>
            <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="leaves" className="space-y-6">
            {/* All Leaves Tab */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <Select value={leaveFilter} onValueChange={setLeaveFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leaves</SelectItem>
                    <SelectItem value="paid">Paid Leaves</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leaves</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={() => setShowAddLeaveDialog(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Leave</span>
              </Button>
            </div>

            {/* Employee Leave Summary */}
            <div className="space-y-4">
              {filteredEmployees.length === 0 ? (
                <Card className="elegant-card elegant-shadow">
                  <CardContent className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No employees with leaves found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredEmployees.map((employee: any) => (
                  <Card 
                    key={employee.user_id} 
                    className="elegant-card elegant-shadow cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleEmployeeClick(employee.user_id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-lg text-gray-900">{userProfiles[employee.user_id]?.name || 'Unknown User'}</h3>
                              <Badge className="bg-blue-100 text-blue-800">
                                {employee.total_leaves} leave{employee.total_leaves !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <p className="text-gray-600">{userProfiles[employee.user_id]?.email || 'No email'}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-gray-700">{employee.paid_leaves} paid</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-gray-700">{employee.unpaid_leaves} unpaid</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4 text-gray-600" />
                                <span className="text-sm text-gray-700">
                                  Latest: {employee.latest_leave ? new Date(employee.latest_leave.leave_date).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="text-sm text-gray-600">
                                Leave types: {Array.from(employee.leave_types).join(', ')}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">Click to view details</p>
                            <p className="text-sm text-gray-700">
                              View leave history
                            </p>
                            <p className="text-xs text-gray-700 font-medium">
                              {employee.total_leaves} total entries
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmployeeClick(employee.user_id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            {/* Leave Requests Tab */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {pendingCount > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 text-lg px-4 py-2">
              {pendingCount} Pending Requests
            </Badge>
          )}
        </div>

            {/* Leave Requests List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card className="elegant-card elegant-shadow">
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No leave requests found</p>
              </CardContent>
            </Card>
          ) : (
            filteredRequests.map((request) => (
              <Card key={request.id} className="elegant-card elegant-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(request.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg text-gray-900">{userProfiles[request.user_id]?.name || 'Unknown User'}</h3>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-gray-600">{userProfiles[request.user_id]?.email || 'No email'}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-600" />
                            <span className="text-sm">
                              {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-gray-600" />
                            <span className="text-sm">{request.days_requested} days</span>
                          </div>
                          {request.work_from_home && (
                            <div className="flex items-center space-x-1">
                              <Home className="h-4 w-4 text-blue-500" />
                              <span className="text-sm text-blue-600">Work from home</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">{request.leave_types.name}</p>
                        <p className="text-sm text-gray-600">
                          Leave Request
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {request.status === 'pending' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setAction(null);
                              }}
                            >
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Leave Request Review</DialogTitle>
                              <DialogDescription>
                                Review and approve or reject this leave request
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <Label className="text-sm font-semibold">Employee</Label>
                                  <p className="text-lg font-medium text-gray-900">{userProfiles[request.user_id]?.name || 'Unknown User'}</p>
                                  <p className="text-sm text-gray-600">{userProfiles[request.user_id]?.email || 'No email'}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold">Leave Type</Label>
                                  <p className="text-lg font-medium">{request.leave_types.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Leave Request
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <Label className="text-sm font-semibold">Start Date</Label>
                                  <p className="text-lg">{new Date(request.start_date).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold">End Date</Label>
                                  <p className="text-lg">{new Date(request.end_date).toLocaleDateString()}</p>
                                </div>
                              </div>

                              <div>
                                <Label className="text-sm font-semibold">Duration</Label>
                                <p className="text-lg">{request.days_requested} days</p>
                              </div>

                              {request.work_from_home && (
                                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                                  <Home className="h-5 w-5 text-blue-500" />
                                  <span className="text-blue-700 font-medium">Work from home requested</span>
                                </div>
                              )}

                              {request.reason && (
                                <div>
                                  <Label className="text-sm font-semibold">Reason</Label>
                                  <p className="text-sm bg-gray-100 p-3 rounded-lg">{request.reason}</p>
                                </div>
                              )}

                              <div className="flex space-x-4">
                                <Button
                                  onClick={() => setAction('approve')}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => setAction('reject')}
                                  variant="destructive"
                                  className="flex-1"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>

                              {action === 'reject' && (
                                <div className="space-y-2">
                                  <Label htmlFor="rejection_reason">Rejection Reason</Label>
                                  <Textarea
                                    id="rejection_reason"
                                    placeholder="Please provide a reason for rejection..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                              )}

                              {action && (
                                <div className="flex space-x-4">
                                  <Button
                                    onClick={() => action === 'approve' ? handleApprove(request.id) : handleReject(request.id)}
                                    disabled={processing === request.id || (action === 'reject' && !rejectionReason.trim())}
                                    className="flex-1"
                                  >
                                    {processing === request.id ? 'Processing...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setAction(null);
                                      setRejectionReason('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
          </TabsContent>
        </Tabs>

        {/* Add Manual Leave Dialog */}
        <Dialog open={showAddLeaveDialog} onOpenChange={setShowAddLeaveDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Manual Leave</DialogTitle>
              <DialogDescription>
                Add a leave entry for an employee
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="user_id">Employee</Label>
                <Select value={addLeaveForm.user_id} onValueChange={(value) => setAddLeaveForm({...addLeaveForm, user_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(userProfiles).map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} ({profile.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_date_range"
                  checked={addLeaveForm.is_date_range}
                  onChange={(e) => setAddLeaveForm({...addLeaveForm, is_date_range: e.target.checked, end_date: ''})}
                />
                <Label htmlFor="is_date_range">Multiple days (date range)</Label>
              </div>

              <div>
                <Label htmlFor="leave_date">{addLeaveForm.is_date_range ? 'Start Date' : 'Leave Date'}</Label>
                <Input
                  id="leave_date"
                  type="date"
                  value={addLeaveForm.leave_date}
                  onChange={(e) => setAddLeaveForm({...addLeaveForm, leave_date: e.target.value})}
                />
              </div>

              {addLeaveForm.is_date_range && (
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={addLeaveForm.end_date}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, end_date: e.target.value})}
                    min={addLeaveForm.leave_date}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="leave_type_name">Leave Type</Label>
                <Select value={addLeaveForm.leave_type_name} onValueChange={(value) => setAddLeaveForm({...addLeaveForm, leave_type_name: value})}>
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_paid_leave"
                  checked={addLeaveForm.is_paid_leave}
                  onChange={(e) => setAddLeaveForm({...addLeaveForm, is_paid_leave: e.target.checked})}
                />
                <Label htmlFor="is_paid_leave">Paid Leave</Label>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={addLeaveForm.notes}
                  onChange={(e) => setAddLeaveForm({...addLeaveForm, notes: e.target.value})}
                  placeholder="Additional notes about this leave..."
                  rows={3}
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  onClick={handleAddManualLeave}
                  disabled={processing === 'add-leave'}
                  className="flex-1"
                >
                  {processing === 'add-leave' ? 'Adding...' : 'Add Leave'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddLeaveDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Employee Leave History Dialog */}
        <Dialog open={selectedEmployee !== null} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Leave History - {userProfiles[selectedEmployee || '']?.name || 'Unknown User'}
              </DialogTitle>
              <DialogDescription>
                View and manage leave history for this employee
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {employeeLeaves.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600">No leave history found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {employeeLeaves.map((group: any) => (
                    <Card key={group.id} className="elegant-card">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {group.is_paid_leave ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-medium">{group.leave_type_name}</h4>
                                <Badge className={group.is_paid_leave ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                  {group.is_paid_leave ? 'Paid' : 'Unpaid'}
                                </Badge>
                                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                  {group.duration} day{group.duration !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4 text-gray-600" />
                                  <span className="text-sm">
                                    {group.start_date === group.end_date 
                                      ? new Date(group.start_date).toLocaleDateString()
                                      : `${new Date(group.start_date).toLocaleDateString()} - ${new Date(group.end_date).toLocaleDateString()}`
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-4 w-4 text-gray-600" />
                                  <span className="text-sm">
                                    {new Date(group.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              {group.notes && (
                                <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                                  {group.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLeaveGroup(group)}
                            disabled={processing === group.id}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setSelectedEmployee(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
