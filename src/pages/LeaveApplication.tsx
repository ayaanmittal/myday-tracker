import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Calendar, Home, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';

interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  max_days_per_year: number;
  is_paid: boolean;
  requires_approval: boolean;
}

interface LeaveRequest {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  work_from_home: boolean;
  status: string;
  created_at: string;
  leave_types: LeaveType;
}

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
  leave_types: LeaveType;
}

export default function LeaveApplication() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    work_from_home: false,
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'employee') {
      navigate('/dashboard');
      return;
    }

    fetchData();
  }, [user, role, roleLoading, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch leave types
      const { data: typesData, error: typesError } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (typesError) {
        if (typesError.message.includes('relation "leave_types" does not exist')) {
          toast({
            title: 'Leave System Not Set Up',
            description: 'Please run the database migration to set up the leave management system.',
            variant: 'destructive',
          });
          setLeaveTypes([]);
          setLeaveBalances([]);
          setMyRequests([]);
          return;
        }
        throw typesError;
      }
      setLeaveTypes(typesData || []);

      // Fetch leave balances
      const currentYear = new Date().getFullYear();
      const { data: balancesData, error: balancesError } = await supabase
        .from('leave_balances')
        .select(`
          *,
          leave_types (*)
        `)
        .eq('user_id', user?.id)
        .eq('year', currentYear);

      if (balancesError) {
        console.warn('Leave balances not found:', balancesError.message);
        setLeaveBalances([]);
      } else {
        setLeaveBalances(balancesData || []);
      }

      // Fetch my leave requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_types (*)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.warn('Leave requests not found:', requestsError.message);
        setMyRequests([]);
      } else {
        setMyRequests(requestsData || []);
      }

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch leave data',
        variant: 'destructive',
      });
      setLeaveTypes([]);
      setLeaveBalances([]);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);

    try {
      const daysRequested = calculateDays(formData.start_date, formData.end_date);
      
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: user.id,
          leave_type_id: formData.leave_type_id,
          start_date: formData.start_date,
          end_date: formData.end_date,
          days_requested: daysRequested,
          reason: formData.reason || null,
          work_from_home: formData.work_from_home,
        });

      if (error) throw error;

      toast({
        title: 'Leave Request Submitted',
        description: 'Your leave request has been submitted for approval.',
      });

      // Reset form
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        work_from_home: false,
      });

      // Refresh data
      fetchData();

    } catch (error: any) {
      console.error('Error submitting leave request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit leave request',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">Leave Management</h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">Apply for leave and track your requests</p>
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
          {/* Leave Application Form */}
          <Card className="elegant-card elegant-shadow">
            <CardHeader>
              <CardTitle className="font-heading text-2xl font-bold">Apply for Leave</CardTitle>
              <CardDescription>Submit a new leave request</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="leave_type" className="text-sm font-semibold">Leave Type</Label>
                  <Select
                    value={formData.leave_type_id}
                    onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
                    required
                  >
                    <SelectTrigger className="elegant-input">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_date" className="text-sm font-semibold">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      className="elegant-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date" className="text-sm font-semibold">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                      className="elegant-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-sm font-semibold">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please provide a reason for your leave request..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="elegant-input"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="work_from_home"
                    checked={formData.work_from_home}
                    onCheckedChange={(checked) => setFormData({ ...formData, work_from_home: checked as boolean })}
                  />
                  <Label htmlFor="work_from_home" className="text-sm font-medium cursor-pointer">
                    Work from home during this period
                  </Label>
                </div>

                {formData.start_date && formData.end_date && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">
                      Total days requested: {calculateDays(formData.start_date, formData.end_date)} days
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full elegant-button" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Leave Request'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Leave Balances */}
          <Card className="elegant-card elegant-shadow">
            <CardHeader>
              <CardTitle className="font-heading text-2xl font-bold">Leave Balances</CardTitle>
              <CardDescription>Your current leave entitlements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveBalances.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No leave balances found</p>
                ) : (
                  leaveBalances.map((balance) => (
                    <div key={balance.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{balance.leave_types.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Leave Balance
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{balance.remaining_days}</p>
                        <p className="text-xs text-muted-foreground">
                          of {balance.total_days} days
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Leave Requests */}
        <Card className="elegant-card elegant-shadow">
          <CardHeader>
            <CardTitle className="font-heading text-2xl font-bold">My Leave Requests</CardTitle>
            <CardDescription>Track your submitted leave requests</CardDescription>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leave requests found</p>
            ) : (
              <div className="space-y-4">
                {myRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(request.status)}
                      <div>
                        <p className="font-medium">{request.leave_types.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                        </p>
                        {request.work_from_home && (
                          <div className="flex items-center space-x-1 mt-1">
                            <Home className="h-3 w-3 text-blue-500" />
                            <span className="text-xs text-blue-600">Work from home</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">{request.days_requested} days</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
