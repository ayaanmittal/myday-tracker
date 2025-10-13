import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchAttendanceDataFromAPIClient } from '@/services/autoFetchServiceClient';
import { useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react';

interface RefreshResult {
  success: boolean;
  recordsFound: number;
  recordsProcessed: number;
  errors: string[];
  lastFetchTime: string;
}

export function AttendanceRefreshButton() {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null);

  // Only show for admins and managers
  if (role !== 'admin' && role !== 'manager') {
    return null;
  }

  const handleRefresh = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'No user ID found',
        variant: 'destructive',
      });
      return;
    }

    setIsRefreshing(true);
    try {
      console.log('🔄 Starting attendance data refresh...');
      
      // Fetch data for the last 7 days to ensure we get recent entries
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const result = await fetchAttendanceDataFromAPIClient({
        startDate,
        endDate,
        forceRefresh: true
      });

      setLastResult(result);

      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['unified-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      queryClient.invalidateQueries({ queryKey: ['reports-data'] });

      if (result.success) {
        toast({
          title: 'Attendance Data Refreshed',
          description: `Successfully processed ${result.recordsProcessed} records from ${result.recordsFound} found.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Refresh Completed with Issues',
          description: `Processed ${result.recordsProcessed} records, but encountered ${result.errors.length} errors.`,
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('❌ Attendance refresh failed:', error);
      toast({
        title: 'Refresh Failed',
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
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
        {success ? 'Success' : 'Issues'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Attendance Data Refresh
        </CardTitle>
        <CardDescription>
          Manually fetch latest attendance data from TeamOffice API and populate the unified attendance table
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full"
            size="lg"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching from API...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Attendance Data
              </>
            )}
          </Button>

          {lastResult && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(lastResult.success)}
                  <span className="font-medium">Last Refresh Result</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(lastResult.success)}
                  <span className="text-sm text-muted-foreground">
                    {new Date(lastResult.lastFetchTime).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{lastResult.recordsFound} found</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>{lastResult.recordsProcessed} processed</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>{lastResult.errors.length} errors</span>
                </div>
              </div>

              {lastResult.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span className="font-medium">Errors:</span>
                  </div>
                  <div className="text-xs text-red-600 space-y-1 max-h-20 overflow-y-auto">
                    {lastResult.errors.slice(0, 3).map((error, index) => (
                      <div key={index} className="truncate">
                        {error}
                      </div>
                    ))}
                    {lastResult.errors.length > 3 && (
                      <div className="text-muted-foreground">
                        +{lastResult.errors.length - 3} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
