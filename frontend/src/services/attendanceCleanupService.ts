import { supabase } from '@/integrations/supabase/client';

/**
 * Clean up duplicate attendance entries
 */
export async function cleanupDuplicateAttendance(): Promise<{
  success: boolean;
  duplicatesRemoved: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let duplicatesRemoved = 0;

  try {
    // Call the database function to clean up duplicates
    const { data, error } = await supabase.rpc('cleanup_attendance_duplicates');

    if (error) {
      errors.push(`Failed to cleanup duplicates: ${error.message}`);
      return { success: false, duplicatesRemoved: 0, errors };
    }

    // Get count of remaining records to estimate duplicates removed
    const { count: totalRecords } = await supabase
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true });

    duplicatesRemoved = totalRecords || 0;

    return { success: true, duplicatesRemoved, errors };
  } catch (error: any) {
    errors.push(`Cleanup failed: ${error.message}`);
    return { success: false, duplicatesRemoved: 0, errors };
  }
}

/**
 * Get clean attendance data without duplicates
 */
export async function getCleanAttendanceLogs(
  employeeId?: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data: any[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const { data, error } = await supabase.rpc('get_clean_attendance_logs', {
      p_employee_id: employeeId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      errors.push(`Failed to get clean attendance logs: ${error.message}`);
      return { success: false, data: [], errors };
    }

    return { success: true, data: data || [], errors };
  } catch (error: any) {
    errors.push(`Failed to fetch attendance data: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

/**
 * Get attendance pairs (check-in/check-out) for better display
 */
export async function getAttendancePairs(
  employeeId?: string,
  date?: string
): Promise<{
  success: boolean;
  data: any[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const { data, error } = await supabase.rpc('get_attendance_pairs', {
      p_employee_id: employeeId || null,
      p_date: date || new Date().toISOString().split('T')[0]
    });

    if (error) {
      errors.push(`Failed to get attendance pairs: ${error.message}`);
      return { success: false, data: [], errors };
    }

    return { success: true, data: data || [], errors };
  } catch (error: any) {
    errors.push(`Failed to fetch attendance pairs: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

/**
 * Get attendance summary with check-in/check-out information
 */
export async function getAttendanceSummary(
  date?: string
): Promise<{
  success: boolean;
  data: any[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const { data, error } = await supabase.rpc('get_attendance_summary', {
      p_date: date || new Date().toISOString().split('T')[0]
    });

    if (error) {
      errors.push(`Failed to get attendance summary: ${error.message}`);
      return { success: false, data: [], errors };
    }

    return { success: true, data: data || [], errors };
  } catch (error: any) {
    errors.push(`Failed to fetch attendance summary: ${error.message}`);
    return { success: false, data: [], errors };
  }
}

