import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ServerStatus {
  health: any;
  syncStatus: any;
  teamOfficeTest: any;
}

export function ServerStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const { joinApiPath } = await import('@/config/api');
      const [healthRes, syncRes, teamOfficeRes] = await Promise.allSettled([
        fetch(joinApiPath('/api/health')).then(r => r.json()),
        fetch(joinApiPath('/api/sync/status')).then(r => r.json()),
        fetch(joinApiPath('/api/test/teamoffice')).then(r => r.json())
      ]);

      setStatus({
        health: healthRes.status === 'fulfilled' ? healthRes.value : { error: healthRes.reason },
        syncStatus: syncRes.status === 'fulfilled' ? syncRes.value : { error: syncRes.reason },
        teamOfficeTest: teamOfficeRes.status === 'fulfilled' ? teamOfficeRes.value : { error: teamOfficeRes.reason }
      });
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading server status...</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Server Status</h1>
        <p className="text-muted-foreground">Check the health of your MyDay backend services</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Health Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Server Health
              <Badge variant={status?.health?.success ? 'default' : 'destructive'}>
                {status?.health?.success ? 'Healthy' : 'Error'}
              </Badge>
            </CardTitle>
            <CardDescription>Backend server status</CardDescription>
          </CardHeader>
          <CardContent>
            {status?.health?.success ? (
              <div className="space-y-2">
                <p><strong>Status:</strong> {status.health.message}</p>
                <p><strong>Environment:</strong> {status.health.environment}</p>
                <p><strong>Timestamp:</strong> {new Date(status.health.timestamp).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-destructive">Error: {status?.health?.error?.message || 'Unknown error'}</p>
            )}
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sync Status
              <Badge variant={status?.syncStatus?.success ? 'default' : 'destructive'}>
                {status?.syncStatus?.success ? 'Active' : 'Error'}
              </Badge>
            </CardTitle>
            <CardDescription>Attendance sync system</CardDescription>
          </CardHeader>
          <CardContent>
            {status?.syncStatus?.success ? (
              <div className="space-y-2">
                <p><strong>Last Record:</strong> {status.syncStatus.data?.[0]?.last_record || 'None'}</p>
                <p><strong>Last Sync:</strong> {status.syncStatus.data?.[0]?.last_sync_at ? new Date(status.syncStatus.data[0].last_sync_at).toLocaleString() : 'Never'}</p>
              </div>
            ) : (
              <p className="text-destructive">Error: {status?.syncStatus?.error?.message || 'Unknown error'}</p>
            )}
          </CardContent>
        </Card>

        {/* TeamOffice API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              TeamOffice API
              <Badge variant={status?.teamOfficeTest?.success ? 'default' : 'destructive'}>
                {status?.teamOfficeTest?.success ? 'Connected' : 'Error'}
              </Badge>
            </CardTitle>
            <CardDescription>Biometric device integration</CardDescription>
          </CardHeader>
          <CardContent>
            {status?.teamOfficeTest?.success ? (
              <div className="space-y-2">
                <p>API connection successful</p>
                <p><strong>Records:</strong> {status.teamOfficeTest.data?.length || 0}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-destructive">Error: {status?.teamOfficeTest?.error || 'API connection failed'}</p>
                <p className="text-sm text-muted-foreground">
                  This is expected if you haven't set up your TeamOffice credentials yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manage server operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={fetchStatus} className="w-full">
              Refresh Status
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open('/api/health', '_blank')}
            >
              View Raw Health Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
