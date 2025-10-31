import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  recordsFound: number;
  recordsProcessed: number;
  errors: string[];
  lastFetchTime: string;
}

export default function AttendanceSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const { toast } = useToast();

  const triggerSync = async () => {
    setIsLoading(true);
    try {
      // Call the server-side sync function
      const response = await fetch('/api/sync-attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          forceRefresh: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SyncResult = await response.json();
      setLastSync(result);

      if (result.success) {
        toast({
          title: "Sync Successful",
          description: `Processed ${result.recordsProcessed} records successfully.`,
        });
      } else {
        toast({
          title: "Sync Completed with Issues",
          description: `Found ${result.recordsFound} records but processed ${result.recordsProcessed}. Check errors for details.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Attendance Sync</h1>
        <p className="text-muted-foreground">
          Manually sync attendance data from TeamOffice API
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Manual Sync
            </CardTitle>
            <CardDescription>
              Fetch and process today's attendance data from TeamOffice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={triggerSync} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Today's Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {lastSync && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {lastSync.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Last Sync Results
              </CardTitle>
              <CardDescription>
                {new Date(lastSync.lastFetchTime).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {lastSync.recordsFound} Found
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={lastSync.recordsProcessed > 0 ? "default" : "secondary"}>
                    {lastSync.recordsProcessed} Processed
                  </Badge>
                </div>
              </div>

              {lastSync.errors.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                  <div className="space-y-1">
                    {lastSync.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-sm text-red-600">
                        {index + 1}. {error}
                      </div>
                    ))}
                    {lastSync.errors.length > 5 && (
                      <div className="text-sm text-muted-foreground">
                        ... and {lastSync.errors.length - 5} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
