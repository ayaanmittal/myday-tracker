import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { performApiRefresh, getApiRefreshLogs, ApiRefreshResult, ApiRefreshLog } from '@/services/apiRefreshService';
import { cleanupDuplicateAttendance } from '@/services/attendanceCleanupService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Calendar,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';

export function AdminRefreshApiButton() {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Only show for admins
  if (role !== 'admin') {
    return null;
  }

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      return await performApiRefresh(user.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-refresh-logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['teamoffice-employees'] });
      
      toast({
        title: result.success ? 'API Refresh Successful' : 'API Refresh Completed with Issues',
        description: `Completed in ${result.duration}ms. ${result.results.attendanceSync.recordsProcessed} attendance records processed.`,
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'API Refresh Failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      return await cleanupDuplicateAttendance();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['api-refresh-logs'] });
      
      toast({
        title: result.success ? 'Cleanup Successful' : 'Cleanup Failed',
        description: result.success 
          ? `Removed ${result.duplicatesRemoved} duplicate entries` 
          : result.errors.join(', '),
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Cleanup Failed',
        description: error.message || 'An error occurred during cleanup',
        variant: 'destructive',
      });
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['api-refresh-logs'],
    queryFn: () => getApiRefreshLogs(5),
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshMutation.mutateAsync();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? 'default' : 'destructive'}>
        {success ? 'Success' : 'Failed'}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            API Refresh
          </CardTitle>
          <CardDescription>
            Manually trigger API calls to check for updates and sync data from TeamOffice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending || isRefreshing}
              className="w-full"
              size="lg"
            >
              {refreshMutation.isPending || isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing API...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh API Data
                </>
              )}
            </Button>
            
            <Button
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {cleanupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning up duplicates...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clean Up Duplicate Entries
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Refresh Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Refresh Logs
          </CardTitle>
          <CardDescription>
            Last 5 API refresh operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No refresh logs found. Click "Refresh API Data" to start.
            </p>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.success)}
                        <span className="font-medium">
                          {(log as any).profiles?.name || 'Unknown Admin'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.success)}
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{log.duration_ms}ms</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{log.employee_sync_synced} employees</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{log.attendance_sync_processed} records</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {log.connection_test_success ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>Connection</span>
                      </div>
                    </div>

                    {log.total_errors.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            <span className="font-medium">Errors:</span>
                          </div>
                          <div className="text-xs text-red-600 space-y-1">
                            {log.total_errors.slice(0, 3).map((error, index) => (
                              <div key={index} className="truncate">
                                {error}
                              </div>
                            ))}
                            {log.total_errors.length > 3 && (
                              <div className="text-muted-foreground">
                                +{log.total_errors.length - 3} more errors
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
