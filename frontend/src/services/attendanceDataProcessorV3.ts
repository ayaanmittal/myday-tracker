import { supabaseService } from '../integrations/supabase/service';

export interface TeamOfficeAttendanceRecord {
  Empcode: string;
  Name: string;
  DateString: string;
  INTime: string;
  OUTTime: string;
  WorkTime: string;
  Status: string;
  Remark: string;
}

export async function processAndInsertAttendanceRecordsV3(
  records: TeamOfficeAttendanceRecord[]
): Promise<{
  success: boolean;
  processed: number;
  errors: string[];
  errorDetails: string[];
}> {
  const errors: string[] = [];
  const errorDetails: string[] = [];
  let processed = 0;

  try {
    console.log(`Processing ${records.length} TeamOffice attendance records using safe database function`);

    // Process each record using the safe database function
    for (const record of records) {
      try {
        console.log(`Processing record for ${record.Empcode}:`, {
          INTime: record.INTime,
          OUTTime: record.OUTTime,
          Status: record.Status,
          WorkTime: record.WorkTime
        });

        // Check if employee mapping exists before processing
        const { data: mapping } = await supabaseService
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
        const { data: result, error: processError } = await supabaseService
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
            console.error('Processing failed:', processResult.message);
          }
        } else {
          const errorMsg = `No result returned for ${record.Empcode}`;
          errors.push(errorMsg);
          errorDetails.push(errorMsg);
        }

      } catch (error) {
        const errorMsg = `Error processing record for ${record.Empcode}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        errorDetails.push(errorMsg);
        console.error('Record processing error:', error);
      }
    }

    console.log(`Processing complete: ${processed} successful, ${errors.length} errors`);

  } catch (error) {
    console.error('Error in processAndInsertAttendanceRecordsV3:', error);
    errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    errorDetails.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
    errorDetails
  };
}

/**
 * Get user attendance data using the new safe function
 */
export async function getUserAttendanceDataV3(
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
    // Get day entries using the new function
    const { data: dayEntries, error: entryError } = await supabaseService
      .rpc('get_attendance_with_pairs', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (entryError) {
      console.error('Error fetching day entries:', entryError);
    }

    // Calculate summary
    const totalDays = dayEntries?.length || 0;
    const totalWorkMinutes = dayEntries?.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0) || 0;
    const averageWorkMinutes = totalDays > 0 ? Math.round(totalWorkMinutes / totalDays) : 0;

    return {
      attendanceLogs: [], // We don't need raw logs anymore
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
      summary: {
        totalDays: 0,
        totalWorkMinutes: 0,
        averageWorkMinutes: 0
      }
    };
  }
}

/**
 * Get all attendance data for admin view using the new safe function
 */
export async function getAllAttendanceDataV3(
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
    // Get day entries using the new function
    const { data: dayEntries, error: entryError } = await supabaseService
      .rpc('get_attendance_with_pairs', {
        p_user_id: null, // Get all users
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (entryError) {
      console.error('Error fetching day entries:', entryError);
    }

    // Calculate summary
    const uniqueEmployees = new Set(dayEntries?.map(entry => entry.user_id) || []).size;
    const totalDays = dayEntries?.length || 0;
    const totalWorkMinutes = dayEntries?.reduce((sum, entry) => sum + (entry.total_work_time_minutes || 0), 0) || 0;

    return {
      attendanceLogs: [], // We don't need raw logs anymore
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
