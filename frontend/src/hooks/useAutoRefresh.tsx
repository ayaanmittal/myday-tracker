import { useState, useEffect, useCallback } from 'react';
import { 
  startAutoRefresh, 
  stopAutoRefresh, 
  getAutoRefreshStatus,
  DEFAULT_AUTO_REFRESH_CONFIG,
  type AutoRefreshConfig,
  type FetchResult
} from '@/services/autoFetchServiceClient';
import { toast } from './use-toast';

export interface UseAutoRefreshOptions {
  enabled?: boolean;
  intervalMinutes?: number;
  onDataUpdate?: (result: FetchResult) => void;
  onError?: (error: string) => void;
}

export function useAutoRefresh(options: UseAutoRefreshOptions = {}) {
  const [isActive, setIsActive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const config: AutoRefreshConfig = {
    enabled: options.enabled ?? false, // Disabled by default
    intervalMinutes: options.intervalMinutes ?? 10, // 10 minutes by default
    maxRetries: 3,
    retryDelayMs: 5000
  };

  const handleDataUpdate = useCallback((result: FetchResult) => {
    setLastRefreshTime(new Date());
    setRefreshCount(prev => prev + 1);
    setIsRefreshing(false);
    
    if (result.recordsProcessed > 0) {
      toast({
        title: 'Data Updated',
        description: `Fetched ${result.recordsProcessed} new attendance records`,
      });
    }
    
    options.onDataUpdate?.(result);
  }, [options.onDataUpdate]);

  const handleError = useCallback((error: string) => {
    setIsRefreshing(false);
    toast({
      title: 'Auto-refresh Error',
      description: error,
      variant: 'destructive',
    });
    options.onError?.(error);
  }, [options.onError]);

  const start = useCallback(() => {
    if (isActive) return;
    
    startAutoRefresh(config, handleDataUpdate, handleError);
    setIsActive(true);
    console.log('🔄 Auto-refresh started');
  }, [config, handleDataUpdate, handleError, isActive]);

  const stop = useCallback(() => {
    if (!isActive) return;
    
    stopAutoRefresh();
    setIsActive(false);
    console.log('🛑 Auto-refresh stopped');
  }, [isActive]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, start, stop]);

  // Update status periodically
  useEffect(() => {
    const statusInterval = setInterval(() => {
      const status = getAutoRefreshStatus();
      setIsActive(status.isActive);
      setIsRefreshing(status.isRefreshing);
    }, 1000);

    return () => clearInterval(statusInterval);
  }, []);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (config.enabled) {
      start();
    }

    // Cleanup on unmount
    return () => {
      stop();
    };
  }, [config.enabled, start, stop]);

  return {
    isActive,
    isRefreshing,
    lastRefreshTime,
    refreshCount,
    start,
    stop,
    toggle,
    config
  };
}
