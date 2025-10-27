import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_is_paid: boolean;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  work_from_home: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface LeaveDetailsDialogProps {
  employeeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  year?: number;
}

const LeaveDetailsDialog: React.FC<LeaveDetailsDialogProps> = ({ 
  employeeId, 
  isOpen, 
  onClose, 
  year = new Date().getFullYear() 
}) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadLeaveRequests();
    }
  }, [isOpen, employeeId, year]);

  const loadLeaveRequests = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          leave_types(name, is_paid)
        `)
        .eq('user_id', employeeId)
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`);

      if (requestsError) {
        console.error('Error loading leave requests:', requestsError);
        setError('Failed to load leave requests');
        return;
      }

      const transformedRequests = requests?.map(request => ({
        id: request.id,
        user_id: request.user_id,
        leave_type_id: request.leave_type_id,
        leave_type_name: request.leave_types.name,
        leave_type_is_paid: request.leave_types.is_paid,
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
      setError('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const updateLeaveRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      setLoading(true);
      
      // Handle approval/rejection with direct table operations
      if (newStatus === 'approved') {
        // First, get the leave request details
        const { data: leaveRequest, error: fetchError } = await supabase
          .from('leave_requests')
          .select(`
            *,
            leave_types!inner(name, is_paid)
          `)
          .eq('id', requestId)
          .single();

        if (fetchError) {
          console.error('Error fetching leave request:', fetchError);
          setError('Failed to fetch leave request details');
          return;
        }

        // Get the profile details with employee category info
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id, 
            employee_category_id,
            employee_categories!inner(name, is_paid_leave_eligible)
          `)
          .eq('user_id', leaveRequest.user_id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setError('Failed to fetch profile details');
          return;
        }

        // Update the leave request status
        const { error: updateError } = await supabase
          .from('leave_requests')
          .update({ 
            status: newStatus,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) {
          console.error('Error updating leave request status:', updateError);
          setError('Failed to update leave request status');
          return;
        }

        // Create leave records for each day in the leave period
        const startDate = new Date(leaveRequest.start_date);
        const endDate = new Date(leaveRequest.end_date);
        const leaveRecords = [];

        // Generate leave records for each day
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          leaveRecords.push({
            user_id: leaveRequest.user_id,
            profile_id: profile.id,
            leave_date: date.toISOString().split('T')[0],
            leave_type_id: leaveRequest.leave_type_id,
            leave_type_name: leaveRequest.leave_types.name,
            is_paid_leave: leaveRequest.leave_types.is_paid || false,
            is_approved: true,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString(),
            leave_request_id: requestId,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            notes: `Auto-generated from approved leave request`
          });
        }

        // Insert leave records
        if (leaveRecords.length > 0) {
          const { error: insertError } = await supabase
            .from('leaves')
            .insert(leaveRecords);

          if (insertError) {
            console.error('Error inserting leave records:', insertError);
            // Don't throw here, just log the error as the approval was successful
          }
        }
      } else {
        // For rejections or other statuses, just update the request
        const { error } = await supabase
          .from('leave_requests')
          .update({ 
            status: newStatus,
            approved_by: newStatus === 'approved' || newStatus === 'rejected' ? (await supabase.auth.getUser()).data.user?.id : null,
            approved_at: newStatus === 'approved' || newStatus === 'rejected' ? new Date().toISOString() : null
          })
          .eq('id', requestId);

        if (error) {
          console.error('Error updating leave request status:', error);
          setError('Failed to update leave request status');
          return;
        }
      }

      // Refresh the data
      await loadLeaveRequests();
    } catch (err: any) {
      console.error('Error updating leave request status:', err);
      setError('Failed to update leave request status');
    } finally {
      setLoading(false);
    }
  };

  const updateLeaveTypePaidStatus = async (leaveTypeId: string, isPaid: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('leave_types')
        .update({ is_paid: isPaid })
        .eq('id', leaveTypeId);

      if (error) {
        console.error('Error updating leave type paid status:', error);
        setError('Failed to update leave type paid status');
        return;
      }

      // Refresh the data
      await loadLeaveRequests();
    } catch (err: any) {
      console.error('Error updating leave type paid status:', err);
      setError('Failed to update leave type paid status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Detailed view of all leave requests for the selected employee in {year}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading leave requests...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              {error}
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leave requests found for this employee in {year}
            </div>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[60vh]">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Leave Type</TableHead>
                    <TableHead className="w-24">Start Date</TableHead>
                    <TableHead className="w-24">End Date</TableHead>
                    <TableHead className="w-16">Days</TableHead>
                    <TableHead className="w-24">Paid/Unpaid</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-24">Added By</TableHead>
                    <TableHead className="w-48">Reason</TableHead>
                    <TableHead className="w-24">Work From Home</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.leave_type_name}</TableCell>
                      <TableCell>{new Date(request.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(request.end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{request.days_requested}</TableCell>
                      <TableCell>
                        <Select 
                          value={request.leave_type_is_paid ? 'paid' : 'unpaid'} 
                          onValueChange={(value) => updateLeaveTypePaidStatus(request.leave_type_id, value === 'paid')}
                          disabled={loading}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                Paid
                              </div>
                            </SelectItem>
                            <SelectItem value="unpaid">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                Unpaid
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={request.status} 
                          onValueChange={(newStatus) => updateLeaveRequestStatus(request.id, newStatus)}
                          disabled={loading}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                Pending
                              </div>
                            </SelectItem>
                            <SelectItem value="approved">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                Approved
                              </div>
                            </SelectItem>
                            <SelectItem value="rejected">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                Rejected
                              </div>
                            </SelectItem>
                            <SelectItem value="cancelled">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                Cancelled
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {request.approved_by ? (
                          <Badge variant="outline" className="text-blue-600">
                            Admin Added
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            Employee Request
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div 
                          className="truncate cursor-help" 
                          title={request.reason || 'N/A'}
                        >
                          {request.reason || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.work_from_home ? (
                          <Badge variant="outline" className="text-green-600">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Total approved leaves: {leaveRequests
                  .filter(req => req.status === 'approved')
                  .reduce((sum, req) => sum + req.days_requested, 0)} days
              </div>
              <div className="flex gap-4">
                <span>
                  Paid: {leaveRequests
                    .filter(req => req.status === 'approved' && req.leave_type_is_paid)
                    .reduce((sum, req) => sum + req.days_requested, 0)} days
                </span>
                <span>
                  Unpaid: {leaveRequests
                    .filter(req => req.status === 'approved' && !req.leave_type_is_paid)
                    .reduce((sum, req) => sum + req.days_requested, 0)} days
                </span>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveDetailsDialog;
