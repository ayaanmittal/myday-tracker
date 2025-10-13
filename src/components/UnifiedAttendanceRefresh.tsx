import React, { useState } from 'react';
import { Button } from './ui/button';
import { RefreshCw, Database } from 'lucide-react';
import { fetchAttendanceDataFromAPI } from '../services/autoFetchService';
import { useToast } from '../hooks/use-toast';

export function UnifiedAttendanceRefresh() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Starting unified attendance refresh...');
      
      const result = await fetchAttendanceDataFromAPI({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
        endDate: new Date().toISOString().split('T')[0], // Today
        forceRefresh: true
      });

      if (result.success) {
        toast({
          title: 'Refresh Successful!',
          description: `Fetched ${result.recordsFound} records and processed ${result.recordsProcessed} successfully.`,
        });
        console.log('✅ Unified attendance refresh completed:', result);
      } else {
        toast({
          title: 'Refresh Failed',
          description: `Found ${result.recordsFound} records but had ${result.errors.length} errors. Check console for details.`,
          variant: 'destructive',
        });
        console.error('❌ Unified attendance refresh failed:', result.errors);
      }
    } catch (error) {
      console.error('❌ Unified attendance refresh error:', error);
      toast({
        title: 'Refresh Error',
        description: 'Failed to refresh attendance data. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleRefresh}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        {isLoading ? 'Refreshing...' : 'Refresh API Data'}
      </Button>
    </div>
  );
}

