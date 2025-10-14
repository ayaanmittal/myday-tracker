import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { sessionManager } from '@/lib/sessionManager';

export function SessionMonitor() {
  const { user, session, isStaySignedIn } = useAuth();
  const [staySignedIn, setStaySignedIn] = useState<boolean>(sessionManager.isStaySignedIn());
  const [sessionInfo, setSessionInfo] = useState<{
    expiresAt: string | null;
    timeUntilExpiry: string | null;
    isExpired: boolean;
  }>({
    expiresAt: null,
    timeUntilExpiry: null,
    isExpired: false,
  });

  useEffect(() => {
    if (!session) return;

    const updateSessionInfo = () => {
      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
      const now = new Date();
      
      if (expiresAt) {
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const isExpired = timeUntilExpiry <= 0;
        
        setSessionInfo({
          expiresAt: expiresAt.toLocaleString(),
          timeUntilExpiry: isExpired ? 'Expired' : `${Math.floor(timeUntilExpiry / (1000 * 60))} minutes`,
          isExpired,
        });
      }
    };

    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [session]);

  // Keep local staySignedIn in sync with storage changes
  useEffect(() => {
    const updateStay = () => setStaySignedIn(sessionManager.isStaySignedIn());
    updateStay();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'stay_signed_in') updateStay();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-refresh session if it's about to expire and user wants to stay signed in
  useEffect(() => {
    const wantStay = isStaySignedIn || staySignedIn;
    if (!wantStay || !session || !sessionInfo.isExpired) return;

    const refreshSession = async () => {
      try {
        console.log('Session expired, attempting refresh...');
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('Failed to refresh session:', error);
          // Don't force logout on refresh error, let the session manager handle it
        } else {
          console.log('Session refreshed successfully');
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
        // Don't force logout on refresh error, let the session manager handle it
      }
    };

    // Only refresh if session is actually expired and user wants to stay signed in
    if (sessionInfo.isExpired && (isStaySignedIn || staySignedIn)) {
      refreshSession();
    }
  }, [sessionInfo.isExpired, isStaySignedIn, staySignedIn, session]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg p-3 text-xs max-w-xs">
      <div className="font-semibold mb-1">Session Monitor</div>
      <div>User: {user?.email || 'Not signed in'}</div>
      <div>Stay signed in: {(isStaySignedIn || staySignedIn) ? 'Yes' : 'No'}</div>
      <div>Expires: {sessionInfo.expiresAt || 'Unknown'}</div>
      <div>Time left: {sessionInfo.timeUntilExpiry || 'Unknown'}</div>
      <div className={`text-xs ${sessionInfo.isExpired ? 'text-destructive' : 'text-success'}`}>
        Status: {sessionInfo.isExpired ? 'Expired' : 'Active'}
      </div>
    </div>
  );
}
