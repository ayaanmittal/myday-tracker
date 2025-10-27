import { supabase } from '@/integrations/supabase/client';

export interface AttendanceSummary {
  total_days: number;
  work_days: number;
  present_days: number;
  absent_days: number;
  holiday_days: number;
  in_progress_days: number;
}

export interface GeneratedRecord {
  user_id: string;
  entry_date: string;
  status: 'absent' | 'holiday';
  generated_count: number;
}

export interface UpdatedRecord {
  user_id: string;
  entry_date: string;
  old_status: string;
  new_status: string;
  updated_count: number;
}

export interface BulkLeaveResult {
  success: boolean;
  inserted: number;
  updated: number;
  errors: string[];
}

export async function markUsersHolidayRange(
  startDate: string,
  endDate: string,
  userIds: string[],
): Promise<BulkLeaveResult> {
  try {
    const { data, error } = await supabase.rpc('mark_users_holiday_range', {
      start_date: startDate,
      end_date: endDate,
      user_ids: userIds && userIds.length > 0 ? userIds : null,
    });

    if (error) {
      return { success: false, inserted: 0, updated: 0, errors: [error.message] };
    }

    return {
      success: true,
      inserted: Number(data?.inserted || 0),
      updated: Number(data?.updated || 0),
      errors: []
    };
  } catch (e: any) {
    return { success: false, inserted: 0, updated: 0, errors: [e?.message || 'Unknown error'] };
  }
}

export async function markOfficeHolidayRange(
  startDate: string,
  endDate: string,
  userIds: string[] | null,
  holidayName?: string,
): Promise<BulkLeaveResult> {
  try {
    const { data, error } = await supabase.rpc('mark_office_holiday_range', {
      start_date: startDate,
      end_date: endDate,
      user_ids: userIds,
      holiday_name: holidayName || null,
    });

    if (error) {
      // If authorization error, try the simple version
      if (error.message.includes('Not authorized') || error.message.includes('Not authenticated')) {
        console.log('Authorization error, trying simple version...');
        return await markOfficeHolidayRangeSimple(startDate, endDate, userIds, holidayName);
      }
      return { success: false, inserted: 0, updated: 0, errors: [error.message] };
    }

    return {
      success: true,
      inserted: Number(data?.inserted_attendance || 0),
      updated: Number(data?.updated_attendance || 0),
      errors: []
    };
  } catch (e: any) {
    return { success: false, inserted: 0, updated: 0, errors: [e?.message || 'Unknown error'] };
  }
}

export async function markOfficeHolidayRangeSimple(
  startDate: string,
  endDate: string,
  userIds: string[] | null,
  holidayName?: string,
): Promise<BulkLeaveResult> {
  try {
    const { data, error } = await supabase.rpc('mark_office_holiday_simple', {
      start_date: startDate,
      end_date: endDate,
      user_ids: userIds,
      holiday_name: holidayName || null,
    });

    if (error) {
      return { success: false, inserted: 0, updated: 0, errors: [error.message] };
    }

    return {
      success: true,
      inserted: Number(data?.inserted_attendance || 0),
      updated: Number(data?.updated_attendance || 0),
      errors: []
    };
  } catch (e: any) {
    return { success: false, inserted: 0, updated: 0, errors: [e?.message || 'Unknown error'] };
  }
}

export async function markOfficeHolidayRangeTest(
  startDate: string,
  endDate: string,
  userIds: string[] | null,
): Promise<BulkLeaveResult> {
  try {
    const { data, error } = await supabase.rpc('mark_office_holiday_range_test', {
      start_date: startDate,
      end_date: endDate,
      user_ids: userIds,
    });

    if (error) {
      return { success: false, inserted: 0, updated: 0, errors: [error.message] };
    }

    return {
      success: true,
      inserted: Number(data?.inserted || 0),
      updated: Number(data?.updated || 0),
      errors: []
    };
  } catch (e: any) {
    return { success: false, inserted: 0, updated: 0, errors: [e?.message || 'Unknown error'] };
  }
}

