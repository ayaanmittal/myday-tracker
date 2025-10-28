import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, Users, Calendar, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import AdminAddLeaveDialog from './AdminAddLeaveDialog';

interface LeaveBalanceSummary {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_category: string;
  total_allocated: number;
  total_used: number;
  total_remaining: number;
  is_on_probation: boolean;
  probation_days_used: number;
  probation_days_remaining: number;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  leave_type_name: string;
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

interface LeaveStatisticsCardsProps {
  summaryData: LeaveBalanceSummary[];
  leaveRequests: LeaveRequest[];
  getEmployeeLeaveRequests: (employeeId: string) => LeaveRequest[];
  getEmployeeRanking: () => any[];
  showAddLeave?: boolean;
  onAddLeave?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const LeaveStatisticsCards: React.FC<LeaveStatisticsCardsProps> = ({
  summaryData,
  leaveRequests,
  getEmployeeLeaveRequests,
  getEmployeeRanking,
  showAddLeave = false,
  onAddLeave,
  onRefresh,
  loading = false
}) => {
  // Statistics functions
  const getAverageLeavesPerEmployee = () => {
    if (summaryData.length === 0) return 0;
    const totalLeaves = summaryData.reduce((sum, emp) => {
      const employeeRequests = getEmployeeLeaveRequests(emp.employee_id);
      return sum + employeeRequests
        .filter(request => request.status === 'approved')
        .reduce((total, request) => total + request.days_requested, 0);
    }, 0);
    return Math.round((totalLeaves / summaryData.length) * 10) / 10;
  };

  const getTotalLeaveRequests = () => {
    return leaveRequests.length;
  };

  const getApprovedLeaveRequests = () => {
    return leaveRequests.filter(request => request.status === 'approved').length;
  };

  const getPendingLeaveRequests = () => {
    return leaveRequests.filter(request => request.status === 'pending').length;
  };

  const getRejectedLeaveRequests = () => {
    return leaveRequests.filter(request => request.status === 'rejected').length;
  };

  return (
    <div className="space-y-6">
      {/* Primary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              On Probation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summaryData.filter(emp => emp.is_on_probation).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Total Allocated Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryData.reduce((sum, emp) => sum + emp.total_allocated, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Total Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summaryData.reduce((sum, emp) => sum + emp.total_remaining, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Total Leaves Taken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summaryData.reduce((sum, emp) => {
                const employeeRequests = getEmployeeLeaveRequests(emp.employee_id);
                return sum + employeeRequests
                  .filter(request => request.status === 'approved')
                  .reduce((total, request) => total + request.days_requested, 0);
              }, 0)} days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Avg Leaves per Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {getAverageLeavesPerEmployee()} days
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {summaryData.length} employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total</span>
                <span className="font-bold">{getTotalLeaveRequests()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600">Approved</span>
                <span className="font-bold text-green-600">{getApprovedLeaveRequests()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-600">Pending</span>
                <span className="font-bold text-yellow-600">{getPendingLeaveRequests()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Rejected</span>
                <span className="font-bold text-red-600">{getRejectedLeaveRequests()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {getTotalLeaveRequests() > 0 
                ? Math.round((getApprovedLeaveRequests() / getTotalLeaveRequests()) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getApprovedLeaveRequests()} of {getTotalLeaveRequests()} requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards */}
      {showAddLeave && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-dashed border-2 border-gray-300 hover:border-blue-400 transition-colors">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Add Leave for Employee</p>
                <p className="text-xs text-gray-500 mt-1">Manually add leave requests</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Most Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-orange-600">
                {getEmployeeRanking()[0]?.employee_name || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {getEmployeeRanking()[0]?.totalLeavesTaken || 0} days taken
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <AdminAddLeaveDialog onLeaveAdded={onAddLeave} />
              {onRefresh && (
                <Button 
                  onClick={onRefresh} 
                  disabled={loading} 
                  variant="outline" 
                  className="w-full"
                >
                  Refresh Data
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LeaveStatisticsCards;

