import { supabase } from '@/integrations/supabase/client';

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
 * Get user attendance data using foreign key relationship (Client-side)
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
    let attendanceQuery = supabase
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
    let dayEntryQuery = supabase
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
 * Get all attendance data for admin view (Client-side)
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
    let attendanceQuery = supabase
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
    let dayEntryQuery = supabase
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

/**
 * Process and insert attendance records using foreign key relationship (Client-side)
 */
export async function processAndInsertAttendanceRecordsClient(
  records: TeamOfficeAttendanceRecord[]
): Promise<{
  success: boolean;
  processed: number;
  errors: string[];
}> {
  let processed = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      // Get user mapping using foreign key relationship
      const { data: userProfile, error: profileError } = await supabase
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
        errors.push(`No user mapping found for ${record.Empcode}`);
        continue;
      }

      // Create attendance log entry
      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          employee_id: userProfile.id,
          employee_name: userProfile.name,
          log_time: new Date(`${record.DateString} ${record.INTime}`).toISOString(),
          log_type: 'checkin',
          device_id: 'teamoffice',
          source: 'teamoffice',
          raw_payload: record
        });

      if (logError && !logError.message.includes('duplicate key')) {
        errors.push(`Log error for ${record.Empcode}: ${logError.message}`);
      } else {
        processed++;
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








