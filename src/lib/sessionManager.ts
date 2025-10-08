import { supabase } from '@/integrations/supabase/client';

export class SessionManager {
  private static instance: SessionManager;
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
        this.startSessionRefresh();
      }
    } catch (error) {
      console.error('Error initializing session manager:', error);
    }
  }

  /**
   * Start automatic session refresh
   */
  startSessionRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('Error refreshing session:', error);
          this.stopSessionRefresh();
        } else if (session) {
          console.log('Session refreshed successfully for:', session.user.email);
        }
      } catch (error) {
        console.error('Error in session refresh:', error);
        this.stopSessionRefresh();
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
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();
