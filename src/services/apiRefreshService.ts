import { supabaseService } from '@/integrations/supabase/service';
import { fetchAttendanceDataFromAPI } from './autoFetchService';
import { fetchTeamOfficeEmployees, syncTeamOfficeEmployees } from './teamOfficeEmployees';
import { testTeamOfficeConnection } from './teamOffice';

export interface ApiRefreshResult {
  success: boolean;
  timestamp: string;
  duration: number; // in milliseconds
  results: {
    connectionTest: {
      success: boolean;
      error?: string;
    };
    employeeSync: {
      success: boolean;
      employeesFetched: number;
      employeesSynced: number;
      errors: string[];
    };
    attendanceSync: {
      success: boolean;
      recordsFound: number;
      recordsProcessed: number;
      errors: string[];
    };
  };
  errors: string[];
}

export interface ApiRefreshLog {
  id: string;
  admin_user_id: string;
  success: boolean;
  duration_ms: number;
  connection_test_success: boolean;
  connection_test_error?: string;
  employee_sync_success: boolean;
  employee_sync_fetched: number;
  employee_sync_synced: number;
  employee_sync_errors: string[];
  attendance_sync_success: boolean;
  attendance_sync_found: number;
  attendance_sync_processed: number;
  attendance_sync_errors: string[];
  total_errors: string[];
  created_at: string;
}

/**
 * Perform a complete API refresh and log results
 */
export async function performApiRefresh(adminUserId: string): Promise<ApiRefreshResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  console.log('🔄 Starting API refresh...');

  const result: ApiRefreshResult = {
    success: true,
    timestamp,
    duration: 0,
    results: {
      connectionTest: { success: false },
      employeeSync: { success: false, employeesFetched: 0, employeesSynced: 0, errors: [] },
      attendanceSync: { success: false, recordsFound: 0, recordsProcessed: 0, errors: [] }
    },
    errors: []
  };

  try {
    // 1. Test TeamOffice connection
    console.log('🔍 Testing TeamOffice connection...');
    try {
      const connectionTest = await testTeamOfficeConnection();
      result.results.connectionTest = {
        success: connectionTest.success,
        error: connectionTest.error
      };
      
      if (!connectionTest.success) {
        errors.push(`Connection test failed: ${connectionTest.error}`);
        result.success = false;
      }
    } catch (error) {
      const errorMsg = `Connection test error: ${error}`;
      errors.push(errorMsg);
      result.results.connectionTest.error = errorMsg;
      result.success = false;
    }

    // 2. Sync employees
    console.log('👥 Syncing employees...');
    try {
      const employees = await fetchTeamOfficeEmployees();
      const syncResult = await syncTeamOfficeEmployees(employees);
      
      result.results.employeeSync = {
        success: syncResult.success,
        employeesFetched: employees.length,
        employeesSynced: syncResult.employeesSynced,
        errors: syncResult.errors
      };

      if (!syncResult.success) {
        errors.push(...syncResult.errors);
        result.success = false;
      }
    } catch (error) {
      const errorMsg = `Employee sync error: ${error}`;
      errors.push(errorMsg);
      result.results.employeeSync.errors = [errorMsg];
      result.success = false;
    }

    // 3. Sync attendance data
    console.log('⏰ Syncing attendance data...');
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceResult = await fetchAttendanceDataFromAPI({
        startDate: today,
        endDate: today,
        forceRefresh: true
      });

      result.results.attendanceSync = {
        success: attendanceResult.success,
        recordsFound: attendanceResult.recordsFound,
        recordsProcessed: attendanceResult.recordsProcessed,
        errors: attendanceResult.errors
      };

      if (!attendanceResult.success) {
        errors.push(...attendanceResult.errors);
        result.success = false;
      }
    } catch (error) {
      const errorMsg = `Attendance sync error: ${error}`;
      errors.push(errorMsg);
      result.results.attendanceSync.errors = [errorMsg];
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    result.errors = errors;

    // 4. Log results to Supabase
    console.log('📝 Logging results to Supabase...');
    try {
      await logApiRefreshResult(adminUserId, result);
    } catch (error) {
      console.error('Failed to log API refresh result:', error);
      errors.push(`Logging error: ${error}`);
    }

    console.log(`✅ API refresh completed in ${result.duration}ms`);
    return result;

  } catch (error) {
    result.duration = Date.now() - startTime;
    result.success = false;
    result.errors = [...errors, `General error: ${error}`];
    
    console.error('❌ API refresh failed:', error);
    return result;
  }
}

/**
 * Log API refresh results to Supabase
 */
async function logApiRefreshResult(adminUserId: string, result: ApiRefreshResult): Promise<void> {
  try {
    const logData = {
      admin_user_id: adminUserId,
      success: result.success,
      duration_ms: result.duration,
      connection_test_success: result.results.connectionTest.success,
      connection_test_error: result.results.connectionTest.error || null,
      employee_sync_success: result.results.employeeSync.success,
      employee_sync_fetched: result.results.employeeSync.employeesFetched,
      employee_sync_synced: result.results.employeeSync.employeesSynced,
      employee_sync_errors: result.results.employeeSync.errors,
      attendance_sync_success: result.results.attendanceSync.success,
      attendance_sync_found: result.results.attendanceSync.recordsFound,
      attendance_sync_processed: result.results.attendanceSync.recordsProcessed,
      attendance_sync_errors: result.results.attendanceSync.errors,
      total_errors: result.errors
    };

    const { error } = await supabaseService
      .from('api_refresh_logs')
      .insert(logData);

    if (error) {
      console.warn('Failed to log API refresh (table may not exist):', error.message);
      // Don't throw error, just log it
    }
  } catch (error) {
    console.warn('Failed to log API refresh:', error);
    // Don't throw error, just log it
  }
}

/**
 * Get recent API refresh logs
 */
export async function getApiRefreshLogs(limit: number = 10): Promise<ApiRefreshLog[]> {
  try {
    const { data, error } = await supabaseService
      .from('api_refresh_logs')
      .select(`
        *,
        profiles:admin_user_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Failed to fetch API refresh logs (table may not exist):', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn('Failed to fetch API refresh logs:', error);
    return [];
  }
}
