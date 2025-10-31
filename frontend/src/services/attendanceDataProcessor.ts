import { supabaseService } from '@/integrations/supabase/service';
import { getEmployeeMapping } from './teamOfficeEmployees';

export interface TeamOfficeAttendanceRecord {
  Empcode: string;
  INTime: string;
  OUTTime: string;
  WorkTime: string;
  OverTime: string;
  BreakTime: string;
  Status: string;
  DateString: string;
  Remark: string;
  Erl_Out: string;
  Late_In: string;
  Name: string;
}

export interface ProcessedAttendanceData {
  checkInLog?: {
    employee_id: string;
    employee_name: string;
    log_time: string;
    log_type: 'checkin';
    device_id?: string;
    source: 'teamoffice';
    raw_payload: TeamOfficeAttendanceRecord;
  };
  checkOutLog?: {
    employee_id: string;
    employee_name: string;
    log_time: string;
    log_type: 'checkout';
    device_id?: string;
    source: 'teamoffice';
    raw_payload: TeamOfficeAttendanceRecord;
  };
  dayEntry?: {
    user_id: string;
    entry_date: string;
    check_in_at: string;
    check_out_at: string;
    total_work_time_minutes: number;
    status: 'completed' | 'in_progress';
    device_info?: string;
    modification_reason?: string;
  };
}

/**
 * Parse time string (HH:MM) and combine with date
 */
function parseDateTime(dateString: string, timeString: string): Date | null {
  try {
    // Parse date (DD/MM/YYYY format)
    const [day, month, year] = dateString.split('/');
    if (!day || !month || !year) return null;
    
    // Parse time (HH:MM format)
    const [hours, minutes] = timeString.split(':');
    if (!hours || !minutes) return null;
    
    // Create date object
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Error parsing date/time:', error);
    return null;
  }
}

/**
 * Convert time string (HH:MM) to minutes
 */
