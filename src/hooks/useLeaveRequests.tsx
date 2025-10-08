import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useLeaveRequests() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingCount();
  }, []);

  const fetchPendingCount = async () => {
    try {
      setLoading(true);
      
      const { count, error } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        // If table doesn't exist, don't show error
        if (error.message.includes('relation "leave_requests" does not exist')) {
          setPendingCount(0);
        } else {
          console.error('Error fetching pending leave requests:', error);
          setPendingCount(0);
        }
      } else {
        setPendingCount(count || 0);
      }
    } catch (error) {
      console.error('Error in useLeaveRequests:', error);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  };

  return { pendingCount, loading, refetch: fetchPendingCount };
}
