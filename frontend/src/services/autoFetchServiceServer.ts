import { supabaseService } from '@/integrations/supabase/service';
import { getRawRangeMCID, getInOutPunchData } from './teamOffice';
import { processAndInsertAttendanceRecordsV3 } from './attendanceDataProcessorV3';

export interface FetchOptions {
  startDate?: string; // YYYY-MM-DD format
  endDate?: string;   // YYYY-MM-DD format
  forceRefresh?: boolean;
}

export interface FetchResult {
  success: boolean;
  recordsFound: number;
  recordsProcessed: number;
  errors: string[];
}

function formatDateForAPI(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateFromAPI(dateString: string): string {
  const [day, month, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Fetch attendance data from TeamOffice API for a specific date range (Server-side)
 */
export async function fetchAttendanceDataFromAPIServer(
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

    // Convert to TeamOffice API format (IN/OUT API uses DD/MM/YYYY format without time)
    const apiStartDate = formatDateForAPI(startDate);
    const apiEndDate = formatDateForAPI(endDate);

    console.log(`🔗 API Request (IN/OUT): ${apiStartDate} to ${apiEndDate}`);

    // Fetch data from TeamOffice IN/OUT API (provides INTime and OUTTime directly)
    const apiResponse = await getInOutPunchData(apiStartDate, apiEndDate, 'ALL');

    if (!apiResponse || !apiResponse.InOutPunchData || !Array.isArray(apiResponse.InOutPunchData)) {
      throw new Error('No data received from TeamOffice IN/OUT API');
    }

    const punchData = apiResponse.InOutPunchData;
    recordsFound = punchData.length;
    console.log(`📝 Found ${recordsFound} IN/OUT records`);

    // Convert IN/OUT API data to TeamOffice format
    // The IN/OUT API already provides INTime and OUTTime, so we can use them directly
    const attendanceRecords = punchData.map((record: any) => ({
      Empcode: record.Empcode || '',
      Name: record.Name || '',
      DateString: record.DateString || '',
      INTime: record.INTime || '',
      OUTTime: record.OUTTime || '',
      WorkTime: record.WorkTime || '00:00',
      Status: record.Status || 'P',
      Remark: record.Remark || 'TeamOffice API',
      DeviceID: 'teamoffice'
    }));

    // Process and insert attendance records
    console.log(`🔄 Processing ${attendanceRecords.length} attendance records...`);
    const result = await processAndInsertAttendanceRecordsV3(attendanceRecords);

    recordsProcessed = result.processed;
    errors.push(...result.errorDetails);

    console.log(`✅ Processed ${recordsProcessed} records successfully`);

    return {
      success: errors.length === 0,
      recordsFound,
      recordsProcessed,
      errors
    };

  } catch (error: any) {
    console.error('❌ Error fetching attendance data:', error);
    errors.push(`API Error: ${error.message}`);
    
    return {
      success: false,
      recordsFound,
      recordsProcessed,
      errors
    };
  }
}
