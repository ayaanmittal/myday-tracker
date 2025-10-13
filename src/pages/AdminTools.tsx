import { Layout } from '@/components/Layout';
import { AdminRefreshApiButton } from '@/components/AdminRefreshApiButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate, Link } from 'react-router-dom';
import { Settings, RefreshCw, Database, Users, Calendar, Clock } from 'lucide-react';

export default function AdminTools() {
  const { data: role } = useUserRole();

  // Redirect non-admins
  if (role !== 'admin') {
    return <Navigate to="/today" replace />;
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
            Admin Tools
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">
            System management and API refresh tools
          </p>
        </div>

        {/* API Refresh Section */}
        <AdminRefreshApiButton />

        {/* Admin Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="h-5 w-5" />
                API Refresh
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manually trigger API calls to sync data from TeamOffice and check for updates.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Data Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Sync employee data and attendance records from external systems.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Employee Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage employee mappings and team member information.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Work Days Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Configure work days for each employee to calculate accurate attendance metrics.
              </CardDescription>
              <Link 
                to="/work-days-settings" 
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 mt-2"
              >
                Configure Work Days →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common administrative tasks and system operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Data Management</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Sync attendance data from TeamOffice</li>
                  <li>• Update employee mappings</li>
                  <li>• Check API connection status</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">System Monitoring</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View API refresh logs</li>
                  <li>• Monitor sync performance</li>
                  <li>• Track error rates</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}