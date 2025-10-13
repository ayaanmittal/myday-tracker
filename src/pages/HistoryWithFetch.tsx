import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Home, Edit, Save, X, Users, TrendingUp, RefreshCw, Download } from 'lucide-react';
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
import { 
  getUserAttendanceDataV3Client, 
  getAllAttendanceDataV3Client,
  UnifiedAttendanceRecord
} from '@/services/attendanceDataProcessorV3Client';

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

interface FetchResult {
  success: boolean;
  recordsProcessed: number;
  recordsFound: number;
  errors: string[];
  lastFetchTime: string;
}

export default function HistoryWithFetch() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  
  const [attendanceLogs, setAttendanceLogs] = useState<UnifiedAttendanceRecord[]>([]);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalDays: 0,
    totalWorkMinutes: 0,
    averageWorkMinutes: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string>('');
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [availableDateRange, setAvailableDateRange] = useState<{
    earliestDate: string;
    latestDate: string;
    totalRecords: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setIsAdmin(role === 'admin');
      // Clear data immediately when user changes
      setLoading(true);
      setAttendanceLogs([]);
      setDayEntries([]);
      setSummary({
        totalDays: 0,
        totalWorkMinutes: 0,
        averageWorkMinutes: 0
      });
      setFetchResult(null);
      loadInitialData();
    } else {
      // Clear data when user logs out
      setAttendanceLogs([]);
      setDayEntries([]);
      setSummary({
        totalDays: 0,
        totalWorkMinutes: 0,
        averageWorkMinutes: 0
      });
      setFetchResult(null);
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    if (startDate || endDate) {
      loadAttendanceData();
    }
  }, [startDate, endDate]);

  // Cleanup effect to clear data when component unmounts
  useEffect(() => {
    return () => {
      setAttendanceLogs([]);
      setDayEntries([]);
      setSummary({
        totalDays: 0,
        totalWorkMinutes: 0,
        averageWorkMinutes: 0
      });
      setFetchResult(null);
    };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Get available date range
      const dateRange = await getAvailableDateRangeClient();
      setAvailableDateRange(dateRange);
      
      // Set default date range to today
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      
      // Load data
      await loadAttendanceData();
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error",
        description: "Failed to load initial data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async (forceRefresh = false) => {
    if (!user) return;

    setFetching(true);
    
    // Clear existing data to prevent showing cached data
    setAttendanceLogs([]);
    setDayEntries([]);
    setSummary({
      totalDays: 0,
      totalWorkMinutes: 0,
      averageWorkMinutes: 0
    });
    
    try {
      const options = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        forceRefresh
      };

      let data;
      
      if (isAdmin || role === 'admin') {
        // Admin view - show all data
        data = await getAllAttendanceDataV3Client(
          options.startDate,
          options.endDate
        );
      } else {
        // User view - show only their data
        data = await getUserAttendanceDataV3Client(
          user.id,
          options.startDate,
          options.endDate
        );
      }

      setAttendanceLogs(data.dayEntries); // Now using dayEntries as the main data source
      setDayEntries(data.dayEntries);
      setSummary(data.summary);
      setLastFetchTime(data.lastFetchTime);
      setFetchResult(data.fetchResult || null);

      // Show fetch result to user
      if (data.fetchResult) {
        if (data.fetchResult.success) {
          toast({
            title: "Data Updated",
            description: `Fetched ${data.fetchResult.recordsFound} records, processed ${data.fetchResult.recordsProcessed} successfully`,
          });
        } else {
          toast({
            title: "Fetch Warning",
            description: `Fetched ${data.fetchResult.recordsFound} records but had ${data.fetchResult.errors.length} errors`,
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error('Error loading attendance data:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleRefresh = async () => {
    await loadAttendanceData(true);
  };

  const handleDateRangeChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
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
      <div key={`${user?.id}-${startDate}-${endDate}`} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin ? 'All Attendance History' : 'My Attendance History'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isAdmin 
                ? 'View and manage all employee attendance records with real-time data'
                : 'Track your daily attendance and work hours with live updates'
              }
            </p>
            {lastFetchTime && (
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {new Date(lastFetchTime).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleRefresh} 
              disabled={fetching}
              variant="outline"
            >
              {fetching ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {fetching ? 'Fetching...' : 'Refresh Data'}
            </Button>
          </div>
        </div>

        {/* Fetch Status */}
        {fetchResult && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Download className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      API Fetch Status
                    </span>
                  </div>
                  <div className="text-sm text-blue-700">
                    Found: {fetchResult.recordsFound} | Processed: {fetchResult.recordsProcessed}
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  fetchResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {fetchResult.success ? 'Success' : 'Errors'}
                </div>
              </div>
              {fetchResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  Errors: {fetchResult.errors.join(', ')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              Select a date range to fetch and view specific attendance records
              {availableDateRange && (
                <span className="block mt-1 text-xs text-gray-500">
                  Available data: {availableDateRange.earliestDate} to {availableDateRange.latestDate} ({availableDateRange.totalRecords} records)
                </span>
              )}
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
                  max={availableDateRange?.latestDate}
                  min={availableDateRange?.earliestDate}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={availableDateRange?.latestDate}
                  min={availableDateRange?.earliestDate}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={() => loadAttendanceData(true)}
                  disabled={fetching}
                  className="w-full"
                >
                  {fetching ? 'Fetching...' : 'Fetch & Apply'}
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
                ? 'All employee daily work summaries from TeamOffice'
                : 'Your daily work summaries from TeamOffice'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dayEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No daily entries found for the selected period</p>
                <p className="text-sm">Click "Refresh Data" to fetch from TeamOffice API</p>
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
                ? 'All check-in/check-out records from TeamOffice API'
                : 'Your check-in/check-out records from TeamOffice API'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dayEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No attendance records found for the selected period</p>
                <p className="text-sm">Records will appear here once employees check in/out</p>
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
      </div>
    </Layout>
  );
}
