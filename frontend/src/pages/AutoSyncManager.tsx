import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { joinApiPath } from '@/config/api';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Settings,
  Activity
} from 'lucide-react';

interface SyncStatus {
  isRunning: boolean;
  lastEmployeeSync?: string;
  lastAttendanceSync?: string;
  totalEmployees: number;
  totalMappings: number;
  totalAttendanceRecords: number;
}

interface SyncConfig {
  syncEmployees: boolean;
  employeeSyncInterval: string;
  syncAttendance: boolean;
  attendanceSyncInterval: string;
  attendanceSyncMode: 'incremental' | 'daily' | 'range';
  autoMapEmployees: boolean;
  autoMapThreshold: number;
}

export function AutoSyncManager() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [config, setConfig] = useState<SyncConfig>({
    syncEmployees: true,
    employeeSyncInterval: '0 2 * * *', // Daily at 2 AM
    syncAttendance: true,
    attendanceSyncInterval: '*/15 * * * *', // Every 15 minutes
    attendanceSyncMode: 'incremental',
    autoMapEmployees: true,
    autoMapThreshold: 0.8
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastSync, setLastSync] = useState<{
    employees?: { success: boolean; message: string };
    attendance?: { success: boolean; message: string };
  }>({});

  // Load initial data
  useEffect(() => {
    loadSyncStatus();
    loadConfig();
  }, []);

  const loadSyncStatus = async () => {
    try {
      // Get sync status from unified_attendance table
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('unified_attendance')
        .select('count')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      const { data: employeeData, error: employeeError } = await supabase
        .from('employee_mappings')
        .select('count');

      setSyncStatus({
        isActive: false, // Auto sync is not implemented in this frontend-only setup
        lastSync: attendanceData ? new Date().toISOString() : null,
        totalRecords: attendanceData?.length || 0,
        totalEmployees: employeeData?.length || 0,
        errors: attendanceError ? [attendanceError.message] : []
      });
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadConfig = async () => {
    try {
      // Set default config since we don't have a backend API
      setConfig({
        autoSyncEnabled: false,
        syncInterval: 30,
        maxRetries: 3,
        timeout: 30000
      });
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const startSync = async () => {
    setIsLoading(true);
    try {
      // Show message that sync is not available in frontend-only setup
      setLastSync(prev => ({
        ...prev,
        sync: {
          success: false,
          message: 'Auto sync is not available in this frontend-only setup. Use manual data refresh instead.'
        }
      }));
    } catch (error) {
      console.error('Error starting sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSync = async () => {
    setIsLoading(true);
    try {
      setIsRunning(false);
      setLastSync(prev => ({
        ...prev,
        sync: {
          success: true,
          message: 'Sync stopped (not applicable in frontend-only setup)'
        }
      }));
    } catch (error) {
      console.error('Error stopping sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runEmployeeSync = async () => {
    setIsLoading(true);
    try {
      // Show message that employee sync is not available in frontend-only setup
      setLastSync(prev => ({
        ...prev,
        employees: {
          success: false,
          message: 'Employee sync is not available in this frontend-only setup. Use manual employee management instead.'
        }
      }));
    } catch (error) {
      setLastSync(prev => ({
        ...prev,
        employees: {
          success: false,
          message: `Error: ${error}`
        }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const runAttendanceSync = async () => {
    setIsLoading(true);
    try {
      // Show message that attendance sync is not available in frontend-only setup
      setLastSync(prev => ({
        ...prev,
        attendance: {
          success: false,
          message: 'Attendance sync is not available in this frontend-only setup. Use manual data refresh instead.'
        }
      }));
    } catch (error) {
      setLastSync(prev => ({
        ...prev,
        attendance: {
          success: false,
          message: `Error: ${error}`
        }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async () => {
    try {
      // Show message that config update is not available in frontend-only setup
      console.log('Config update not available in frontend-only setup');
    } catch (error) {
      console.error('Error updating config:', error);
    }
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getIntervalDescription = (interval: string) => {
    switch (interval) {
      case '*/15 * * * *': return 'Every 15 minutes';
      case '*/30 * * * *': return 'Every 30 minutes';
      case '0 * * * *': return 'Every hour';
      case '0 2 * * *': return 'Daily at 2 AM';
      case '0 2 * * 1': return 'Weekly on Monday at 2 AM';
      default: return interval;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Auto Data Sync Manager
          </CardTitle>
          <CardDescription>
            Automatically sync employees and attendance data from TeamOffice API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sync Status */}
          {syncStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{syncStatus.totalEmployees}</div>
                <div className="text-sm text-gray-600">Employees</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{syncStatus.totalMappings}</div>
                <div className="text-sm text-gray-600">Mappings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{syncStatus.totalAttendanceRecords}</div>
                <div className="text-sm text-gray-600">Attendance Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {syncStatus.isRunning ? 'Running' : 'Stopped'}
                </div>
                <div className="text-sm text-gray-600">Status</div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={isRunning ? stopSync : startSync}
              disabled={isLoading}
              variant={isRunning ? 'destructive' : 'default'}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Stop Sync' : 'Start Sync'}
            </Button>

            <Button
              onClick={runEmployeeSync}
              disabled={isLoading}
              variant="outline"
            >
              <Users className="h-4 w-4" />
              Sync Employees Now
            </Button>

            <Button
              onClick={runAttendanceSync}
              disabled={isLoading}
              variant="outline"
            >
              <Clock className="h-4 w-4" />
              Sync Attendance Now
            </Button>
          </div>

          {/* Last Sync Results */}
          {(lastSync.employees || lastSync.attendance) && (
            <div className="space-y-2">
              <h4 className="font-medium">Last Sync Results:</h4>
              {lastSync.employees && (
                <Alert>
                  <AlertDescription>
                    <div className="flex items-center gap-2">
                      {lastSync.employees.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">Employees:</span>
                      <span>{lastSync.employees.message}</span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              {lastSync.attendance && (
                <Alert>
                  <AlertDescription>
                    <div className="flex items-center gap-2">
                      {lastSync.attendance.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">Attendance:</span>
                      <span>{lastSync.attendance.message}</span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Sync Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Employee Sync */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="sync-employees">Sync Employees</Label>
                  <p className="text-sm text-gray-600">
                    Automatically fetch and sync employee data
                  </p>
                </div>
                <Switch
                  id="sync-employees"
                  checked={config.syncEmployees}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, syncEmployees: checked }))
                  }
                />
              </div>

              {config.syncEmployees && (
                <div className="ml-4 space-y-2">
                  <Label>Sync Interval</Label>
                  <select
                    value={config.employeeSyncInterval}
                    onChange={(e) => 
                      setConfig(prev => ({ ...prev, employeeSyncInterval: e.target.value }))
                    }
                    className="w-full p-2 border rounded"
                  >
                    <option value="0 2 * * *">Daily at 2 AM</option>
                    <option value="0 2 * * 1">Weekly on Monday at 2 AM</option>
                    <option value="0 2 */3 * *">Every 3 days at 2 AM</option>
                  </select>
                  <p className="text-sm text-gray-600">
                    {getIntervalDescription(config.employeeSyncInterval)}
                  </p>
                </div>
              )}

              {/* Attendance Sync */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="sync-attendance">Sync Attendance</Label>
                  <p className="text-sm text-gray-600">
                    Automatically fetch and sync attendance data
                  </p>
                </div>
                <Switch
                  id="sync-attendance"
                  checked={config.syncAttendance}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, syncAttendance: checked }))
                  }
                />
              </div>

              {config.syncAttendance && (
                <div className="ml-4 space-y-2">
                  <Label>Sync Interval</Label>
                  <select
                    value={config.attendanceSyncInterval}
                    onChange={(e) => 
                      setConfig(prev => ({ ...prev, attendanceSyncInterval: e.target.value }))
                    }
                    className="w-full p-2 border rounded"
                  >
                    <option value="*/15 * * * *">Every 15 minutes</option>
                    <option value="*/30 * * * *">Every 30 minutes</option>
                    <option value="0 * * * *">Every hour</option>
                    <option value="0 */2 * * *">Every 2 hours</option>
                  </select>
                  <p className="text-sm text-gray-600">
                    {getIntervalDescription(config.attendanceSyncInterval)}
                  </p>

                  <Label>Sync Mode</Label>
                  <select
                    value={config.attendanceSyncMode}
                    onChange={(e) => 
                      setConfig(prev => ({ 
                        ...prev, 
                        attendanceSyncMode: e.target.value as 'incremental' | 'daily' | 'range'
                      }))
                    }
                    className="w-full p-2 border rounded"
                  >
                    <option value="incremental">Incremental (recommended)</option>
                    <option value="daily">Daily</option>
                    <option value="range">Last 7 days</option>
                  </select>
                </div>
              )}

              {/* Auto-mapping */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-map">Auto-map Employees</Label>
                  <p className="text-sm text-gray-600">
                    Automatically create mappings for high-confidence matches
                  </p>
                </div>
                <Switch
                  id="auto-map"
                  checked={config.autoMapEmployees}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, autoMapEmployees: checked }))
                  }
                />
              </div>

              {config.autoMapEmployees && (
                <div className="ml-4 space-y-2">
                  <Label>Auto-map Threshold</Label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.1"
                    value={config.autoMapThreshold}
                    onChange={(e) => 
                      setConfig(prev => ({ ...prev, autoMapThreshold: parseFloat(e.target.value) }))
                    }
                    className="w-full"
                  />
                  <p className="text-sm text-gray-600">
                    {(config.autoMapThreshold * 100).toFixed(0)}% confidence required for auto-mapping
                  </p>
                </div>
              )}

              <Button onClick={updateConfig} className="w-full">
                Save Configuration
              </Button>
            </CardContent>
          </Card>

          {/* Last Sync Times */}
          {syncStatus && (
            <div className="text-sm text-gray-600">
              <p>Last Employee Sync: {formatLastSync(syncStatus.lastEmployeeSync)}</p>
              <p>Last Attendance Sync: {formatLastSync(syncStatus.lastAttendanceSync)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


















