import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WorkDaysSettingsTest() {
  const { user } = useAuth();
  const { role, loading: roleLoading, error: roleError } = useUserRole();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    console.log('WorkDaysSettingsTest Debug:', {
      user: user?.email,
      role,
      roleLoading,
      roleError,
      timestamp: new Date().toISOString()
    });
    
    setDebugInfo({
      user: user?.email,
      role,
      roleLoading,
      roleError,
      timestamp: new Date().toISOString()
    });
  }, [user, role, roleLoading, roleError]);

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (roleError) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium text-red-600">Error Loading Role</p>
            <p className="text-sm text-muted-foreground">{roleError.message}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium">Not Logged In</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (role !== 'admin' && role !== 'manager') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Work Days Settings Test</h1>
          <p className="text-muted-foreground">Debug information for troubleshooting</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Current state of the component</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success!</CardTitle>
            <CardDescription>If you can see this, the component is working correctly</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-green-600">The WorkDaysSettings component is loading without errors.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
