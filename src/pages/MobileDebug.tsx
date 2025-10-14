import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function MobileDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();

    const updateDebugInfo = () => {
      const info = {
        userAgent: navigator.userAgent,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        screen: `${screen.width}x${screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        readyState: document.readyState,
        reactLoaded: !!(window as any).reactLoaded,
        timestamp: new Date().toISOString()
      };
      setDebugInfo(info);
    };

    updateDebugInfo();

    // Error handlers
    const handleError = (event: ErrorEvent) => {
      const errorMsg = `JS Error: ${event.message} at ${event.filename}:${event.lineno}`;
      setErrors(prev => [...prev, errorMsg]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMsg = `Promise Rejection: ${event.reason}`;
      setErrors(prev => [...prev, errorMsg]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const clearErrors = () => {
    setErrors([]);
  };

  const testError = () => {
    // Intentionally throw an error to test error handling
    throw new Error('Test error for mobile debugging');
  };

  const testPromiseRejection = () => {
    // Intentionally reject a promise to test error handling
    Promise.reject(new Error('Test promise rejection for mobile debugging'));
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mobile Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div><strong>Is Mobile:</strong> {isMobile ? 'Yes' : 'No'}</div>
            <div><strong>User Agent:</strong> {debugInfo.userAgent}</div>
            <div><strong>Viewport:</strong> {debugInfo.viewport}</div>
            <div><strong>Screen:</strong> {debugInfo.screen}</div>
            <div><strong>Device Pixel Ratio:</strong> {debugInfo.devicePixelRatio}</div>
            <div><strong>Platform:</strong> {debugInfo.platform}</div>
            <div><strong>Language:</strong> {debugInfo.language}</div>
            <div><strong>Cookies Enabled:</strong> {debugInfo.cookieEnabled ? 'Yes' : 'No'}</div>
            <div><strong>Online:</strong> {debugInfo.onLine ? 'Yes' : 'No'}</div>
            <div><strong>Document Ready State:</strong> {debugInfo.readyState}</div>
            <div><strong>React Loaded:</strong> {debugInfo.reactLoaded ? 'Yes' : 'No'}</div>
            <div><strong>Timestamp:</strong> {debugInfo.timestamp}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {errors.length === 0 ? (
              <div className="text-muted-foreground">No errors detected</div>
            ) : (
              errors.map((error, index) => (
                <div key={index} className="text-sm bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </div>
              ))
            )}
            <div className="flex gap-2 mt-4">
              <Button onClick={clearErrors} variant="outline" size="sm">
                Clear Errors
              </Button>
              <Button onClick={testError} variant="destructive" size="sm">
                Test Error
              </Button>
              <Button onClick={testPromiseRejection} variant="destructive" size="sm">
                Test Promise Rejection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Console Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Check the browser console for detailed error information.
            <br />
            On mobile, you can access the console through:
            <br />
            • Chrome: chrome://inspect
            <br />
            • Safari: Settings → Advanced → Web Inspector
            <br />
            • Firefox: about:debugging
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
