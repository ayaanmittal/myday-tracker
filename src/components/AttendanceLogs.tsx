import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { RefreshCw, Clock, Fingerprint, Calendar, Users, CheckCircle, XCircle, Database } from 'lucide-react';
import { useAttendanceLogs, useAttendanceSummary } from '../hooks/useAttendanceLogs';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useToast } from '../hooks/use-toast';
import { fetchAttendanceDataFromAPIClient } from '../services/autoFetchServiceClient';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';

interface AttendanceLogsProps {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  showSummary?: boolean;
  showAllEmployees?: boolean;
}

export function AttendanceLogs({ 
  employeeId, 
  startDate, 
  endDate, 
  showSummary = false,
  showAllEmployees = false
}: AttendanceLogsProps) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const { logs, loading, error, refetch } = useAttendanceLogs(employeeId, startDate, endDate, showAllEmployees);
  const { summary, loading: summaryLoading } = useAttendanceSummary(startDate);
  const [activeTab, setActiveTab] = useState('logs');
  const [isRefreshingFromAPI, setIsRefreshingFromAPI] = useState(false);
  
  // Debug logging
  console.log('AttendanceLogs Debug:', {
    employeeId,
    startDate,
    endDate,
    showAllEmployees,
    logsCount: logs?.length || 0,
    loading,
    error
  });
  
  const { toast } = useToast();
  
  // Auto-refresh configuration - DISABLED by default
  const { 
    isActive: isAutoRefreshActive, 
    isRefreshing, 
    lastRefreshTime, 
    refreshCount,
    toggle: toggleAutoRefresh,
    config: autoRefreshConfig
  } = useAutoRefresh({
    enabled: false, // Disabled by default
    intervalMinutes: 10, // If enabled, refresh every 10 minutes (increased from 5)
    onDataUpdate: (result) => {
      // Refetch local data when auto-refresh updates
      refetch();
    }
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: 'Refreshed',
        description: 'Attendance data has been refreshed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh attendance data.',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshFromAPI = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'No user ID found',
        variant: 'destructive',
      });
      return;
    }

    setIsRefreshingFromAPI(true);
    try {
      console.log('🔄 Starting API refresh from AttendanceLogs...');
      
      // Fetch data for the last 7 days to ensure we get recent entries
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const result = await fetchAttendanceDataFromAPIClient({
        startDate,
        endDate,
        forceRefresh: true
      });

      if (result.success) {
        toast({
          title: 'API Data Refreshed',
          description: `Successfully processed ${result.recordsProcessed} records from ${result.recordsFound} found.`,
          variant: 'default',
        });
        // Refresh the local data
        await refetch();
      } else {
        toast({
          title: 'API Refresh Completed with Issues',
          description: `Processed ${result.recordsProcessed} records, but encountered ${result.errors.length} errors.`,
          variant: 'destructive',
        });
        // Still refresh local data to show what we have
        await refetch();
      }

    } catch (error) {
      console.error('❌ API refresh failed:', error);
      toast({
        title: 'API Refresh Failed',
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingFromAPI(false);
    }
  };

  const getLogTypeIcon = (source: string) => {
    if (source === 'teamoffice') {
      return <Fingerprint className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const getLogTypeBadge = (entry: any) => {
    const baseClass = "text-xs font-medium";
    const sourceClass = entry.source === 'teamoffice' ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={`${baseClass} ${sourceClass}`}>
          {entry.source === 'teamoffice' ? 'Biometric' : 'Manual'}
        </Badge>
        <Badge className={`${baseClass} ${
          entry.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
          entry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {entry.status === 'completed' ? 'Completed' : 
           entry.status === 'in_progress' ? 'In Progress' : 
           'Absent'}
        </Badge>
        {entry.is_late && (
          <Badge className={`${baseClass} bg-red-100 text-red-800`}>
            LATE
          </Badge>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading attendance data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error loading attendance data: {error}</p>
            <Button onClick={handleRefresh} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading summary...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summary.map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{item.total_days}</div>
                    <div className="text-sm text-gray-600">Total Days</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!showSummary && (
        <div className="space-y-4">
          {/* API Refresh Button - Only show for admins and managers */}
          {(role === 'admin' || role === 'manager') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Team Attendance Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleRefreshFromAPI}
                  disabled={isRefreshingFromAPI}
                  className="w-full"
                  variant="outline"
                >
                  {isRefreshingFromAPI ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Fetching from TeamOffice API...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Refresh from TeamOffice API
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Fetch latest attendance data from TeamOffice API and update the database. 
                  Existing data will be updated, not overwritten.
                </p>
              </CardContent>
            </Card>
          )}
          
          <AttendanceLogsList logs={logs} />
        </div>
      )}
    </div>
  );
}

function AttendanceLogsList({ logs }: { logs: any[] }) {
  const getLogTypeIcon = (source: string) => {
    if (source === 'teamoffice') {
      return <Fingerprint className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const getLogTypeBadge = (entry: any) => {
    const baseClass = "text-xs font-medium";
    const sourceClass = entry.source === 'teamoffice' ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={`${baseClass} ${sourceClass}`}>
          {entry.source === 'teamoffice' ? 'Biometric' : 'Manual'}
        </Badge>
        <Badge className={`${baseClass} ${
          entry.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
          entry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {entry.status === 'completed' ? 'Completed' : 
           entry.status === 'in_progress' ? 'In Progress' : 
           'Absent'}
        </Badge>
        {entry.is_late && (
          <Badge className={`${baseClass} bg-red-100 text-red-800`}>
            LATE
          </Badge>
        )}
      </div>
    );
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatWorkTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No attendance records found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((entry) => (
        <Card key={entry.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getLogTypeIcon(entry.source)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {entry.employee_name || 'Unknown'}
                  </span>
                  {getLogTypeBadge(entry)}
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>{formatDate(entry.entry_date)}</span>
                    {entry.check_in_at && (
                      <span>Check-in: {formatTime(entry.check_in_at)}</span>
                    )}
                    {entry.check_out_at && (
                      <span>Check-out: {formatTime(entry.check_out_at)}</span>
                    )}
                    {entry.total_work_time_minutes > 0 && (
                      <span>Work: {formatWorkTime(entry.total_work_time_minutes)}</span>
                    )}
                  </div>
                  {entry.device_id && (
                    <span className="ml-2">Device: {entry.device_id}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}