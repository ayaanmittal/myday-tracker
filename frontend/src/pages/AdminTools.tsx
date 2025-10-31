import { Layout } from '@/components/Layout';
import { AdminRefreshApiButton } from '@/components/AdminRefreshApiButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Settings, RefreshCw, Database, Users, Calendar, Clock, Download, FileArchive, BarChart3, TrendingUp, Activity, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SystemMetrics {
  totalEmployees: number;
  totalAttendanceRecords: number;
  totalTasks: number;
  totalLeaves: number;
  totalViolations: number;
  totalMessages: number;
  recentActivity: number;
}

export default function AdminTools() {
  const { data: role } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalEmployees: 0,
    totalAttendanceRecords: 0,
    totalTasks: 0,
    totalLeaves: 0,
    totalViolations: 0,
    totalMessages: 0,
    recentActivity: 0,
  });

  // Fetch system metrics
  useEffect(() => {
    if (role === 'admin') {
      fetchMetrics();
    }
  }, [role]);

  const fetchMetrics = async () => {
    try {
      // Fetch counts from different tables
      const [
        employeesData,
        attendanceData,
        tasksData,
        leavesData,
        violationsData,
        messagesData,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('unified_attendance').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('leaves').select('id', { count: 'exact', head: true }),
        supabase.from('rule_violations').select('id', { count: 'exact', head: true }),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
      ]);

      const recentActivity = await supabase
        .from('unified_attendance')
        .select('id', { count: 'exact', head: true })
        .gte('entry_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      setMetrics({
        totalEmployees: employeesData.count || 0,
        totalAttendanceRecords: attendanceData.count || 0,
        totalTasks: tasksData.count || 0,
        totalLeaves: leavesData.count || 0,
        totalViolations: violationsData.count || 0,
        totalMessages: messagesData.count || 0,
        recentActivity: recentActivity.count || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch system metrics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate backup data
  const generateBackup = async (format: 'pdf' | 'zip') => {
    try {
      if (format === 'pdf') {
        generatePDFBackup();
      } else {
        toast({
          title: 'Not Implemented',
          description: 'ZIP backup feature is coming soon',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate backup',
        variant: 'destructive',
      });
    }
  };

  const generatePDFBackup = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('System Backup Report', 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    let yPos = 40;

    // System Metrics
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('System Metrics', 14, yPos);
    yPos += 10;

    const metricsData = [
      ['Metric', 'Count'],
      ['Total Employees', metrics.totalEmployees.toString()],
      ['Attendance Records', metrics.totalAttendanceRecords.toString()],
      ['Tasks', metrics.totalTasks.toString()],
      ['Leaves', metrics.totalLeaves.toString()],
      ['Violations', metrics.totalViolations.toString()],
      ['Messages', metrics.totalMessages.toString()],
      ['Recent Activity (7 days)', metrics.recentActivity.toString()],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [metricsData[0]],
      body: metricsData.slice(1),
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [0, 0, 0] },
    });

    // Save PDF
    const fileName = `System_Backup_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    toast({
      title: 'Backup Generated',
      description: 'PDF backup has been downloaded successfully',
    });
  };

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
            System management, metrics, and backup tools
          </p>
        </div>

        {/* System Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              System Metrics
            </CardTitle>
            <CardDescription>
              Overview of system data and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <div className="text-3xl font-bold text-blue-700">{metrics.totalEmployees}</div>
                  <div className="text-sm text-blue-600 font-medium">Employees</div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <Activity className="h-8 w-8 text-green-600 mb-2" />
                  <div className="text-3xl font-bold text-green-700">{metrics.totalAttendanceRecords}</div>
                  <div className="text-sm text-green-600 font-medium">Attendance Records</div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <FileText className="h-8 w-8 text-purple-600 mb-2" />
                  <div className="text-3xl font-bold text-purple-700">{metrics.totalTasks}</div>
                  <div className="text-sm text-purple-600 font-medium">Tasks</div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                  <Calendar className="h-8 w-8 text-orange-600 mb-2" />
                  <div className="text-3xl font-bold text-orange-700">{metrics.totalLeaves}</div>
                  <div className="text-sm text-orange-600 font-medium">Leaves</div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                  <TrendingUp className="h-8 w-8 text-red-600 mb-2" />
                  <div className="text-3xl font-bold text-red-700">{metrics.recentActivity}</div>
                  <div className="text-sm text-red-600 font-medium">Recent Activity (7d)</div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <Activity className="h-8 w-8 text-yellow-600 mb-2" />
                  <div className="text-3xl font-bold text-yellow-700">{metrics.totalViolations}</div>
                  <div className="text-sm text-yellow-600 font-medium">Violations</div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200">
                  <FileText className="h-8 w-8 text-indigo-600 mb-2" />
                  <div className="text-3xl font-bold text-indigo-700">{metrics.totalMessages}</div>
                  <div className="text-sm text-indigo-600 font-medium">Messages</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Refresh Section */}
        <AdminRefreshApiButton />

        {/* Backup Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Backup & Export
            </CardTitle>
            <CardDescription>
              Generate system backups and export data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-300 transition-all"
                onClick={() => generateBackup('pdf')}
              >
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="text-center">
                  <div className="font-semibold">Download PDF Backup</div>
                  <div className="text-xs text-muted-foreground">System metrics and data</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-green-50 hover:border-green-300 transition-all"
                onClick={() => generateBackup('zip')}
                disabled
              >
                <FileArchive className="h-8 w-8 text-green-600" />
                <div className="text-center">
                  <div className="font-semibold">Download ZIP Backup</div>
                  <div className="text-xs text-muted-foreground">Coming soon</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

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
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor system performance and health metrics.
              </CardDescription>
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
                  <li>• View system metrics and statistics</li>
                  <li>• Sync attendance data from TeamOffice</li>
                  <li>• Update employee mappings</li>
                  <li>• Export system data as PDF</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">System Monitoring</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View API refresh logs</li>
                  <li>• Monitor sync performance</li>
                  <li>• Track error rates</li>
                  <li>• Check data counts</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
