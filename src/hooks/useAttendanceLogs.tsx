import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AttendanceLog {
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
  profile_id: string | null;
}

export interface AttendanceSummary {
  total_days: number;
  total_work_minutes: number;
  average_work_minutes: number;
  total_biometric_logs: number;
}

export function useAttendanceLogs(employeeId?: string, startDate?: string, endDate?: string, showAllEmployees: boolean = false) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let query = supabase
          .from('unified_attendance')
          .select('*')
          .order('entry_date', { ascending: false });

        if (employeeId) {
          query = query.eq('user_id', employeeId);
        } else if (showAllEmployees) {
          // Show all employees' logs (for managers/admins)
          // No additional filter needed
        } else {
          // For regular users, only show their own logs
          query = query.eq('user_id', user.id);
        }

        if (startDate && endDate) {
          // Filter by entry_date for unified_attendance table
          query = query
            .gte('entry_date', startDate)
            .lte('entry_date', endDate);
        }

        const { data: logsData, error } = await query;

        if (error) throw error;

        // Since we're using unified_attendance, the data is already processed
        // No need to fetch additional day_entries or combine data
        setLogs(logsData || []);
      } catch (err) {
        console.error('Error fetching attendance logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch attendance logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, employeeId, startDate, endDate, showAllEmployees]);

  return { logs, loading, error, refetch: () => {
    if (user) {
      const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        
        try {
          let query = supabase
            .from('unified_attendance')
            .select('*')
            .order('entry_date', { ascending: false });

          if (employeeId) {
            query = query.eq('user_id', employeeId);
          } else if (showAllEmployees) {
            // Show all employees' logs (for managers/admins)
            // No additional filter needed
          } else {
            // For regular users, only show their own logs
            query = query.eq('user_id', user.id);
          }

          if (startDate && endDate) {
            // Filter by entry_date for unified_attendance table
            query = query
              .gte('entry_date', startDate)
              .lte('entry_date', endDate);
          }

          const { data: logsData, error } = await query;

          if (error) throw error;

          // Since we're using unified_attendance, the data is already processed
          // No need to fetch additional day_entries or combine data
          setLogs(logsData || []);
        } catch (err) {
          console.error('Error fetching attendance logs:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch attendance logs');
        } finally {
          setLoading(false);
        }
      };
      fetchLogs();
    }
  }};
}

export function useAttendanceSummary(date?: string) {
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .rpc('get_attendance_summary', {
            p_date: targetDate
          });

        if (error) throw error;

        setSummary(data || []);
      } catch (err) {
        console.error('Error fetching attendance summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch attendance summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [user, date]);

  return { summary, loading, error };
}
