import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Fingerprint, User, Calendar, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { getUserAttendanceData, getAllAttendanceData } from '@/services/attendanceDataProcessorV2Client';

interface AttendanceLog {
  id: number;
  employee_id: string;
  employee_name: string;
  log_time: string;
  log_type: 'checkin' | 'checkout' | 'unknown';
  device_id: string | null;
  source: 'manual' | 'teamoffice';
  raw_payload: any;
  created_at: string;
}

interface DayEntry {
  id: string;
  user_id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  is_late?: boolean;
  device_info: string | null;
  modification_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceSummary {
  totalDays: number;
  totalWorkMinutes: number;
  averageWorkMinutes: number;
  totalEmployees?: number; // For admin view
}

interface AttendanceLogsV2Props {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  showSummary?: boolean;
  isAdmin?: boolean;
}

export function AttendanceLogsV2({ 
  employeeId, 
  startDate, 
  endDate, 
  showSummary = false,
  isAdmin = false
}: AttendanceLogsV2Props) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalDays: 0,
    totalWorkMinutes: 0,
    averageWorkMinutes: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('logs');

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let data;
      
      if (isAdmin || role === 'admin') {
        // Admin view - show all data
        data = await getAllAttendanceData(
          startDate || undefined,
          endDate || undefined
        );
        setSummary({
          totalDays: data.summary.totalDays,
          totalWorkMinutes: data.summary.totalWorkMinutes,
          averageWorkMinutes: data.summary.totalDays > 0 
            ? Math.round(data.summary.totalWorkMinutes / data.summary.totalDays) 
            : 0,
          totalEmployees: data.summary.totalEmployees
        });
      } else {
        // User view - show only their data
        const targetUserId = employeeId || user.id;
        data = await getUserAttendanceData(
          targetUserId,
          startDate || undefined,
          endDate || undefined
        );
        setSummary(data.summary);
      }

      setLogs(data.attendanceLogs);
      setDayEntries(data.dayEntries);
    } catch (err) {
      console.error('Error loading attendance data:', err);
      setError('Failed to load attendance data');
      toast({
        title: 'Error',
        description: 'Failed to load attendance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, employeeId, startDate, endDate, isAdmin, role]);

  const handleRefresh = async () => {
    await loadData();
    toast({
      title: 'Refreshed',
      description: 'Attendance data has been refreshed.',
    });
  };

  const getLogTypeIcon = (logType: string, source: string) => {
    if (source === 'teamoffice') {
      return <Fingerprint className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const getLogTypeBadge = (logType: string, source: string) => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    
    if (source === 'teamoffice') {
      return (
        <Badge className={`${baseClasses} bg-blue-100 text-blue-800`}>
          <Fingerprint className="h-3 w-3 mr-1" />
          {logType.toUpperCase()}
        </Badge>
      );
    }
    
    switch (logType) {
      case 'checkin':
        return (
          <Badge className={`${baseClasses} bg-green-100 text-green-800`}>
            <Clock className="h-3 w-3 mr-1" />
            CHECK IN
          </Badge>
        );
      case 'checkout':
        return (
          <Badge className={`${baseClasses} bg-red-100 text-red-800`}>
            <Clock className="h-3 w-3 mr-1" />
            CHECK OUT
          </Badge>
        );
      default:
        return (
          <Badge className={`${baseClasses} bg-gray-100 text-gray-800`}>
            <Clock className="h-3 w-3 mr-1" />
            {logType.toUpperCase()}
          </Badge>
        );
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatWorkTime = (minutes: number | null) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-yellow-600 bg-yellow-100';
      case 'unlogged': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>{error}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Days</p>
                  <p className="text-xl font-bold text-gray-900">{summary.totalDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Work Time</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatWorkTime(summary.totalWorkMinutes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">
                    {isAdmin ? 'Avg per Employee' : 'Average Daily'}
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatWorkTime(summary.averageWorkMinutes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAdmin && summary.totalEmployees && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-indigo-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Employees</p>
                    <p className="text-xl font-bold text-gray-900">{summary.totalEmployees}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {isAdmin ? 'All Attendance Records' : 'My Attendance Records'}
            </CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'View and manage all employee attendance from TeamOffice'
                : 'Your check-in/check-out records from TeamOffice'
              }
            </CardDescription>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="logs">Detailed Logs</TabsTrigger>
              <TabsTrigger value="summary">Daily Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No attendance logs found</p>
                  <p className="text-sm">Records will appear here once employees check in/out</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        {getLogTypeIcon(log.log_type, log.source)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{log.employee_name}</p>
                            {getLogTypeBadge(log.log_type, log.source)}
                          </div>
                          <p className="text-sm text-gray-600">
                            {formatDate(log.log_time)} at {formatTime(log.log_time)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <p>Source: {log.source}</p>
                        {log.device_id && <p>Device: {log.device_id}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              {dayEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No daily entries found</p>
                  <p className="text-sm">Daily summaries will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-4">
                          <h3 className="font-semibold text-lg">
                            {formatDate(entry.entry_date)}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                            {entry.status}
                          </span>
                          {entry.is_late && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              LATE
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {formatWorkTime(entry.total_work_time_minutes)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><strong>Check-in:</strong> {entry.check_in_at ? formatTime(entry.check_in_at) : 'N/A'}</p>
                          <p><strong>Check-out:</strong> {entry.check_out_at ? formatTime(entry.check_out_at) : 'N/A'}</p>
                        </div>
                        <div>
                          <p><strong>Source:</strong> {entry.device_info || 'Manual'}</p>
                          {entry.modification_reason && (
                            <p><strong>Note:</strong> {entry.modification_reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

