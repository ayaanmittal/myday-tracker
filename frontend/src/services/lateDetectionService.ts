/**
 * Centralized Late Detection Service
 * Uses database function for consistent late detection across all entry methods
 */

import { supabase } from '@/integrations/supabase/client';

export interface LateDetectionResult {
  isLate: boolean;
  workdayStartTime: string;
  lateThresholdMinutes: number;
  lateThresholdTime: string;
  checkinTime: string;
}

export class LateDetectionService {
  /**
   * Get late status for a check-in time using database function
   */
  static async getLateStatus(checkinTime: string | Date): Promise<LateDetectionResult> {
    try {
      // Convert to ISO string if Date object
      const checkinTimeStr = checkinTime instanceof Date ? checkinTime.toISOString() : checkinTime;
      
      // Call database function to get late status
      const { data, error } = await supabase.rpc('is_late_final', {
        checkin_time: checkinTimeStr
      });
      
      if (error) {
        console.warn('Error calling get_late_status_for_checkin function:', error);
        // Fallback to client-side calculation
        return this.getLateStatusFallback(checkinTime);
      }
      
      // Get settings for additional info
      const [workdaySettings, thresholdSettings] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'workday_start_time').single(),
        supabase.from('settings').select('value').eq('key', 'late_threshold_minutes').single()
      ]);
      
      const workdayStartTime = workdaySettings.data?.value || '10:30';
      const lateThresholdMinutes = thresholdSettings.data?.value ? parseInt(thresholdSettings.data.value) : 15;
      
      // Calculate threshold time for display
      const checkinDate = new Date(checkinTimeStr);
      const [startHour, startMinute] = workdayStartTime.split(':').map(Number);
      const workdayStart = new Date(checkinDate);
      workdayStart.setHours(startHour, startMinute, 0, 0);
      
      const lateThresholdTime = new Date(workdayStart.getTime() + (lateThresholdMinutes * 60 * 1000));
      
      return {
        isLate: data,
        workdayStartTime,
        lateThresholdMinutes,
        lateThresholdTime: lateThresholdTime.toISOString(),
        checkinTime: checkinTimeStr
      };
      
    } catch (error) {
      console.warn('Error in getLateStatus, using fallback:', error);
      return this.getLateStatusFallback(checkinTime);
    }
  }
  
  /**
   * Fallback client-side late detection (used when database function fails)
   */
  private static async getLateStatusFallback(checkinTime: string | Date): Promise<LateDetectionResult> {
    try {
      // Get settings
      const [workdaySettings, thresholdSettings] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'workday_start_time').single(),
        supabase.from('settings').select('value').eq('key', 'late_threshold_minutes').single()
      ]);
      
      const workdayStartTime = workdaySettings.data?.value || '10:30';
      const lateThresholdMinutes = thresholdSettings.data?.value ? parseInt(thresholdSettings.data.value) : 15;
      
      // Parse check-in time
      const checkinTimeStr = checkinTime instanceof Date ? checkinTime.toISOString() : checkinTime;
      const checkinDate = new Date(checkinTimeStr);
      
      // Calculate workday start time
      const [startHour, startMinute] = workdayStartTime.split(':').map(Number);
      const workdayStart = new Date(checkinDate);
      workdayStart.setHours(startHour, startMinute, 0, 0);
      
      // Calculate late threshold time
      const lateThresholdTime = new Date(workdayStart.getTime() + (lateThresholdMinutes * 60 * 1000));
      
      // Check if check-in is late
      const isLate = checkinDate > lateThresholdTime;
      
      return {
        isLate,
        workdayStartTime,
        lateThresholdMinutes,
        lateThresholdTime: lateThresholdTime.toISOString(),
        checkinTime: checkinTimeStr
      };
      
    } catch (error) {
      console.warn('Error in fallback late detection, using defaults:', error);
      
      // Ultimate fallback with defaults
      const checkinTimeStr = checkinTime instanceof Date ? checkinTime.toISOString() : checkinTime;
      const checkinDate = new Date(checkinTimeStr);
      
      const workdayStartTime = '10:30';
      const lateThresholdMinutes = 15;
      
      const [startHour, startMinute] = workdayStartTime.split(':').map(Number);
      const workdayStart = new Date(checkinDate);
      workdayStart.setHours(startHour, startMinute, 0, 0);
      
      const lateThresholdTime = new Date(workdayStart.getTime() + (lateThresholdMinutes * 60 * 1000));
      const isLate = checkinDate > lateThresholdTime;
      
      return {
        isLate,
        workdayStartTime,
        lateThresholdMinutes,
        lateThresholdTime: lateThresholdTime.toISOString(),
        checkinTime: checkinTimeStr
      };
    }
  }
  
  /**
   * Get current settings for late detection
   */
  static async getLateDetectionSettings(): Promise<{
    workdayStartTime: string;
    lateThresholdMinutes: number;
  }> {
    try {
      const [workdaySettings, thresholdSettings] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'workday_start_time').single(),
        supabase.from('settings').select('value').eq('key', 'late_threshold_minutes').single()
      ]);
      
      return {
        workdayStartTime: workdaySettings.data?.value || '10:30',
        lateThresholdMinutes: thresholdSettings.data?.value ? parseInt(thresholdSettings.data.value) : 15
      };
    } catch (error) {
      console.warn('Error getting late detection settings:', error);
      return {
        workdayStartTime: '10:30',
        lateThresholdMinutes: 15
      };
    }
  }
}
