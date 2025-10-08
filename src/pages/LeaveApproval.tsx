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
import { CheckCircle, XCircle, Clock, Home, Calendar, User, AlertCircle } from 'lucide-react';
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
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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
  }, [user, role, roleLoading, navigate]);

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

      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(req => req.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        if (profilesError) {
          console.warn('Error fetching user profiles:', profilesError);
        } else if (profilesData) {
          const profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, UserProfile>);
          setUserProfiles(profilesMap);
        }
      }

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
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Leave Approved',
        description: 'The leave request has been approved.',
      });

      fetchLeaveRequests();
      setSelectedRequest(null);
      setAction(null);

    } catch (error: any) {
      console.error('Error approving leave:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve leave request',
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
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Leave Rejected',
        description: 'The leave request has been rejected.',
      });

      fetchLeaveRequests();
      setSelectedRequest(null);
      setAction(null);
      setRejectionReason('');

    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject leave request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
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

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;

  if (loading || roleLoading) {
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">Leave Approval</h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">Review and approve employee leave requests</p>
        </div>

        {/* Filter and Stats */}
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

        {/* Leave Requests */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card className="elegant-card elegant-shadow">
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No leave requests found</p>
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
                          <h3 className="font-semibold text-lg">{userProfiles[request.user_id]?.name || 'Unknown User'}</h3>
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{userProfiles[request.user_id]?.email || 'No email'}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
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
                        <p className="text-sm text-muted-foreground">
                          Leave Request
                        </p>
                        <p className="text-xs text-muted-foreground">
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
                                  <p className="text-lg font-medium">{userProfiles[request.user_id]?.name || 'Unknown User'}</p>
                                  <p className="text-sm text-muted-foreground">{userProfiles[request.user_id]?.email || 'No email'}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-semibold">Leave Type</Label>
                                  <p className="text-lg font-medium">{request.leave_types.name}</p>
                                  <p className="text-sm text-muted-foreground">
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
                                  <p className="text-sm bg-muted p-3 rounded-lg">{request.reason}</p>
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
      </div>
    </Layout>
  );
}
