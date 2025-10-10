import { supabaseService } from '@/integrations/supabase/service';
import { getRawRangeMCID } from './teamOffice';
import { processAndInsertAttendanceRecordsV2 } from './attendanceDataProcessorV2';

export interface FetchOptions {
  startDate?: string; // YYYY-MM-DD format
  endDate?: string;   // YYYY-MM-DD format
  forceRefresh?: boolean;
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
 * Convert date from DD/MM/YYYY to YYYY-MM-DD format
 */
function formatDateFromAPI(dateString: string): string {
  const [day, month, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Fetch attendance data from TeamOffice API for a specific date range
 */
export async function fetchAttendanceDataFromAPI(
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

    // Format dates for TeamOffice API
    const apiStartDate = `${formatDateForAPI(startDate)}_00:00`;
    const apiEndDate = `${formatDateForAPI(endDate)}_23:59`;

    console.log(`🔗 API Request: ${apiStartDate} to ${apiEndDate}`);

    // Fetch data from TeamOffice API
    const punchData = await getRawRangeMCID(apiStartDate, apiEndDate, 'ALL');

    if (!punchData || !punchData.PunchData || !Array.isArray(punchData.PunchData)) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFound: 0,
        errors: ['No punch data found from TeamOffice API'],
        lastFetchTime: new Date().toISOString()
      };
    }

    recordsFound = punchData.PunchData.length;
    console.log(`📥 Found ${recordsFound} punch records from TeamOffice`);

    // Convert punch data to attendance records format
    const attendanceRecords = punchData.PunchData.map((record: any) => {
      // Parse the punch date to get the actual date
      const punchDate = record.PunchDate.split(' ')[0]; // Get date part
      const formattedDate = formatDateFromAPI(punchDate);
      
      // Extract time from punch date
      const punchTime = record.PunchDate.split(' ')[1]; // Get time part
      const [hours, minutes, seconds] = punchTime.split(':'); // Split time components
      const timeOnly = `${hours}:${minutes}`; // HH:MM format

      return {
        Empcode: record.Empcode,
        Name: record.Name,
        INTime: timeOnly, // Use actual punch time
        OUTTime: timeOnly, // Use actual punch time for now
        WorkTime: "08:00", // Placeholder
        OverTime: "00:00",
        BreakTime: "01:00",
        Status: "P",
        DateString: formattedDate, // Use converted date
        Remark: "",
        Erl_Out: "00:00",
        Late_In: "00:00"
      };
    });

    // Process and insert attendance records
    console.log(`🔄 Processing ${attendanceRecords.length} attendance records...`);
    const result = await processAndInsertAttendanceRecordsV2(attendanceRecords);

    recordsProcessed = result.processed;
    errors.push(...result.errorDetails);

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
 * Get attendance data for a specific user with real-time fetching
 */
export async function getUserAttendanceDataWithFetch(
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
    const fetchResult = await fetchAttendanceDataFromAPI(options);

    // Then get the user's data from database
    const { getUserAttendanceData } = await import('./attendanceDataProcessorV2');
    const userData = await getUserAttendanceData(
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
 * Get all attendance data for admin with real-time fetching
 */
export async function getAllAttendanceDataWithFetch(
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
    const fetchResult = await fetchAttendanceDataFromAPI(options);

    // Then get all data from database
    const { getAllAttendanceData } = await import('./attendanceDataProcessorV2');
    const allData = await getAllAttendanceData(
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
 * Get available date range from TeamOffice API
 */
export async function getAvailableDateRange(): Promise<{
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

/**
 * Check if data needs to be refreshed
 */
export async function shouldRefreshData(
  userId?: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<boolean> {
  try {
    // Check last fetch time from database
    const { data: lastFetch, error } = await supabaseService
      .from('attendance_sync_state')
      .select('last_sync_time')
      .order('last_sync_time', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastFetch) {
      return true; // No previous fetch, should refresh
    }

    const lastFetchTime = new Date(lastFetch.last_sync_time);
    const now = new Date();
    const timeDiff = now.getTime() - lastFetchTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Refresh if more than 1 hour has passed
    return hoursDiff > 1;

  } catch (error) {
    console.error('Error checking refresh status:', error);
    return true; // Default to refresh on error
  }
}

/**
 * Update last sync time
 */
export async function updateLastSyncTime(): Promise<void> {
  try {
    await supabaseService
      .from('attendance_sync_state')
      .upsert({
        id: 'main_sync',
        last_sync_time: new Date().toISOString(),
        records_synced: 0
      });
  } catch (error) {
    console.error('Error updating last sync time:', error);
  }
}
