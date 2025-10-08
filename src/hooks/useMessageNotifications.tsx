import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export function useMessageNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Messaging feature temporarily disabled during schema migration
    console.log('Message notifications temporarily disabled');
    setUnreadCount(0);
  }, [user]);

  // Update page title
  useEffect(() => {
    const baseTitle = 'MyDay | Zoogol';
    document.title = baseTitle;
  }, []);

  return { unreadCount };
}
