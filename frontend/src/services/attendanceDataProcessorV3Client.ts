import { supabase } from '../integrations/supabase/client';
import type { TeamOfficeAttendanceRecord } from './teamOfficeClient';

export interface UnifiedAttendanceRecord {
  id: string;
  user_id: string;
  employee_code: string | null;
  employee_name: string | null;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number;
  status: string;
  is_late: boolean;
  device_info: string;
  device_id: string | null;
  source: string;
  modification_reason: string | null;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessResult {
  success: boolean;
  processed: number;
  errors: string[];
  errorDetails: string[];
}

export async function processAndInsertAttendanceRecordsV3Client(
  records: TeamOfficeAttendanceRecord[]
): Promise<ProcessResult> {
  const errors: string[] = [];
  const errorDetails: string[] = [];
  let processed = 0;

  console.log(`Processing ${records.length} records with unified attendance processor...`);

  for (const record of records) {
    try {
      console.log(`Processing record for ${record.Empcode}:`, {
        INTime: record.INTime,
        OUTTime: record.OUTTime,
        Status: record.Status,
        WorkTime: record.WorkTime
      });

      // Check if employee mapping exists before processing
      const { data: mapping } = await supabase
        .from('employee_mappings')
        .select('our_user_id, our_name')
        .eq('teamoffice_emp_code', record.Empcode)
        .single();

      if (!mapping) {
        console.log(`Skipping ${record.Empcode} (${record.Name}) - no employee mapping found`);
        continue; // Skip this record
      }

      console.log(`Processing ${record.Empcode} (${record.Name}) -> ${mapping.our_name} (${mapping.our_user_id})`);

      // Use the unified processing function
      const { data: result, error: processError } = await supabase
        .rpc('process_teamoffice_unified_attendance', {
          p_empcode: record.Empcode,
          p_name: record.Name,
          p_datestring: record.DateString,
          p_intime: record.INTime,
          p_outtime: record.OUTTime,
          p_worktime: record.WorkTime,
          p_status: record.Status,
          p_remark: record.Remark,
          p_device_id: record.DeviceID,
          p_raw_payload: record
        });

      if (processError) {
        const errorMsg = `Database processing error for ${record.Empcode}: ${processError.message}`;
        errors.push(errorMsg);
        errorDetails.push(errorMsg);
        console.error('Process error:', processError);
      } else if (result && result.length > 0) {
        const processResult = result[0];
        if (processResult.success) {
          processed++;
          console.log(`Successfully processed ${record.Empcode}: ${processResult.message}`);
        } else {
          const errorMsg = `Processing failed for ${record.Empcode}: ${processResult.message}`;
          errors.push(errorMsg);
          errorDetails.push(errorMsg);
        }
      } else {
        const errorMsg = `No result returned for ${record.Empcode}`;
        errors.push(errorMsg);
        errorDetails.push(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = `Unexpected error processing ${record.Empcode}: ${error.message}`;
      errors.push(errorMsg);
      errorDetails.push(errorMsg);
      console.error('Unexpected error:', error);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
    errorDetails
  };
}

export async function getUserAttendanceDataV3Client(userId: string, startDate?: string, endDate?: string): Promise<{
  attendanceLogs: any[];
  dayEntries: UnifiedAttendanceRecord[];
  summary: {
    totalDays: number;
    totalWorkMinutes: number;
    averageWorkMinutes: number;
  };
  lastFetchTime: string;
}> {
  let query = supabase
    .from('unified_attendance')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });

  if (startDate) {
    query = query.gte('entry_date', startDate);
  }
  if (endDate) {
    query = query.lte('entry_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching user attendance data:', error);
    return {
      attendanceLogs: [],
      dayEntries: [],
      summary: { totalDays: 0, totalWorkMinutes: 0, averageWorkMinutes: 0 },
      lastFetchTime: new Date().toISOString()
    };
  }

  const dayEntries = data || [];
  
  // Calculate summary
  const totalDays = dayEntries.length;
  const totalWorkMinutes = dayEntries.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0);
  const averageWorkMinutes = totalDays > 0 ? Math.round(totalWorkMinutes / totalDays) : 0;

  return {
    attendanceLogs: [], // No longer using raw attendance_logs
    dayEntries,
    summary: {
      totalDays,
      totalWorkMinutes,
      averageWorkMinutes
    },
    lastFetchTime: new Date().toISOString()
  };
}

export async function getAllAttendanceDataV3Client(startDate?: string, endDate?: string): Promise<{
  attendanceLogs: any[];
  dayEntries: UnifiedAttendanceRecord[];
  summary: {
    totalEmployees: number;
    totalDays: number;
    totalWorkMinutes: number;
  };
  lastFetchTime: string;
}> {
  let query = supabase
    .from('unified_attendance')
    .select('*')
    .order('entry_date', { ascending: false });

  if (startDate) {
    query = query.gte('entry_date', startDate);
  }
  if (endDate) {
    query = query.lte('entry_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all attendance data:', error);
    return {
      attendanceLogs: [],
      dayEntries: [],
      summary: { totalEmployees: 0, totalDays: 0, totalWorkMinutes: 0 },
      lastFetchTime: new Date().toISOString()
    };
  }

  const dayEntries = data || [];
  
  // Calculate summary
  const uniqueEmployees = new Set(dayEntries.map(entry => entry.user_id)).size;
  const totalDays = dayEntries.length;
  const totalWorkMinutes = dayEntries.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0);

  return {
    attendanceLogs: [], // No longer using raw attendance_logs
    dayEntries,
    summary: {
      totalEmployees: uniqueEmployees,
      totalDays,
      totalWorkMinutes
    },
    lastFetchTime: new Date().toISOString()
  };
}