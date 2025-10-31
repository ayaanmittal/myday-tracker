import { supabaseService } from '@/integrations/supabase/service';
import { LateDetectionService } from './lateDetectionService';

export interface TeamOfficeAttendanceRecord {
  Empcode: string;
  Name: string;
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
}

export interface ProcessedAttendanceRecord {
  employee_id: string;
  employee_name: string;
  log_time: string;
  log_type: 'checkin' | 'checkout' | 'unknown';
  device_id: string;
  source: string;
  raw_payload: any;
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
 * Process and insert attendance records using foreign key relationship (Server-side)
 */
export async function processAndInsertAttendanceRecordsV2(
  records: TeamOfficeAttendanceRecord[]
): Promise<{
  success: boolean;
  processed: number;
  errors: string[];
  errorDetails: string[];
}> {
  let processed = 0;
  const errors: string[] = [];
  const errorDetails: string[] = [];

  for (const record of records) {
    try {
      // Get user mapping using foreign key relationship
      const { data: userProfile, error: profileError } = await supabaseService
        .from('profiles')
        .select(`
          id,
          name,
          teamoffice_employees!inner (
            emp_code,
            name
          )
        `)
        .eq('teamoffice_employees.emp_code', record.Empcode)
        .eq('is_active', true)
        .single();

      if (profileError || !userProfile) {
        const errorMsg = `No user mapping found for ${record.Empcode}`;
        errors.push(errorMsg);
        errorDetails.push(errorMsg);
        continue;
      }

      // Parse check-in and check-out times
      const checkInTime = parseDateTime(record.DateString, record.INTime);
      const checkOutTime = parseDateTime(record.DateString, record.OUTTime);
      
      // Debug logging
      console.log(`Processing ${record.Empcode}:`, {
        INTime: record.INTime,
        OUTTime: record.OUTTime,
        checkInTime: checkInTime?.toISOString(),
        checkOutTime: checkOutTime?.toISOString(),
        Status: record.Status,
        WorkTime: record.WorkTime
      });
      
      if (!checkInTime) {
        const errorMsg = `Invalid check-in time for ${record.Empcode} on ${record.DateString}`;
        errors.push(errorMsg);
        errorDetails.push(errorMsg);
        continue;
      }

      // Only consider check-out time valid if it exists, is different from check-in time, and is after check-in
      const validCheckOutTime = checkOutTime && 
        checkOutTime.getTime() !== checkInTime.getTime() && 
        checkOutTime > checkInTime ? checkOutTime : null;
        
      console.log(`Valid check-out time for ${record.Empcode}:`, validCheckOutTime?.toISOString() || 'None');

      // Check if check-in log already exists to prevent duplicates
      const { data: existingCheckIn } = await supabaseService
        .from('attendance_logs')
        .select('id')
        .eq('employee_id', userProfile.id)
        .eq('log_time', checkInTime.toISOString())
        .eq('log_type', 'checkin')
        .single();

      // Insert check-in log only if it doesn't exist
      if (!existingCheckIn) {
        const { error: checkInError } = await supabaseService
          .from('attendance_logs')
          .insert({
            employee_id: userProfile.id,
            employee_name: userProfile.name,
            log_time: checkInTime.toISOString(),
            log_type: 'checkin',
            device_id: 'teamoffice',
            source: 'teamoffice',
            raw_payload: record
          });

        if (checkInError) {
          const errorMsg = `Check-in log error for ${record.Empcode}: ${checkInError.message}`;
          errors.push(errorMsg);
          errorDetails.push(errorMsg);
        }
      }

      // Insert check-out log only if check-out time is valid and different from check-in
      if (validCheckOutTime) {
        // Check if check-out log already exists to prevent duplicates
        const { data: existingCheckOut } = await supabaseService
          .from('attendance_logs')
          .select('id')
          .eq('employee_id', userProfile.id)
          .eq('log_time', validCheckOutTime.toISOString())
          .eq('log_type', 'checkout')
          .single();

        if (!existingCheckOut) {
          const { error: checkOutError } = await supabaseService
            .from('attendance_logs')
            .insert({
              employee_id: userProfile.id,
              employee_name: userProfile.name,
              log_time: validCheckOutTime.toISOString(),
              log_type: 'checkout',
              device_id: 'teamoffice',
              source: 'teamoffice',
              raw_payload: record
            });

          if (checkOutError) {
            const errorMsg = `Check-out log error for ${record.Empcode}: ${checkOutError.message}`;
            errors.push(errorMsg);
            errorDetails.push(errorMsg);
          }
        }
      }

      // Insert or update day entry
      const workTimeMinutes = timeStringToMinutes(record.WorkTime);
      const status = (record.Status === 'P' && validCheckOutTime) ? 'completed' : 'in_progress';
      
      // Simple late detection logic (will be replaced with database function after migration)
      const workdayStartTime = '10:30'; // Default from settings
      const lateThresholdMinutes = 15; // Default from settings
      
      // Parse workday start time
      const [hours, minutes] = workdayStartTime.split(':').map(Number);
      const workdayStart = new Date(checkInTime);
      workdayStart.setHours(hours, minutes, 0, 0);
      
      // Calculate late threshold time
      const lateThresholdTime = new Date(workdayStart.getTime() + (lateThresholdMinutes * 60 * 1000));
      
      // Check if check-in is late
      const isLate = checkInTime > lateThresholdTime;
      
      const { error: dayEntryError } = await supabaseService
        .from('day_entries')
        .upsert({
          user_id: userProfile.id,
          entry_date: checkInTime.toISOString().split('T')[0], // YYYY-MM-DD format
          check_in_at: checkInTime.toISOString(),
          check_out_at: validCheckOutTime?.toISOString() || null,
          total_work_time_minutes: workTimeMinutes,
          status: status as 'completed' | 'in_progress',
          is_late: isLate,
          device_info: 'TeamOffice API',
          modification_reason: record.Remark ? `TeamOffice: ${record.Remark}` : undefined
        }, {
          onConflict: 'user_id,entry_date'
        });

      if (dayEntryError) {
        const errorMsg = `Day entry error for ${record.Empcode}: ${dayEntryError.message}`;
        errors.push(errorMsg);
        errorDetails.push(errorMsg);
      } else {
        processed++;
      }

    } catch (error) {
      const errorMsg = `Error processing ${record.Empcode}: ${error}`;
      errors.push(errorMsg);
      errorDetails.push(errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
    errorDetails
  };
}

/**
 * Get user attendance data using foreign key relationship (Server-side)
 */
export async function getUserAttendanceData(
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
    // Get attendance logs
    let attendanceQuery = supabaseService
      .from('attendance_logs')
      .select('*')
      .eq('employee_id', userId)
      .eq('source', 'teamoffice')
      .order('log_time', { ascending: false });

    if (startDate) {
      attendanceQuery = attendanceQuery.gte('log_time', startDate);
    }
    if (endDate) {
      attendanceQuery = attendanceQuery.lte('log_time', endDate);
    }

    const { data: attendanceLogs, error: logError } = await attendanceQuery;

    if (logError) {
      console.error('Error fetching attendance logs:', logError);
    }

    // Get day entries
    let dayEntryQuery = supabaseService
      .from('day_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });

    if (startDate) {
      dayEntryQuery = dayEntryQuery.gte('entry_date', startDate);
    }
    if (endDate) {
      dayEntryQuery = dayEntryQuery.lte('entry_date', endDate);
    }

    const { data: dayEntries, error: entryError } = await dayEntryQuery;

    if (entryError) {
      console.error('Error fetching day entries:', entryError);
    }

    // Calculate summary
    const totalDays = dayEntries?.length || 0;
    const totalWorkMinutes = dayEntries?.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0) || 0;
    const averageWorkMinutes = totalDays > 0 ? Math.round(totalWorkMinutes / totalDays) : 0;

    return {
      attendanceLogs: attendanceLogs || [],
      dayEntries: dayEntries || [],
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
 * Get all attendance data for admin view (Server-side)
 */
export async function getAllAttendanceData(
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
    // Get attendance logs
    let attendanceQuery = supabaseService
      .from('attendance_logs')
      .select('*')
      .eq('source', 'teamoffice')
      .order('log_time', { ascending: false });

    if (startDate) {
      attendanceQuery = attendanceQuery.gte('log_time', startDate);
    }
    if (endDate) {
      attendanceQuery = attendanceQuery.lte('log_time', endDate);
    }

    const { data: attendanceLogs, error: logError } = await attendanceQuery;

    if (logError) {
      console.error('Error fetching attendance logs:', logError);
    }

    // Get day entries
    let dayEntryQuery = supabaseService
      .from('day_entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (startDate) {
      dayEntryQuery = dayEntryQuery.gte('entry_date', startDate);
    }
    if (endDate) {
      dayEntryQuery = dayEntryQuery.lte('entry_date', endDate);
    }

    const { data: dayEntries, error: entryError } = await dayEntryQuery;

    if (entryError) {
      console.error('Error fetching day entries:', entryError);
    }

    // Calculate summary
    const uniqueEmployees = new Set(dayEntries?.map(entry => entry.user_id) || []).size;
    const totalDays = dayEntries?.length || 0;
    const totalWorkMinutes = dayEntries?.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0) || 0;

    return {
      attendanceLogs: attendanceLogs || [],
      dayEntries: dayEntries || [],
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