/**
 * Generate missing attendance records for a date range
 * This will create records for days when employees didn't check in/out
 * - Work days without attendance = 'absent'
 * - Non-work days = 'holiday'
 */
export async function generateMissingAttendanceRecords(
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  records: GeneratedRecord[];
  totalGenerated: number;
  errors: string[];
}> {
  try {
    const { data, error } = await supabase.rpc('generate_missing_attendance_records', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error generating missing attendance records:', error);
      return {
        success: false,
        records: [],
        totalGenerated: 0,
        errors: [error.message]
      };
    }

    // Filter out summary record and get actual records
    const records = data.filter((record: any) => record.status !== 'summary') as GeneratedRecord[];
    const summaryRecord = data.find((record: any) => record.status === 'summary');
    const totalGenerated = summaryRecord?.generated_count || 0;

    return {
      success: true,
      records,
      totalGenerated,
      errors: []
    };
  } catch (error) {
    console.error('Error generating missing attendance records:', error);
    return {
      success: false,
      records: [],
      totalGenerated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Update existing absent records to holiday if they're not work days
 * This corrects records that were marked as absent but should be holiday
 */
export async function updateAbsentToHoliday(
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  records: UpdatedRecord[];
  totalUpdated: number;
  errors: string[];
}> {
  try {
    const { data, error } = await supabase.rpc('update_absent_to_holiday', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error updating absent to holiday:', error);
      return {
        success: false,
        records: [],
        totalUpdated: 0,
        errors: [error.message]
      };
    }

    const records = data as UpdatedRecord[];
    const totalUpdated = records.reduce((sum, record) => sum + record.updated_count, 0);

    return {
      success: true,
      records,
      totalUpdated,
      errors: []
    };
  } catch (error) {
    console.error('Error updating absent to holiday:', error);
    return {
      success: false,
      records: [],
      totalUpdated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Get attendance summary with holiday distinction
 * This provides a breakdown of present, absent, and holiday days
 */
export async function getAttendanceSummaryWithHolidays(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  summary: AttendanceSummary | null;
  errors: string[];
}> {
  try {
    const { data, error } = await supabase.rpc('get_attendance_summary_with_holidays', {
      employee_user_id: userId,
      start_date: startDate,
      end_date: endDate
    });

    if (error) {
      console.error('Error getting attendance summary:', error);
      return {
        success: false,
        summary: null,
        errors: [error.message]
      };
    }

    const summary = data?.[0] as AttendanceSummary || null;

    return {
      success: true,
      summary,
      errors: []
    };
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    return {
      success: false,
      summary: null,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Process attendance records to ensure proper holiday/absent distinction
 * This is a comprehensive function that:
 * 1. Updates existing absent records to holiday if not work days
 * 2. Generates missing attendance records
 */
export async function processAttendanceHolidays(
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  updatedRecords: UpdatedRecord[];
  generatedRecords: GeneratedRecord[];
  totalUpdated: number;
  totalGenerated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    // Step 1: Update existing absent records to holiday if not work days
    console.log('Step 1: Updating absent records to holiday...');
    const updateResult = await updateAbsentToHoliday(startDate, endDate);
    
    if (!updateResult.success) {
      errors.push(...updateResult.errors);
    }

    // Step 2: Generate missing attendance records
    console.log('Step 2: Generating missing attendance records...');
    const generateResult = await generateMissingAttendanceRecords(startDate, endDate);
    
    if (!generateResult.success) {
      errors.push(...generateResult.errors);
    }

    return {
      success: errors.length === 0,
      updatedRecords: updateResult.records,
      generatedRecords: generateResult.records,
      totalUpdated: updateResult.totalUpdated,
      totalGenerated: generateResult.totalGenerated,
      errors
    };
  } catch (error) {
    console.error('Error processing attendance holidays:', error);
    return {
      success: false,
      updatedRecords: [],
      generatedRecords: [],
      totalUpdated: 0,
      totalGenerated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}
