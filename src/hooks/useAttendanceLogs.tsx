import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AttendanceLog {
  id: number;
  employee_id: string;
  employee_name: string | null;
  log_time: string;
  log_type: 'checkin' | 'checkout' | 'unknown';
  device_id: string | null;
  source: 'manual' | 'teamoffice';
  raw_payload: any;
  created_at: string;
  // Manual update tracking fields (will be added to database later)
  is_manual_update?: boolean;
  updated_by?: string;
  updated_at?: string;
  update_reason?: string;
  original_log_time?: string;
  original_source?: string;
  // Day entries data
  day_entries?: {
    check_in_at: string | null;
    check_out_at: string | null;
    entry_date: string;
  }[];
}

export interface AttendanceSummary {
  employee_id: string;
  employee_name: string | null;
  first_checkin: string | null;
  last_checkout: string | null;
  total_manual_logs: number;
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
          .from('attendance_logs')
          .select('*')
          .order('log_time', { ascending: false });

        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        } else if (showAllEmployees) {
          // Show all employees' logs (for managers/admins)
          // No additional filter needed
        } else {
          // For regular users, only show their own logs
          query = query.eq('employee_id', user.id);
        }

        if (startDate && endDate) {
          // Convert dates to proper timestamp format for comparison
          const startDateTime = `${startDate}T00:00:00.000Z`;
          const endDateTime = `${endDate}T23:59:59.999Z`;
          
          query = query
            .gte('log_time', startDateTime)
            .lte('log_time', endDateTime);
        }

        const { data: logsData, error } = await query;

        if (error) throw error;

        // Fetch day_entries for manual entries (to avoid duplicates with biometric data)
        const userIds = [...new Set((logsData || []).map(log => log.employee_id))];
        const dates = [...new Set((logsData || []).map(log => log.log_time.split('T')[0]))];
        
        let dayEntriesData: any[] = [];
        
        // Always fetch day_entries for the specified date range, regardless of attendance_logs
        if (startDate && endDate) {
          console.log('Fetching day_entries for date range:', startDate, 'to', endDate);
          const { data: dayEntries, error: dayEntriesError } = await supabase
            .from('day_entries')
            .select(`
              user_id, 
              check_in_at, 
              check_out_at, 
              entry_date
            `)
            .gte('entry_date', startDate)
            .lte('entry_date', endDate);
          
          console.log('Day entries query result:', { dayEntries, dayEntriesError });
          
          if (!dayEntriesError) {
            dayEntriesData = dayEntries || [];
          }
        } else if (userIds.length > 0 && dates.length > 0) {
          // Fallback: if no date range specified, use user IDs and dates from attendance_logs
          const { data: dayEntries, error: dayEntriesError } = await supabase
            .from('day_entries')
            .select(`
              user_id, 
              check_in_at, 
              check_out_at, 
              entry_date
            `)
            .in('user_id', userIds)
            .in('entry_date', dates);
          
          if (!dayEntriesError) {
            dayEntriesData = dayEntries || [];
          }
        }

        // Combine logs with day_entries data
        const logsWithDayEntries = (logsData || []).map(log => {
          const logDate = log.log_time.split('T')[0];
          const matchingDayEntry = dayEntriesData.find(
            de => de.user_id === log.employee_id && de.entry_date === logDate
          );
          
          
          return {
            ...log,
            day_entries: matchingDayEntry ? [matchingDayEntry] : []
          };
        });

        setLogs(logsWithDayEntries);
      } catch (err) {
        console.error('Error fetching attendance logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch attendance logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, employeeId, startDate, endDate]);

  return { logs, loading, error, refetch: () => {
    if (user) {
      const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        
        try {
          let query = supabase
            .from('attendance_logs')
            .select('*')
            .order('log_time', { ascending: false });

          if (employeeId) {
            query = query.eq('employee_id', employeeId);
          } else if (showAllEmployees) {
            // Show all employees' logs (for managers/admins)
            // No additional filter needed
          } else {
            // For regular users, only show their own logs
            query = query.eq('employee_id', user.id);
          }

          if (startDate && endDate) {
            // Convert dates to proper timestamp format for comparison
            const startDateTime = `${startDate}T00:00:00.000Z`;
            const endDateTime = `${endDate}T23:59:59.999Z`;
            
            query = query
              .gte('log_time', startDateTime)
              .lte('log_time', endDateTime);
          }

          const { data: logsData, error } = await query;

          if (error) throw error;

          // Fetch day_entries for manual entries (to avoid duplicates with biometric data)
          const userIds = [...new Set((logsData || []).map(log => log.employee_id))];
          const dates = [...new Set((logsData || []).map(log => log.log_time.split('T')[0]))];
          
          let dayEntriesData: any[] = [];
          
          // Always fetch day_entries for the specified date range, regardless of attendance_logs
          if (startDate && endDate) {
            const { data: dayEntries, error: dayEntriesError } = await supabase
              .from('day_entries')
              .select('user_id, check_in_at, check_out_at, entry_date')
              .gte('entry_date', startDate)
              .lte('entry_date', endDate);
            
            if (!dayEntriesError) {
              dayEntriesData = dayEntries || [];
            }
          } else if (userIds.length > 0 && dates.length > 0) {
            // Fallback: if no date range specified, use user IDs and dates from attendance_logs
            const { data: dayEntries, error: dayEntriesError } = await supabase
              .from('day_entries')
              .select('user_id, check_in_at, check_out_at, entry_date')
              .in('user_id', userIds)
              .in('entry_date', dates);
            
            if (!dayEntriesError) {
              dayEntriesData = dayEntries || [];
            }
          }

        // Fetch profile names for manual entries
        const userIdsForProfiles = [...new Set(dayEntriesData.map(entry => entry.user_id))];
        let profileNames: { [key: string]: string } = {};
        
        if (userIdsForProfiles.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIdsForProfiles);
          
          if (profiles) {
            profileNames = profiles.reduce((acc, profile) => {
              acc[profile.id] = profile.name;
              return acc;
            }, {} as { [key: string]: string });
          }
        }

        // Create manual entries from day_entries (to show manual check-ins/outs)
        const manualEntries: any[] = [];
        
        dayEntriesData.forEach(dayEntry => {
          // Only create manual entries if there's no corresponding biometric entry
          const hasBiometricCheckin = logsData.some(log => 
            log.employee_id === dayEntry.user_id && 
            log.log_type === 'checkin' && 
            log.log_time.split('T')[0] === dayEntry.entry_date
          );
          
          const hasBiometricCheckout = logsData.some(log => 
            log.employee_id === dayEntry.user_id && 
            log.log_type === 'checkout' && 
            log.log_time.split('T')[0] === dayEntry.entry_date
          );
          
          // Create manual check-in entry if exists and no biometric entry
          if (dayEntry.check_in_at && !hasBiometricCheckin) {
            manualEntries.push({
              id: `manual-checkin-${dayEntry.user_id}-${dayEntry.entry_date}`,
              employee_id: dayEntry.user_id,
              employee_name: profileNames[dayEntry.user_id] || 'Unknown',
              log_time: dayEntry.check_in_at,
              log_type: 'checkin',
              device_id: 'manual',
              source: 'manual',
              raw_payload: null,
              created_at: dayEntry.check_in_at,
              is_manual_entry: true,
              day_entries: [dayEntry]
            });
          }
          
          // Create manual check-out entry if exists and no biometric entry
          if (dayEntry.check_out_at && !hasBiometricCheckout) {
            manualEntries.push({
              id: `manual-checkout-${dayEntry.user_id}-${dayEntry.entry_date}`,
              employee_id: dayEntry.user_id,
              employee_name: profileNames[dayEntry.user_id] || 'Unknown',
              log_time: dayEntry.check_out_at,
              log_type: 'checkout',
              device_id: 'manual',
              source: 'manual',
              raw_payload: null,
              created_at: dayEntry.check_out_at,
              is_manual_entry: true,
              day_entries: [dayEntry]
            });
          }
        });

        // Combine biometric logs with manual entries
        const allLogs = [...logsData, ...manualEntries];
        
        // Sort by log_time descending
        allLogs.sort((a, b) => new Date(b.log_time).getTime() - new Date(a.log_time).getTime());

        console.log('useAttendanceLogs Debug:', {
          startDate,
          endDate,
          showAllEmployees,
          logsDataCount: logsData?.length || 0,
          dayEntriesDataCount: dayEntriesData?.length || 0,
          manualEntriesCount: manualEntries.length,
          allLogsCount: allLogs.length,
          allLogs: allLogs.map(log => `${log.employee_name || log.employee_id} - ${log.log_type} - ${log.source}`)
        });
        
        // Also log the individual entries for debugging
        console.log('Manual entries created:', manualEntries);
        console.log('All logs before setting:', allLogs);

        setLogs(allLogs);
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
