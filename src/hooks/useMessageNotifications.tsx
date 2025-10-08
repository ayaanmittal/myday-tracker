import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useMessageNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch initial unread count
    const fetchUnreadCount = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('is_read', false);

      if (!error && data !== null) {
        setUnreadCount(data.length || 0);
      }
    };

    fetchUnreadCount();

    // Subscribe to real-time message updates
    const channel = supabase
      .channel('message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `to_user_id=eq.${user.id}`,
        },
        (payload) => {
          setUnreadCount((prev) => prev + 1);
          
          // Show browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification('New Message - MyDay', {
              body: 'You have received a new message',
              icon: '/favicon.ico',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `to_user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Update page title with unread count
  useEffect(() => {
    const baseTitle = 'MyDay | Zoogol';
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
  }, [unreadCount]);

  return { unreadCount };
}