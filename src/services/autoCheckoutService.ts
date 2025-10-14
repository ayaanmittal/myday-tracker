import { supabase } from '@/integrations/supabase/client';

export interface AutoCheckoutResult {
  success: boolean;
  message: string;
  recordsUpdated?: number;
  error?: string;
}

export class AutoCheckoutService {
  /**
   * Run auto default checkout for today
   */
  static async runForToday(): Promise<AutoCheckoutResult> {
    try {
      const { data, error } = await supabase.rpc('auto_default_checkout');
      
      if (error) {
        console.error('Error running auto default checkout for today:', error);
        return {
          success: false,
          message: 'Failed to run auto default checkout for today',
          error: error.message
        };
      }
      
      return {
        success: true,
        message: 'Auto default checkout completed for today'
      };
    } catch (err) {
      console.error('Error in runForToday:', err);
      return {
        success: false,
        message: 'Failed to run auto default checkout for today',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Run auto default checkout for a specific date
   */
  static async runForDate(targetDate: string): Promise<AutoCheckoutResult> {
    try {
      const { data, error } = await supabase.rpc('auto_default_checkout_for_date', {
        target_date: targetDate
      });
      
      if (error) {
        console.error('Error running auto default checkout for date:', error);
        return {
          success: false,
          message: `Failed to run auto default checkout for ${targetDate}`,
          error: error.message
        };
      }
      
      return {
        success: true,
        message: `Auto default checkout completed for ${targetDate}`
      };
    } catch (err) {
      console.error('Error in runForDate:', err);
      return {
        success: false,
        message: `Failed to run auto default checkout for ${targetDate}`,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Run auto default checkout for a date range
   */
  static async runForDateRange(startDate: string, endDate: string): Promise<AutoCheckoutResult> {
    try {
      const { data, error } = await supabase.rpc('auto_default_checkout_for_date_range', {
        start_date: startDate,
        end_date: endDate
      });
      
      if (error) {
        console.error('Error running auto default checkout for date range:', error);
        return {
          success: false,
          message: `Failed to run auto default checkout for date range ${startDate} to ${endDate}`,
          error: error.message
        };
      }
      
      return {
        success: true,
        message: `Auto default checkout completed for date range ${startDate} to ${endDate}`
      };
    } catch (err) {
      console.error('Error in runForDateRange:', err);
      return {
        success: false,
        message: `Failed to run auto default checkout for date range ${startDate} to ${endDate}`,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Get records that would be affected by auto default checkout for today
   */
  static async getAffectedRecordsForToday(): Promise<{ records: any[]; count: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('unified_attendance')
        .select('*')
        .eq('entry_date', today)
        .not('check_in_at', 'is', null)
        .is('check_out_at', null)
        .in('status', ['in_progress']);
      
      if (error) {
        console.error('Error getting affected records for today:', error);
        return { records: [], count: 0 };
      }
      
      return {
        records: data || [],
        count: data?.length || 0
      };
    } catch (err) {
      console.error('Error in getAffectedRecordsForToday:', err);
      return { records: [], count: 0 };
    }
  }

  /**
   * Get records that would be affected by auto default checkout for a specific date
   */
  static async getAffectedRecordsForDate(targetDate: string): Promise<{ records: any[]; count: number }> {
    try {
      const { data, error } = await supabase
        .from('unified_attendance')
        .select('*')
        .eq('entry_date', targetDate)
        .not('check_in_at', 'is', null)
        .is('check_out_at', null)
        .in('status', ['in_progress']);
      
      if (error) {
        console.error('Error getting affected records for date:', error);
        return { records: [], count: 0 };
      }
      
      return {
        records: data || [],
        count: data?.length || 0
      };
    } catch (err) {
      console.error('Error in getAffectedRecordsForDate:', err);
      return { records: [], count: 0 };
    }
  }

  /**
   * Get records that would be affected by auto default checkout for a date range
   */
  static async getAffectedRecordsForDateRange(startDate: string, endDate: string): Promise<{ records: any[]; count: number }> {
    try {
      const { data, error } = await supabase
        .from('unified_attendance')
        .select('*')
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .not('check_in_at', 'is', null)
        .is('check_out_at', null)
        .in('status', ['in_progress']);
      
      if (error) {
        console.error('Error getting affected records for date range:', error);
        return { records: [], count: 0 };
      }
      
      return {
        records: data || [],
        count: data?.length || 0
      };
    } catch (err) {
      console.error('Error in getAffectedRecordsForDateRange:', err);
      return { records: [], count: 0 };
    }
  }

  /**
   * Get records that need auto checkout at 11:59 PM (employees with check-in but no check-out)
   */
  static async getRecordsNeedingAutoCheckout(): Promise<{ records: any[]; count: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('unified_attendance')
        .select('*')
        .eq('entry_date', today)
        .not('check_in_at', 'is', null)
        .is('check_out_at', null)
        .in('status', ['in_progress']);
      
      if (error) {
        console.error('Error getting records needing auto checkout:', error);
        return { records: [], count: 0 };
      }
      
      return {
        records: data || [],
        count: data?.length || 0
      };
    } catch (err) {
      console.error('Error in getRecordsNeedingAutoCheckout:', err);
      return { records: [], count: 0 };
    }
  }

  /**
   * Run auto checkout at 11:59 PM for employees who checked in but didn't check out
   */
  static async runAutoCheckoutAt1159PM(): Promise<AutoCheckoutResult> {
    try {
      const { records } = await this.getRecordsNeedingAutoCheckout();
      
      if (records.length === 0) {
        return {
          success: true,
          message: 'No employees need auto checkout at 11:59 PM',
          recordsUpdated: 0
        };
      }

      const today = new Date().toISOString().split('T')[0];
      const checkoutTime = `${today}T17:00:00+05:30`; // 5:00 PM IST
      
      let updatedCount = 0;
      const errors: string[] = [];

      for (const record of records) {
        try {
          // Calculate total work time in minutes (from check-in to 5:00 PM)
          const checkInTime = new Date(record.check_in_at);
          const checkOutTime = new Date(checkoutTime);
          const totalWorkTimeMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

          const { error: updateError } = await supabase
            .from('unified_attendance')
            .update({
              check_out_at: checkoutTime,
              total_work_time_minutes: totalWorkTimeMinutes,
              status: 'completed',
              modification_reason: 'Auto checkout at 11:59 PM',
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);

          if (updateError) {
            errors.push(`Failed to update ${record.employee_name || record.employee_code}: ${updateError.message}`);
          } else {
            updatedCount++;
          }
        } catch (err) {
          errors.push(`Error processing ${record.employee_name || record.employee_code}: ${err}`);
        }
      }

      // Log the operation
      await supabase
        .from('api_refresh_logs')
        .insert({
          operation: 'auto_checkout_1159pm',
          status: errors.length === 0 ? 'success' : 'partial_success',
          records_processed: updatedCount,
          records_found: records.length,
          error_message: errors.length > 0 ? errors.join('; ') : null,
          created_at: new Date().toISOString()
        });

      return {
        success: errors.length === 0,
        message: `Auto checkout completed. Updated ${updatedCount} out of ${records.length} records.`,
        recordsUpdated: updatedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (err) {
      console.error('Error in runAutoCheckoutAt1159PM:', err);
      return {
        success: false,
        message: 'Failed to run auto checkout at 11:59 PM',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }
}
