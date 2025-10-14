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
        .eq('check_in_time', today)
        .is('check_out_time', null)
        .not('check_in_time', 'is', null);
      
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
        .eq('check_in_time', targetDate)
        .is('check_out_time', null)
        .not('check_in_time', 'is', null);
      
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
        .gte('check_in_time', startDate)
        .lte('check_in_time', endDate)
        .is('check_out_time', null)
        .not('check_in_time', 'is', null);
      
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
}
