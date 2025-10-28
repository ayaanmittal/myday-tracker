import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useMessageNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        // Get all conversations where user is a participant
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select('id')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

        if (convError) {
          console.error('Error fetching conversations:', convError);
          return;
        }

        if (!conversations || conversations.length === 0) {
          setUnreadCount(0);
          return;
        }

        const conversationIds = conversations.map(c => c.id);

        // Count unread messages across all conversations
        const { count, error: msgError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        if (msgError) {
          console.error('Error counting unread messages:', msgError);
          setUnreadCount(0);
          return;
        }

        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error fetching unread message count:', error);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();

    // Set up polling to refresh unread count (every 10 seconds)
    const interval = setInterval(fetchUnreadCount, 10000);

    return () => clearInterval(interval);
  }, [user]);

  // Update page title with unread count
  useEffect(() => {
    const baseTitle = 'MyDay | ERCMAX';
    document.title = unreadCount > 0 
      ? `(${unreadCount}) ${baseTitle}`
      : baseTitle;
  }, [unreadCount]);

  return { unreadCount };
}
