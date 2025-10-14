import { supabase } from '@/integrations/supabase/client';
import { getInOutPunchData, getRawRangeMCID } from './teamOfficeClient';

export interface FetchOptions {
  startDate?: string; // YYYY-MM-DD format
  endDate?: string;   // YYYY-MM-DD format
  forceRefresh?: boolean;
}

export interface AutoRefreshConfig {
  enabled: boolean;
  intervalMinutes: number; // How often to fetch data
  maxRetries: number;
  retryDelayMs: number;
}

export interface FetchResult {
  success: boolean;
  recordsProcessed: number;
  recordsFound: number;
  errors: string[];
  lastFetchTime: string;
}

/**
 * Convert date from YYYY-MM-DD to DD/MM/YYYY format for TeamOffice API
 */
function formatDateForAPI(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Get current date in DD/MM/YYYY format for TeamOffice API
 */
function getCurrentDateForAPI(): string {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const year = today.getFullYear().toString();
  return `${day}/${month}/${year}`;
}

/**
 * Convert date from DD/MM/YYYY to YYYY-MM-DD format
 */
function formatDateFromAPI(dateString: string): string {
  const [day, month, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Fetch attendance data from TeamOffice API for a specific date range (Client-side)
 */
export async function fetchAttendanceDataFromAPIClient(
  options: FetchOptions = {}
): Promise<FetchResult> {
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsProcessed = 0;

  try {
    // Determine date range
    const endDate = options.endDate || new Date().toISOString().split('T')[0];
    const startDate = options.startDate || endDate;

    console.log(`📅 Fetching attendance data from ${startDate} to ${endDate}`);

    // Format dates for TeamOffice InOut API (DD/MM/YYYY format)
    const apiStartDate = formatDateForAPI(startDate);
    const apiEndDate = formatDateForAPI(endDate);

    console.log(`🔗 API Request: ${apiStartDate} to ${apiEndDate}`);

    // Fetch processed attendance data from TeamOffice API
    const attendanceData = await getInOutPunchData(apiStartDate, apiEndDate, 'ALL');

    if (!attendanceData || attendanceData.Error) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFound: 0,
        errors: [`TeamOffice API Error: ${attendanceData?.Msg || 'Unknown error'}`],
        lastFetchTime: new Date().toISOString()
      };
    }

    if (!attendanceData.InOutPunchData || !Array.isArray(attendanceData.InOutPunchData)) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFound: 0,
        errors: ['No attendance data found from TeamOffice API'],
        lastFetchTime: new Date().toISOString()
      };
    }

    recordsFound = attendanceData.InOutPunchData.length;
    console.log(`📥 Found ${recordsFound} attendance records from TeamOffice`);

    // Process the attendance data that already has INTime and OUTTime
    const attendanceRecords = attendanceData.InOutPunchData.map((record: any) => {
      // Convert date from DD/MM/YYYY to YYYY-MM-DD
      const formattedDate = formatDateFromAPI(record.DateString);

      return {
        Empcode: record.Empcode,
        Name: record.Name,
        INTime: record.INTime,
        OUTTime: record.OUTTime,
        WorkTime: record.WorkTime,
        OverTime: record.OverTime || "00:00",
        BreakTime: record.BreakTime || "01:00",
        Status: record.Status || "P",
        DateString: formattedDate,
        Remark: record.Remark || "",
        Erl_Out: record.Erl_Out || "00:00",
        Late_In: record.Late_In || "00:00",
        RawRecord: record // Keep original record for reference
      };
    });

    // Process and insert attendance records using client-side processing
    console.log(`🔄 Processing ${attendanceRecords.length} attendance records...`);
    const result = await processAndInsertAttendanceRecordsClient(attendanceRecords);

    recordsProcessed = result.processed;
    errors.push(...result.errors);

    console.log(`✅ Processed ${recordsProcessed} records successfully`);

    return {
      success: result.success,
      recordsProcessed,
      recordsFound,
      errors,
      lastFetchTime: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error fetching attendance data:', error);
    errors.push(`API Error: ${error}`);
    
    return {
      success: false,
      recordsProcessed: 0,
      recordsFound: 0,
      errors,
      lastFetchTime: new Date().toISOString()
    };
  }
}

/**
 * Process and insert attendance records using client-side Supabase
 */
