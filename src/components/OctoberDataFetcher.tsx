import React, { useState } from 'react';
import { Button } from './ui/button';
import { Calendar, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchOctoberAttendanceData } from '../scripts/fetchOctoberAttendance';
import { useToast } from '../hooks/use-toast';

export function OctoberDataFetcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<{
    success: boolean;
    recordsFound: number;
    recordsProcessed: number;
    errors: string[];
  } | null>(null);
  const { toast } = useToast();

  const handleFetchOctoberData = async () => {
    setIsLoading(true);
    setLastFetch(null);
    
    try {
      console.log('🚀 Starting October data fetch...');
      
      const result = await fetchOctoberAttendanceData();
      setLastFetch(result);

      if (result.success) {
        toast({
          title: 'October Data Fetched Successfully!',
          description: `Found ${result.recordsFound} records and processed ${result.recordsProcessed} successfully.`,
        });
      } else {
        toast({
          title: 'October Data Fetch Completed with Errors',
          description: `Found ${result.recordsFound} records but had ${result.errors.length} errors. Check console for details.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ October data fetch failed:', error);
      toast({
        title: 'October Data Fetch Failed',
        description: 'Failed to fetch October data. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        <h3 className="text-lg font-semibold">October Data Fetcher</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Fetch attendance data from TeamOffice API from October 1st to today and populate the unified_attendance table.
      </p>

      <Button
        onClick={handleFetchOctoberData}
        disabled={isLoading}
        className="w-full sm:w-auto"
      >
        {isLoading ? (
          <Download className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {isLoading ? 'Fetching October Data...' : 'Fetch October Data'}
      </Button>

      {lastFetch && (
        <div className="mt-4 p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {lastFetch.success ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            <h4 className="font-semibold">
              {lastFetch.success ? 'Fetch Completed Successfully' : 'Fetch Completed with Warnings'}
            </h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Records Found:</span> {lastFetch.recordsFound}
            </div>
            <div>
              <span className="font-medium">Records Processed:</span> {lastFetch.recordsProcessed}
            </div>
            <div>
              <span className="font-medium">Errors:</span> {lastFetch.errors.length}
            </div>
            <div>
              <span className="font-medium">Success Rate:</span> {lastFetch.recordsFound > 0 ? Math.round((lastFetch.recordsProcessed / lastFetch.recordsFound) * 100) : 0}%
            </div>
          </div>

          {lastFetch.errors.length > 0 && (
            <div className="mt-3">
              <h5 className="font-medium text-sm mb-2">Errors:</h5>
              <div className="max-h-32 overflow-y-auto">
                {lastFetch.errors.map((error, index) => (
                  <div key={index} className="text-xs text-red-600 mb-1">
                    {index + 1}. {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

