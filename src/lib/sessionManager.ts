import { supabase } from '@/integrations/supabase/client';

export class SessionManager {
  private static instance: SessionManager;
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes before expiry

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize session management
   */
  async initialize(): Promise<void> {
    try {
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return;
      }

      if (session) {
        console.log('Found existing session for:', session.user.email);
        // Only start refresh if user wants to stay signed in
        if (this.isStaySignedIn()) {
          this.startSessionRefresh();
        }
      }
    } catch (error) {
      console.error('Error initializing session manager:', error);
    }
  }

  /**
   * Start automatic session refresh
   */
  startSessionRefresh(): void {
    // Don't start if already running
    if (this.refreshInterval) {
      console.log('Session refresh already running');
      return;
    }

    // Don't start if user doesn't want to stay signed in
    if (!this.isStaySignedIn()) {
      console.log('User not opted for stay signed in, skipping session refresh');
      return;
    }

    console.log('Starting session refresh with interval:', this.REFRESH_INTERVAL / 1000 / 60, 'minutes');
    
    this.refreshInterval = setInterval(async () => {
      try {
        // Check if user still wants to stay signed in
        if (!this.isStaySignedIn()) {
          console.log('User no longer wants to stay signed in, stopping refresh');
          this.stopSessionRefresh();
          return;
        }

        // Get current session to see remaining time
        const current = await supabase.auth.getSession();
        const session = current.data.session;
        if (!session) {
          console.warn('No active session found during refresh tick');
          return;
        }
        const expiresAtMs = (session.expires_at || 0) * 1000;
        const msLeft = expiresAtMs - Date.now();
        // Refresh only when close to expiry to avoid unnecessary calls
        if (msLeft <= this.REFRESH_THRESHOLD_MS) {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('Error refreshing session:', error);
          } else if (data.session) {
            console.log('Session refreshed successfully for:', data.session.user.email);
          }
        }
      } catch (error) {
        console.error('Error in session refresh:', error);
        // Don't stop refresh on single error, let it retry
      }
    }, this.REFRESH_INTERVAL);
  }

  /**
   * Stop automatic session refresh
   */
  stopSessionRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Check if user wants to stay signed in
   */
  isStaySignedIn(): boolean {
    return localStorage.getItem('stay_signed_in') === 'true';
  }

  /**
   * Set stay signed in preference
   */
  setStaySignedIn(preference: boolean): void {
    if (preference) {
      localStorage.setItem('stay_signed_in', 'true');
      localStorage.setItem('user_preference_stay_signed_in', 'true');
    } else {
      localStorage.removeItem('stay_signed_in');
      localStorage.removeItem('user_preference_stay_signed_in');
    }
  }

  /**
   * Handle sign out
   */
  async signOut(): Promise<void> {
    this.stopSessionRefresh();
    this.setStaySignedIn(false);
    await supabase.auth.signOut();
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    const session = supabase.auth.getSession();
    return session;
  }

  /**
   * Check if session is valid
   */
  async isSessionValid(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      return !error && !!session;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  /**
   * Check if session refresh is currently running
   */
  isRefreshRunning(): boolean {
    return this.refreshInterval !== null;
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();
