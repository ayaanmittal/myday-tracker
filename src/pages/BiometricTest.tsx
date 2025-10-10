import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ApiTestResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  endpoint: string;
}

interface BiometricLog {
  id: string;
  name: string;
  empCode: string;
  punchTime: string;
  type: 'checkin' | 'checkout' | 'unknown';
  deviceId: string;
  source: string;
}

export function BiometricTest() {
  const [isScanning, setIsScanning] = useState(false);
  const [testResults, setTestResults] = useState<ApiTestResult[]>([]);
  const [biometricLogs, setBiometricLogs] = useState<BiometricLog[]>([]);
  const [lastRecord, setLastRecord] = useState('092020$0');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      runAllTests();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const addTestResult = (result: ApiTestResult) => {
    setTestResults(prev => [result, ...prev.slice(0, 19)]); // Keep last 20 results
  };

  const testApiEndpoint = async (endpoint: string, params: any = {}) => {
    try {
      const response = await fetch(`/api/test/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      addTestResult({
        success: response.ok,
        data: data,
        error: response.ok ? undefined : data.error || 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: endpoint
      });

      return data;
    } catch (error) {
      addTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date().toISOString(),
        endpoint: endpoint
      });
      return null;
    }
  };

  const runAllTests = async () => {
    setIsScanning(true);
    
    // Test 1: Health check
    await testApiEndpoint('health');
    
    // Test 2: TeamOffice connection
    const teamOfficeResult = await testApiEndpoint('teamoffice');
    
    // Test 3: LastRecord sync
    await testApiEndpoint('lastrecord', { lastRecord });
    
    // Test 4: Date range test
    await testApiEndpoint('daterange', { 
      fromDate: `${testDate}_00:00`, 
      toDate: `${testDate}_23:59` 
    });
    
    // Test 5: Employee sync
    await testApiEndpoint('employees');
    
    // If TeamOffice test was successful, try to get recent logs
    if (teamOfficeResult?.success && teamOfficeResult.data) {
      await fetchRecentLogs();
    }
    
    setIsScanning(false);
  };

  const fetchRecentLogs = async () => {
    try {
      const response = await fetch('/api/attendance/recent');
      const data = await response.json();
      
      if (data.success && data.data) {
        const logs: BiometricLog[] = data.data.map((log: any) => ({
          id: log.id,
          name: log.employee_name || 'Unknown',
          empCode: log.employee_id,
          punchTime: new Date(log.log_time).toLocaleString(),
          type: log.log_type,
          deviceId: log.device_id || 'N/A',
          source: log.source
        }));
        setBiometricLogs(logs);
      }
    } catch (error) {
      console.error('Error fetching recent logs:', error);
    }
  };

  const startScanning = () => {
    runAllTests();
  };

  const clearResults = () => {
    setTestResults([]);
    setBiometricLogs([]);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Biometric API Test</h1>
        <p className="text-muted-foreground">
          Test your TeamOffice biometric device integration and see real-time data
        </p>
      </div>

      <Tabs defaultValue="test" className="space-y-6">
        <TabsList>
          <TabsTrigger value="test">API Tests</TabsTrigger>
          <TabsTrigger value="logs">Biometric Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-6">
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Test Controls</CardTitle>
              <CardDescription>
                Run API tests to check TeamOffice integration and biometric data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={startScanning} 
                  disabled={isScanning}
                  className="flex items-center gap-2"
                >
                  {isScanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isScanning ? 'Testing...' : 'Run All Tests'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={clearResults}
                  disabled={isScanning}
                >
                  Clear Results
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <Label htmlFor="lastRecord">Last Record:</Label>
                <Input
                  id="lastRecord"
                  value={lastRecord}
                  onChange={(e) => setLastRecord(e.target.value)}
                  placeholder="092020$0"
                  className="w-32"
                />
                
                <Label htmlFor="testDate">Test Date:</Label>
                <Input
                  id="testDate"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Real-time API test results and responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {testResults.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No tests run yet. Click "Run All Tests" to start.
                    </p>
                  ) : (
                    testResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{result.endpoint}</span>
                            <Badge variant={result.success ? 'default' : 'destructive'}>
                              {result.success ? 'Success' : 'Failed'}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        {result.error && (
                          <Alert className="mb-2">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>{result.error}</AlertDescription>
                          </Alert>
                        )}
                        
                        {result.data && (
                          <div className="bg-muted p-3 rounded text-sm">
                            <pre className="whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Biometric Logs</CardTitle>
              <CardDescription>
                Latest attendance data from your biometric device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {biometricLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No biometric logs found. Run tests to fetch data.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {biometricLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{log.name}</span>
                            <span className="text-muted-foreground ml-2">({log.empCode})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              log.type === 'checkin' ? 'default' : 
                              log.type === 'checkout' ? 'secondary' : 'outline'
                            }>
                              {log.type}
                            </Badge>
                            <Badge variant="outline">{log.source}</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {log.punchTime} • Device: {log.deviceId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Refresh Settings</CardTitle>
              <CardDescription>
                Configure automatic testing and data fetching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <Label htmlFor="autoRefresh">Enable auto-refresh</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label htmlFor="interval">Refresh interval (seconds):</Label>
                <Input
                  id="interval"
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  min="10"
                  max="300"
                  className="w-20"
                />
              </div>
              
              {autoRefresh && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Auto-refresh is active. Tests will run every {refreshInterval} seconds.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
