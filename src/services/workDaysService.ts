import { supabase } from '@/integrations/supabase/client';

export interface WorkDaysConfig {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface ProcessedRecord {
  user_id: string;
  entry_date: string;
  old_status: string;
  new_status: string;
  processed_count: number;
}

/**
 * Get work days configuration for a user
 */
export async function getWorkDaysConfig(userId: string): Promise<{ success: boolean; config: WorkDaysConfig | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('get_employee_work_days', {
      employee_user_id: userId,
    });

    if (error) {
      console.error('Error fetching work days config:', error);
      return { success: false, config: null, error: error.message };
    }

    return { success: true, config: data ? data[0] : null, error: null };
  } catch (err) {
    console.error('Exception fetching work days config:', err);
    return { success: false, config: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Update work days configuration for a user
 */
export async function updateWorkDaysConfig(
  userId: string, 
  config: WorkDaysConfig
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('employee_work_days')
      .upsert({
        user_id: userId,
        monday: config.monday,
        tuesday: config.tuesday,
        wednesday: config.wednesday,
        thursday: config.thursday,
        friday: config.friday,
        saturday: config.saturday,
        sunday: config.sunday,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error updating work days config:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Exception updating work days config:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Process existing attendance records based on work days configuration
 */
export async function processExistingAttendanceBasedOnWorkDays(
  startDate: string,
  endDate: string
): Promise<{ success: boolean; records: ProcessedRecord[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('process_existing_attendance_based_on_work_days', {
      start_date_param: startDate,
      end_date_param: endDate,
    });

    if (error) {
      console.error('Error processing existing attendance:', error);
      return { success: false, records: [], error: error.message };
    }

    return { success: true, records: data || [], error: null };
  } catch (err) {
    console.error('Exception processing existing attendance:', err);
    return { success: false, records: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Generate missing attendance records based on work days configuration
 */
export async function generateMissingWorkDayRecords(
  startDate: string,
  endDate: string
): Promise<{ success: boolean; records: ProcessedRecord[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('generate_missing_work_day_records', {
      start_date_param: startDate,
      end_date_param: endDate,
    });

    if (error) {
      console.error('Error generating missing work day records:', error);
      return { success: false, records: [], error: error.message };
    }

    return { success: true, records: data || [], error: null };
  } catch (err) {
    console.error('Exception generating missing work day records:', err);
    return { success: false, records: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get work days summary for a user
 */
export async function getWorkDaysSummary(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ 
  success: boolean; 
  summary: {
    totalDays: number;
    workDays: number;
    holidayDays: number;
    absentDays: number;
    presentDays: number;
  } | null; 
  error: string | null 
}> {
  try {
    // Get work days configuration
    const { success: configSuccess, config, error: configError } = await getWorkDaysConfig(userId);
    if (!configSuccess || !config) {
      return { success: false, summary: null, error: configError || 'Failed to get work days config' };
    }

    // Get attendance records
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('unified_attendance')
      .select('entry_date, status')
      .eq('user_id', userId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (attendanceError) {
      console.error('Error fetching attendance data:', attendanceError);
      return { success: false, summary: null, error: attendanceError.message };
    }

    // Calculate summary
    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalDays = 0;
    let workDays = 0;
    let holidayDays = 0;
    let absentDays = 0;
    let presentDays = 0;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      totalDays++;
      const dayOfWeek = date.getDay();
      
      const isWorkDay = (() => {
        switch (dayOfWeek) {
          case 0: return config.sunday;
          case 1: return config.monday;
          case 2: return config.tuesday;
          case 3: return config.wednesday;
          case 4: return config.thursday;
          case 5: return config.friday;
          case 6: return config.saturday;
          default: return false;
        }
      })();

      if (isWorkDay) {
        workDays++;
        
        const attendanceRecord = attendanceData?.find(record => 
          new Date(record.entry_date).toDateString() === date.toDateString()
        );

        if (attendanceRecord) {
          switch (attendanceRecord.status) {
            case 'completed':
            case 'in_progress':
              presentDays++;
              break;
            case 'absent':
              absentDays++;
              break;
            case 'holiday':
              holidayDays++;
              break;
          }
        } else {
          absentDays++; // No record on work day = absent
        }
      } else {
        holidayDays++; // Non-work day = holiday
      }
    }

    return {
      success: true,
      summary: {
        totalDays,
        workDays,
        holidayDays,
        absentDays,
        presentDays,
      },
      error: null,
    };
  } catch (err) {
    console.error('Exception getting work days summary:', err);
    return { success: false, summary: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
