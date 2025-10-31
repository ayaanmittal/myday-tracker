import { supabase } from '../integrations/supabase/client';

export interface BulkAttendanceRecord {
  user_id: string;
  employee_code?: string;
  employee_name?: string;
  entry_date: string; // YYYY-MM-DD
  check_in_at?: string; // ISO timestamp
  check_out_at?: string; // ISO timestamp
  total_work_time_minutes?: number;
  status: 'in_progress' | 'completed' | 'absent';
  is_late?: boolean;
  device_info: string;
  device_id?: string;
  source: 'manual' | 'teamoffice' | 'biometric' | 'import';
  modification_reason?: string;
  lunch_break_start?: string; // ISO timestamp
  lunch_break_end?: string; // ISO timestamp
}

export async function bulkImportAttendance(
  records: BulkAttendanceRecord[]
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  try {
    console.log(`Starting bulk import of ${records.length} attendance records...`);

    // Validate records
    for (const record of records) {
      if (!record.user_id || !record.entry_date || !record.device_info || !record.source) {
        errors.push(`Invalid record: missing required fields`);
        continue;
      }

      // Calculate work time if not provided
      if (!record.total_work_time_minutes && record.check_in_at && record.check_out_at) {
        const checkIn = new Date(record.check_in_at);
        const checkOut = new Date(record.check_out_at);
        record.total_work_time_minutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60));
      }

      // Determine status if not provided
      if (!record.status) {
        if (record.check_in_at && record.check_out_at) {
          record.status = 'completed';
        } else if (record.check_in_at) {
          record.status = 'in_progress';
        } else {
          record.status = 'absent';
        }
      }
    }

    // Insert records in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('unified_attendance')
        .insert(batch)
        .select();

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`);
        console.error('Batch insert error:', error);
      } else {
        processed += batch.length;
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      }
    }

    console.log(`Bulk import completed: ${processed} records processed, ${errors.length} errors`);

    return {
      success: errors.length === 0,
      processed,
      errors
    };

  } catch (error: any) {
    console.error('Bulk import error:', error);
    return {
      success: false,
      processed,
      errors: [...errors, `Unexpected error: ${error.message}`]
    };
  }
}

// Helper function to create records from CSV data
export function createAttendanceRecordsFromCSV(
  csvData: any[],
  userMapping: Record<string, string> // employee_code -> user_id
): BulkAttendanceRecord[] {
  return csvData.map(row => ({
    user_id: userMapping[row.employee_code] || '',
    employee_code: row.employee_code,
    employee_name: row.employee_name,
    entry_date: row.entry_date,
    check_in_at: row.check_in_at ? new Date(row.check_in_at).toISOString() : undefined,
    check_out_at: row.check_out_at ? new Date(row.check_out_at).toISOString() : undefined,
    total_work_time_minutes: row.total_work_time_minutes,
    status: row.status || 'in_progress',
    is_late: row.is_late === 'true' || row.is_late === true,
    device_info: row.device_info || 'Import',
    device_id: row.device_id,
    source: 'import' as const,
    modification_reason: 'Bulk CSV import',
    lunch_break_start: row.lunch_break_start ? new Date(row.lunch_break_start).toISOString() : undefined,
    lunch_break_end: row.lunch_break_end ? new Date(row.lunch_break_end).toISOString() : undefined,
  }));
}