async function processAndInsertAttendanceRecordsClient(
  records: any[]
): Promise<{
  success: boolean;
  processed: number;
  errors: string[];
}> {
  let processed = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      // Get user mapping using employee_mappings table
      const { data: userMapping, error: mappingError } = await supabase
        .from('employee_mappings')
        .select(`
          our_user_id,
          our_profile_id,
          teamoffice_name
        `)
        .eq('teamoffice_emp_code', record.Empcode)
        .eq('is_active', true)
        .single();

      if (mappingError || !userMapping) {
        errors.push(`No user mapping found for ${record.Empcode}`);
        continue;
      }

      // Create unified attendance record
      const checkInAt = record.INTime && record.INTime !== '--:--' && record.INTime !== '00:00' 
        ? `${record.DateString}T${record.INTime}:00+05:30` 
        : null;
      
      const checkOutAt = record.OUTTime && record.OUTTime !== '--:--' && record.OUTTime !== '00:00' 
        ? `${record.DateString}T${record.OUTTime}:00+05:30` 
        : null;

      // Calculate total work time in minutes
      let totalWorkTimeMinutes = 0;
      if (checkInAt && checkOutAt) {
        const inTime = new Date(checkInAt);
        const outTime = new Date(checkOutAt);
        totalWorkTimeMinutes = Math.round((outTime.getTime() - inTime.getTime()) / (1000 * 60));
      }

      // Determine status
      let status = 'absent';
      if (checkInAt && checkOutAt) {
        status = 'completed';
      } else if (checkInAt) {
        status = 'in_progress';
      }

      // Calculate late status based on settings
      let isLate = false;
      if (checkInAt) {
        try {
          // Get late threshold from settings
          const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'late_threshold_minutes')
            .single();
          
          const lateThresholdMinutes = settings?.value ? parseInt(settings.value) : 15;
          
          // Get workday start time from settings
          const { data: workdaySettings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'workday_start_time')
            .single();
          
          const workdayStartTime = workdaySettings?.value || '09:00';
          
          // Parse check-in time and workday start time
          const checkInTime = new Date(checkInAt);
          const [startHour, startMinute] = workdayStartTime.split(':').map(Number);
          const workdayStart = new Date(checkInTime);
          workdayStart.setHours(startHour, startMinute, 0, 0);
          
          // Calculate if check-in is after the late threshold
          const lateThresholdTime = new Date(workdayStart);
          lateThresholdTime.setMinutes(lateThresholdTime.getMinutes() + lateThresholdMinutes);
          
          isLate = checkInTime > lateThresholdTime;
        } catch (error) {
          console.warn('Error calculating late status, defaulting to not late:', error);
          // Fallback to not late if settings query fails
          isLate = false;
        }
      }

      // Check if record already exists
      const { data: existingRecord } = await supabase
        .from('unified_attendance')
        .select('id, check_in_at, check_out_at, status')
        .eq('user_id', userMapping.our_user_id)
        .eq('entry_date', record.DateString)
        .single();

      if (existingRecord) {
        // Check if record already has both check-in and check-out times
        const hasCompleteData = existingRecord.check_in_at && existingRecord.check_out_at;
        
        if (hasCompleteData) {
          // Skip updating records that already have complete attendance data
          console.log(`Skipping update for ${record.Empcode} - record already has complete data`);
          continue;
        }

        // Only update if record is incomplete (missing check-in or check-out)
        const updateData: any = {
          device_info: 'TeamOffice API',
          device_id: 'teamoffice',
          source: 'teamoffice',
          modification_reason: 'API Sync',
          updated_at: new Date().toISOString()
        };

        // Only update fields that are missing or need updating
        if (!existingRecord.check_in_at && checkInAt) {
          updateData.check_in_at = checkInAt;
        }
        if (!existingRecord.check_out_at && checkOutAt) {
          updateData.check_out_at = checkOutAt;
        }

        // Update status and work time only if we're adding new data
        if (updateData.check_in_at || updateData.check_out_at) {
          const finalCheckIn = updateData.check_in_at || existingRecord.check_in_at;
          const finalCheckOut = updateData.check_out_at || existingRecord.check_out_at;
          
          if (finalCheckIn && finalCheckOut) {
            const inTime = new Date(finalCheckIn);
            const outTime = new Date(finalCheckOut);
            updateData.total_work_time_minutes = Math.round((outTime.getTime() - inTime.getTime()) / (1000 * 60));
            updateData.status = 'completed';
          } else if (finalCheckIn) {
            updateData.status = 'in_progress';
          }

          // Calculate late status if we're updating check-in
          if (updateData.check_in_at) {
            try {
              const { data: settings } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'late_threshold_minutes')
                .single();
              
              const lateThresholdMinutes = settings?.value ? parseInt(settings.value) : 15;
              
              const { data: workdaySettings } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'workday_start_time')
                .single();
              
              const workdayStartTime = workdaySettings?.value || '09:00';
              
              const checkInTime = new Date(updateData.check_in_at);
              const [startHour, startMinute] = workdayStartTime.split(':').map(Number);
              const workdayStart = new Date(checkInTime);
              workdayStart.setHours(startHour, startMinute, 0, 0);
              
              const lateThresholdTime = new Date(workdayStart);
              lateThresholdTime.setMinutes(lateThresholdTime.getMinutes() + lateThresholdMinutes);
              
              updateData.is_late = checkInTime > lateThresholdTime;
            } catch (error) {
              console.warn('Error calculating late status:', error);
              updateData.is_late = false;
            }
          }
        }

        const { error: updateError } = await supabase
          .from('unified_attendance')
          .update(updateData)
          .eq('id', existingRecord.id);

        if (updateError) {
          errors.push(`Update error for ${record.Empcode}: ${updateError.message}`);
        } else {
          processed++;
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('unified_attendance')
          .insert({
            user_id: userMapping.our_user_id,
            employee_code: record.Empcode,
            employee_name: record.Name,
            entry_date: record.DateString,
            check_in_at: checkInAt,
            check_out_at: checkOutAt,
            total_work_time_minutes: totalWorkTimeMinutes,
            status: status,
            is_late: isLate,
            device_info: 'TeamOffice API',
            device_id: 'teamoffice',
            source: 'teamoffice',
            modification_reason: 'API Sync'
          });

        if (insertError) {
          errors.push(`Insert error for ${record.Empcode}: ${insertError.message}`);
        } else {
          processed++;
        }
      }


    } catch (error) {
      errors.push(`Error processing ${record.Empcode}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors
  };
}

/**
 * Get attendance data for a specific user with real-time fetching (Client-side)
 */
export async function getUserAttendanceDataWithFetchClient(
  userId: string,
  options: FetchOptions = {}
): Promise<{
  attendanceLogs: any[];
  dayEntries: any[];
  summary: {
    totalDays: number;
    totalWorkMinutes: number;
    averageWorkMinutes: number;
  };
  lastFetchTime: string;
  fetchResult?: FetchResult;
}> {
  try {
    // First, fetch fresh data from API
    const fetchResult = await fetchAttendanceDataFromAPIClient(options);

    // Then get the user's data from database
    const userData = await getUserAttendanceDataClient(
      userId,
      options.startDate,
      options.endDate
    );

    return {
      ...userData,
      lastFetchTime: fetchResult.lastFetchTime,
      fetchResult
    };

  } catch (error) {
    console.error('Error getting user attendance data with fetch:', error);
    return {
      attendanceLogs: [],
      dayEntries: [],
      summary: { totalDays: 0, totalWorkMinutes: 0, averageWorkMinutes: 0 },
      lastFetchTime: new Date().toISOString(),
      fetchResult: {
        success: false,
        recordsProcessed: 0,
        recordsFound: 0,
        errors: [`Error: ${error}`],
        lastFetchTime: new Date().toISOString()
      }
    };
  }
}

/**
 * Get user attendance data (Client-side)
 */
async function getUserAttendanceDataClient(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  attendanceLogs: any[];
  dayEntries: any[];
  summary: {
    totalDays: number;
    totalWorkMinutes: number;
    averageWorkMinutes: number;
  };
}> {
  try {
    // Get unified attendance records
    let attendanceQuery = supabase
      .from('unified_attendance')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });

    if (startDate) {
      attendanceQuery = attendanceQuery.gte('entry_date', startDate);
    }
    if (endDate) {
      attendanceQuery = attendanceQuery.lte('entry_date', endDate);
    }

    const { data: attendanceRecords, error: attendanceError } = await attendanceQuery;

    if (attendanceError) {
      console.error('Error fetching attendance records:', attendanceError);
    }

    // Calculate summary
    const totalDays = attendanceRecords?.length || 0;
    const totalWorkMinutes = attendanceRecords?.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0) || 0;
    const averageWorkMinutes = totalDays > 0 ? Math.round(totalWorkMinutes / totalDays) : 0;

    return {
      attendanceLogs: attendanceRecords || [],
      dayEntries: attendanceRecords || [],
      summary: {
        totalDays,
        totalWorkMinutes,
        averageWorkMinutes
      }
    };

  } catch (error) {
    console.error('Error getting user attendance data:', error);
    return {
      attendanceLogs: [],
      dayEntries: [],
      summary: { totalDays: 0, totalWorkMinutes: 0, averageWorkMinutes: 0 }
    };
  }
}

/**
 * Get all attendance data for admin view (Client-side)
 */
export async function getAllAttendanceDataWithFetchClient(
  options: FetchOptions = {}
): Promise<{
  attendanceLogs: any[];
  dayEntries: any[];
  summary: {
    totalEmployees: number;
    totalDays: number;
    totalWorkMinutes: number;
  };
  lastFetchTime: string;
  fetchResult?: FetchResult;
}> {
  try {
    // First, fetch fresh data from API
    const fetchResult = await fetchAttendanceDataFromAPIClient(options);

    // Then get all data from database
    const allData = await getAllAttendanceDataClient(
      options.startDate,
      options.endDate
    );

    return {
      ...allData,
      lastFetchTime: fetchResult.lastFetchTime,
      fetchResult
    };

  } catch (error) {
    console.error('Error getting all attendance data with fetch:', error);
    return {
      attendanceLogs: [],
      dayEntries: [],
      summary: { totalEmployees: 0, totalDays: 0, totalWorkMinutes: 0 },
      lastFetchTime: new Date().toISOString(),
      fetchResult: {
        success: false,
        recordsProcessed: 0,
        recordsFound: 0,
        errors: [`Error: ${error}`],
        lastFetchTime: new Date().toISOString()
      }
    };
  }
}

/**
 * Get all attendance data (Client-side)
 */
async function getAllAttendanceDataClient(
  startDate?: string,
  endDate?: string
): Promise<{
  attendanceLogs: any[];
  dayEntries: any[];
  summary: {
    totalEmployees: number;
    totalDays: number;
    totalWorkMinutes: number;
  };
}> {
  try {
    // Get unified attendance records
    let attendanceQuery = supabase
      .from('unified_attendance')
      .select('*')
      .order('entry_date', { ascending: false });

    if (startDate) {
      attendanceQuery = attendanceQuery.gte('entry_date', startDate);
    }
    if (endDate) {
      attendanceQuery = attendanceQuery.lte('entry_date', endDate);
    }

    const { data: attendanceRecords, error: attendanceError } = await attendanceQuery;

    if (attendanceError) {
      console.error('Error fetching attendance records:', attendanceError);
    }

    // Calculate summary
    const uniqueEmployees = new Set(attendanceRecords?.map(entry => entry.user_id) || []).size;
    const totalDays = attendanceRecords?.length || 0;
    const totalWorkMinutes = attendanceRecords?.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0) || 0;

    return {
      attendanceLogs: attendanceRecords || [],
      dayEntries: attendanceRecords || [],
      summary: {
        totalEmployees: uniqueEmployees,
        totalDays,
        totalWorkMinutes
      }
    };

  } catch (error) {
    console.error('Error getting all attendance data:', error);
    return {
      attendanceLogs: [],
      dayEntries: [],
      summary: { totalEmployees: 0, totalDays: 0, totalWorkMinutes: 0 }
    };
  }
}

/**
 * Get available date range from TeamOffice API (Client-side)
 */
export async function getAvailableDateRangeClient(): Promise<{
  earliestDate: string;
  latestDate: string;
  totalRecords: number;
}> {
  try {
    // Get data for the last 30 days to find available range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const apiStartDate = `${formatDateForAPI(startDate.toISOString().split('T')[0])}_00:00`;
    const apiEndDate = `${formatDateForAPI(endDate.toISOString().split('T')[0])}_23:59`;

    const punchData = await getRawRangeMCID(apiStartDate, apiEndDate, 'ALL');

    if (!punchData || !punchData.PunchData || !Array.isArray(punchData.PunchData)) {
      return {
        earliestDate: new Date().toISOString().split('T')[0],
        latestDate: new Date().toISOString().split('T')[0],
        totalRecords: 0
      };
    }

    // Find earliest and latest dates
    const dates = punchData.PunchData
      .map((record: any) => {
        const punchDate = record.PunchDate.split(' ')[0];
        return formatDateFromAPI(punchDate);
      })
      .sort();

    return {
      earliestDate: dates[0] || new Date().toISOString().split('T')[0],
      latestDate: dates[dates.length - 1] || new Date().toISOString().split('T')[0],
      totalRecords: punchData.PunchData.length
    };

  } catch (error) {
    console.error('Error getting available date range:', error);
    const today = new Date().toISOString().split('T')[0];
    return {
      earliestDate: today,
      latestDate: today,
      totalRecords: 0
    };
  }
}

// Auto-refresh functionality
let refreshInterval: NodeJS.Timeout | null = null;
let isRefreshing = false;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Start automatic data refresh
 */
export function startAutoRefresh(
  config: AutoRefreshConfig,
  onDataUpdate?: (result: FetchResult) => void,
  onError?: (error: string) => void
): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  if (!config.enabled) {
    console.log('🔄 Auto-refresh disabled');
    return;
  }

  console.log(`🔄 Starting auto-refresh every ${config.intervalMinutes} minutes`);

  const refreshData = async () => {
    if (isRefreshing) {
      console.log('⏳ Refresh already in progress, skipping...');
      return;
    }

    isRefreshing = true;
    let retryCount = 0;

    const attemptRefresh = async (): Promise<void> => {
      try {
        console.log(`🔄 Auto-refreshing data (attempt ${retryCount + 1})...`);
        
        const today = new Date().toISOString().split('T')[0];
        const result = await fetchAttendanceDataFromAPIClient({
          startDate: today,
          endDate: today,
          forceRefresh: true
        });

        if (result.success) {
          console.log(`✅ Auto-refresh successful: ${result.recordsProcessed} records processed`);
          consecutiveFailures = 0; // Reset failure count on success
          onDataUpdate?.(result);
        } else {
          throw new Error(`Auto-refresh failed: ${result.errors.join(', ')}`);
        }

      } catch (error) {
        retryCount++;
        console.error(`❌ Auto-refresh attempt ${retryCount} failed:`, error);

        // Provide more specific error messages
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            errorMessage = 'API request timed out - the server is taking too long to respond';
          } else if (error.message.includes('Network Error')) {
            errorMessage = 'Network connection error - please check your internet connection';
          } else if (error.message.includes('API Error')) {
            errorMessage = `API Error: ${error.message}`;
          } else {
            errorMessage = error.message;
          }
        }

        if (retryCount < config.maxRetries) {
          console.log(`⏳ Retrying in ${config.retryDelayMs}ms...`);
          setTimeout(attemptRefresh, config.retryDelayMs);
        } else {
          consecutiveFailures++;
          console.error(`❌ Auto-refresh failed after all retries (consecutive failures: ${consecutiveFailures})`);
          
          // Disable auto-refresh if too many consecutive failures
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error('🛑 Too many consecutive failures, disabling auto-refresh');
            stopAutoRefresh();
            onError?.(`Auto-refresh disabled due to repeated failures. Please check your connection and try again.`);
          } else {
            onError?.(`Auto-refresh failed after ${config.maxRetries} attempts: ${errorMessage}`);
          }
        }
      } finally {
        isRefreshing = false;
      }
    };

    attemptRefresh();
  };

  // Initial refresh
  refreshData();

  // Set up interval
  refreshInterval = setInterval(refreshData, config.intervalMinutes * 60 * 1000);
}

/**
 * Stop automatic data refresh
 */
export function stopAutoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('🛑 Auto-refresh stopped');
  }
}

/**
 * Reset consecutive failure count (useful for re-enabling auto-refresh)
 */
export function resetAutoRefreshFailures(): void {
  consecutiveFailures = 0;
  console.log('🔄 Auto-refresh failure count reset');
}

/**
 * Get current auto-refresh status
 */
export function getAutoRefreshStatus(): {
  isActive: boolean;
  isRefreshing: boolean;
} {
  return {
    isActive: refreshInterval !== null,
    isRefreshing
  };
}

/**
 * Default auto-refresh configuration
 */
export const DEFAULT_AUTO_REFRESH_CONFIG: AutoRefreshConfig = {
  enabled: false, // Disabled by default
  intervalMinutes: 10, // If enabled, fetch every 10 minutes
  maxRetries: 3,
  retryDelayMs: 5000 // 5 seconds between retries
};
