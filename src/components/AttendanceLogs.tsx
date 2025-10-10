import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAttendanceLogs, useAttendanceSummary, AttendanceLog } from '@/hooks/useAttendanceLogs';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { Clock, Fingerprint, User, Calendar, RefreshCw, Play, Pause, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const { logs, loading, error, refetch } = useAttendanceLogs(employeeId, startDate, endDate, showAllEmployees);
  const { summary, loading: summaryLoading } = useAttendanceSummary(startDate);
  const [activeTab, setActiveTab] = useState('logs');
  
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

  // Function to manually update an attendance log
  const handleManualUpdate = async (logId: number, newTime: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .update({
          log_time: newTime,
          is_manual_update: true,
          update_reason: reason,
          updated_at: new Date().toISOString(),
          // Note: updated_by would be set to current user ID in a real implementation
        })
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: 'Updated',
        description: 'Attendance log has been manually updated.',
      });

      await refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update attendance log.',
        variant: 'destructive',
      });
    }
  };

  const getLogTypeIcon = (logType: string, source: string) => {
    if (source === 'teamoffice') {
      return <Fingerprint className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const getLogTypeBadge = (logType: string, source: string, isManualUpdate?: boolean) => {
    const baseClass = "text-xs font-medium";
    const sourceClass = source === 'teamoffice' ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={`${baseClass} ${sourceClass}`}>
          {source === 'teamoffice' ? 'Biometric' : 'Manual'}
        </Badge>
        {isManualUpdate && (
          <Badge className={`${baseClass} bg-orange-100 text-orange-800`}>
            Manual Update
          </Badge>
        )}
        <Badge className={`${baseClass} ${
          logType === 'checkin' ? 'bg-emerald-100 text-emerald-800' : 
          logType === 'checkout' ? 'bg-red-100 text-red-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {logType === 'checkin' ? 'Check In' : 
           logType === 'checkout' ? 'Check Out' : 
           'Unknown'}
        </Badge>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Attendance Logs</h3>
          {isAutoRefreshActive && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                {isRefreshing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                )}
                <span>Auto-refresh every {autoRefreshConfig.intervalMinutes}m</span>
              </div>
              {lastRefreshTime && (
                <span className="text-xs">
                  Last: {lastRefreshTime.toLocaleTimeString()}
                </span>
              )}
              {refreshCount > 0 && (
                <span className="text-xs">
                  ({refreshCount} updates)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={toggleAutoRefresh} 
            variant={isAutoRefreshActive ? "default" : "outline"} 
            size="sm"
          >
            {isAutoRefreshActive ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause Auto-refresh
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Auto-refresh
              </>
            )}
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {showSummary && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="logs">Individual Logs</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="logs">
            <AttendanceLogsList logs={logs} />
          </TabsContent>
          
          <TabsContent value="summary">
            <AttendanceSummaryList summary={summary} loading={summaryLoading} />
          </TabsContent>
        </Tabs>
      )}

      {!showSummary && <AttendanceLogsList logs={logs} />}
    </div>
  );
}

function AttendanceLogsList({ logs }: { logs: AttendanceLog[] }) {
  const getLogTypeIcon = (logType: string, source: string) => {
    if (source === 'teamoffice') {
      return <Fingerprint className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const getLogTypeBadge = (logType: string, source: string, isManualUpdate?: boolean) => {
    const baseClass = "text-xs font-medium";
    const sourceClass = source === 'teamoffice' ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={`${baseClass} ${sourceClass}`}>
          {source === 'teamoffice' ? 'Biometric' : 'Manual'}
        </Badge>
        {isManualUpdate && (
          <Badge className={`${baseClass} bg-orange-100 text-orange-800`}>
            Manual Update
          </Badge>
        )}
        <Badge className={`${baseClass} ${
          logType === 'checkin' ? 'bg-emerald-100 text-emerald-800' : 
          logType === 'checkout' ? 'bg-red-100 text-red-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {logType === 'checkin' ? 'Check In' : 
           logType === 'checkout' ? 'Check Out' : 
           'Unknown'}
        </Badge>
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

  // Helper function to detect if a log was manually updated
  const isManualUpdate = (log: AttendanceLog) => {
    // Check if it's explicitly marked as manual update
    if (log.is_manual_update) return true;
    
    // Check if it's a manual entry (source = 'manual')
    if (log.source === 'manual') return true;
    
    // Check if there's manual update info in raw_payload
    if (log.raw_payload?.manualUpdate?.isManualUpdate) return true;
    
    // Check if there's evidence of manual modification in raw_payload
    if (log.raw_payload?.actualOutTimeUsed || 
        log.raw_payload?.originalOUTTime || 
        log.raw_payload?.originalErlOut) {
      return true;
    }
    
    return false;
  };

  // Helper function to get manual update info
  const getManualUpdateInfo = (log: AttendanceLog) => {
    if (log.is_manual_update) {
      return {
        reason: log.update_reason,
        originalTime: log.original_log_time,
        updatedAt: log.updated_at,
        updatedBy: log.updated_by
      };
    }
    
    if (log.raw_payload?.manualUpdate) {
      return {
        reason: log.raw_payload.manualUpdate.updateReason,
        originalTime: log.raw_payload.manualUpdate.originalLogTime,
        updatedAt: log.raw_payload.manualUpdate.updatedAt,
        updatedBy: log.raw_payload.manualUpdate.updatedBy
      };
    }
    
    return null;
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No attendance logs found for the selected period.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        return (
        <Card key={log.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getLogTypeIcon(log.log_type, log.source)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {log.employee_name || log.employee_id}
                  </span>
                  {getLogTypeBadge(log.log_type, log.source, isManualUpdate(log))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    // For manual updates, prioritize day_entries times as they contain the actual work times
                    if (log.day_entries && log.day_entries.length > 0) {
                      const dayEntry = log.day_entries[0];
                      if (log.log_type === 'checkout' && dayEntry.check_out_at) {
                        return formatDateTime(dayEntry.check_out_at);
                      }
                      if (log.log_type === 'checkin' && dayEntry.check_in_at) {
                        return formatDateTime(dayEntry.check_in_at);
                      }
                    }
                    // Fallback to log_time if no day_entries data
                    return formatDateTime(log.log_time);
                  })()}
                  {log.device_id && (
                    <span className="ml-2">Device: {log.device_id}</span>
                  )}
                  {isManualUpdate(log) && (() => {
                    const manualInfo = getManualUpdateInfo(log);
                    return manualInfo ? (
                      <div className="mt-1 text-xs text-orange-600">
                        <div className="font-medium">Last modified:</div>
                        {manualInfo.reason && (
                          <div>{manualInfo.reason}</div>
                        )}
                        {manualInfo.originalTime && (
                          <div className="text-gray-500 mt-1">
                            Original: {formatDateTime(manualInfo.originalTime)}
                          </div>
                        )}
                        {manualInfo.updatedAt && (
                          <div className="text-gray-500">
                            Modified: {formatDateTime(manualInfo.updatedAt)}
                          </div>
                        )}
                        {manualInfo.updatedBy && (
                          <div className="text-gray-500">
                            By: {manualInfo.updatedBy}
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </Card>
        );
      })}
    </div>
  );
}

function AttendanceSummaryList({ 
  summary, 
  loading 
}: { 
  summary: any[]; 
  loading: boolean; 
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading summary...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summary.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No attendance summary available for the selected date.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {summary.map((item, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{item.employee_name || item.employee_id}</h4>
              <div className="text-sm text-muted-foreground">
                {item.first_checkin && (
                  <span>First Check-in: {new Date(item.first_checkin).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                )}
                {item.last_checkout && (
                  <span className="ml-4">Last Check-out: {new Date(item.last_checkout).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                Manual: {item.total_manual_logs}
              </Badge>
              <Badge variant="outline">
                Biometric: {item.total_biometric_logs}
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
