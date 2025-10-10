import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Home, Edit, Save, X, Users, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { DatePicker } from '@/components/DatePicker';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
}

export default function HistoryV2() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalDays: 0,
    totalWorkMinutes: 0,
    averageWorkMinutes: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      setIsAdmin(role === 'admin');
      loadAttendanceData();
    }
  }, [user, role, startDate, endDate]);

  const loadAttendanceData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (isAdmin) {
        // Admin view - show all data
        const data = await getAllAttendanceData(
          startDate || undefined,
          endDate || undefined
        );
        setAttendanceLogs(data.attendanceLogs);
        setDayEntries(data.dayEntries);
        setSummary({
          totalDays: data.summary.totalDays,
          totalWorkMinutes: data.summary.totalWorkMinutes,
          averageWorkMinutes: data.summary.totalDays > 0 
            ? Math.round(data.summary.totalWorkMinutes / data.summary.totalDays) 
            : 0
        });
      } else {
        // User view - show only their data
        const data = await getUserAttendanceData(
          user.id,
          startDate || undefined,
          endDate || undefined
        );
        setAttendanceLogs(data.attendanceLogs);
        setDayEntries(data.dayEntries);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getLogTypeColor = (logType: string) => {
    switch (logType) {
      case 'checkin': return 'text-green-600 bg-green-100';
      case 'checkout': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading attendance data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin ? 'All Attendance History' : 'My Attendance History'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isAdmin 
                ? 'View and manage all employee attendance records'
                : 'Track your daily attendance and work hours'
              }
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Days</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Work Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatWorkTime(summary.totalWorkMinutes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Daily</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatWorkTime(summary.averageWorkMinutes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filter by Date Range</CardTitle>
            <CardDescription>
              Select a date range to view specific attendance records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={loadAttendanceData}
                  className="w-full"
                >
                  Apply Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Entries</CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'All employee daily work summaries'
                : 'Your daily work summaries'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dayEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No daily entries found for the selected period</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4 hover:bg-gray-50">
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
          </CardContent>
        </Card>

        {/* Attendance Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Logs</CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'All check-in/check-out records from TeamOffice'
                : 'Your check-in/check-out records'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No attendance logs found for the selected period</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLogTypeColor(log.log_type)}`}>
                        {log.log_type.toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium">{log.employee_name}</p>
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
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