function timeStringToMinutes(timeString: string): number {
  try {
    const [hours, minutes] = timeString.split(':');
    return (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
  } catch (error) {
    console.error('Error converting time to minutes:', error);
    return 0;
  }
}

/**
 * Process a single TeamOffice attendance record
 */
export async function processAttendanceRecord(
  record: TeamOfficeAttendanceRecord
): Promise<ProcessedAttendanceData | null> {
  try {
    // Get employee mapping
    let ourUserId = record.Empcode;
    let ourUserName = record.Name;
    
    try {
      const mapping = await getEmployeeMapping(record.Empcode);
      if (mapping) {
        ourUserId = mapping.our_user_id;
        ourUserName = mapping.our_name || mapping.teamoffice_name;
        console.log(`Mapped TeamOffice employee ${record.Empcode} to our user ${ourUserId}`);
      } else {
        console.warn(`No mapping found for TeamOffice employee ${record.Empcode}, using original data`);
      }
    } catch (error) {
      console.error(`Error getting mapping for employee ${record.Empcode}:`, error);
      // Continue with original data if mapping fails
    }

    // Parse check-in and check-out times
    const checkInTime = parseDateTime(record.DateString, record.INTime);
    const checkOutTime = parseDateTime(record.DateString, record.OUTTime);
    
    if (!checkInTime) {
      console.error(`Invalid check-in time for ${record.Empcode} on ${record.DateString}`);
      return null;
    }

    // Only consider check-out time valid if it's different from check-in time
    const validCheckOutTime = checkOutTime && checkOutTime.getTime() !== checkInTime.getTime() ? checkOutTime : null;

    const processedData: ProcessedAttendanceData = {};

    // Create check-in log
    if (checkInTime) {
      processedData.checkInLog = {
        employee_id: ourUserId,
        employee_name: ourUserName,
        log_time: checkInTime.toISOString(),
        log_type: 'checkin',
        device_id: 'teamoffice',
        source: 'teamoffice',
        raw_payload: record
      };
    }

    // Create check-out log only if check-out time is valid and different from check-in
    if (validCheckOutTime) {
      processedData.checkOutLog = {
        employee_id: ourUserId,
        employee_name: ourUserName,
        log_time: validCheckOutTime.toISOString(),
        log_type: 'checkout',
        device_id: 'teamoffice',
        source: 'teamoffice',
        raw_payload: record
      };
    }

    // Create day entry summary
    if (checkInTime) {
      const workTimeMinutes = timeStringToMinutes(record.WorkTime);
      // Only mark as completed if we have a valid check-out time
      const status = (record.Status === 'P' && validCheckOutTime) ? 'completed' : 'in_progress';
      
      processedData.dayEntry = {
        user_id: ourUserId,
        entry_date: checkInTime.toISOString().split('T')[0], // YYYY-MM-DD format
        check_in_at: checkInTime.toISOString(),
        check_out_at: validCheckOutTime?.toISOString() || null,
        total_work_time_minutes: workTimeMinutes,
        status: status as 'completed' | 'in_progress',
        device_info: 'TeamOffice API',
        modification_reason: record.Remark ? `TeamOffice: ${record.Remark}` : undefined
      };
    }

    return processedData;

  } catch (error) {
    console.error('Error processing attendance record:', error);
    return null;
  }
}

/**
 * Insert processed attendance data into database
 */
export async function insertAttendanceData(
  processedData: ProcessedAttendanceData
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Insert check-in log
    if (processedData.checkInLog) {
      const { error: checkInError } = await supabaseService
        .from('attendance_logs')
        .insert(processedData.checkInLog);

      if (checkInError && !checkInError.message.includes('duplicate key')) {
        errors.push(`Check-in log error: ${checkInError.message}`);
      }
    }

    // Insert check-out log
    if (processedData.checkOutLog) {
      const { error: checkOutError } = await supabaseService
        .from('attendance_logs')
        .insert(processedData.checkOutLog);

      if (checkOutError && !checkOutError.message.includes('duplicate key')) {
        errors.push(`Check-out log error: ${checkOutError.message}`);
      }
    }

    // Insert or update day entry
    if (processedData.dayEntry) {
      const { error: dayEntryError } = await supabaseService
        .from('day_entries')
        .upsert(processedData.dayEntry, {
          onConflict: 'user_id,entry_date'
        });

      if (dayEntryError) {
        errors.push(`Day entry error: ${dayEntryError.message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors
    };

  } catch (error) {
    console.error('Error inserting attendance data:', error);
    return {
      success: false,
      errors: [`General error: ${error}`]
    };
  }
}

/**
 * Process and insert multiple attendance records
 */
export async function processAndInsertAttendanceRecords(
  records: TeamOfficeAttendanceRecord[]
): Promise<{
  success: boolean;
  processed: number;
  errors: number;
  errorDetails: string[];
}> {
  let processed = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const record of records) {
    try {
      const processedData = await processAttendanceRecord(record);
      
      if (processedData) {
        const result = await insertAttendanceData(processedData);
        
        if (result.success) {
          processed++;
        } else {
          errors++;
          errorDetails.push(...result.errors);
        }
      } else {
        errors++;
        errorDetails.push(`Failed to process record for ${record.Empcode} on ${record.DateString}`);
      }
    } catch (error) {
      errors++;
      errorDetails.push(`Error processing ${record.Empcode}: ${error}`);
    }
  }

  return {
    success: errors === 0,
    processed,
    errors,
    errorDetails
  };
}

/**
 * Example usage function
 */
export async function processExampleRecord() {
  const exampleRecord: TeamOfficeAttendanceRecord = {
    "Empcode": "0006",
    "INTime": "10:20",
    "OUTTime": "17:12",
    "WorkTime": "06:52",
    "OverTime": "00:00",
    "BreakTime": "00:00",
    "Status": "P",
    "DateString": "08/10/2025",
    "Remark": "LT-EO",
    "Erl_Out": "00:48",
    "Late_In": "00:20",
    "Name": "Sakshi"
  };

  console.log('Processing example record...');
  const result = await processAndInsertAttendanceRecords([exampleRecord]);
  console.log('Processing result:', result);
  
  return result;
}

