import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '@/lib/sessionManager';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isStaySignedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStaySignedIn, setIsStaySignedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize session manager
    sessionManager.initialize();

    // Check if user wants to stay signed in
    const staySignedIn = sessionManager.isStaySignedIn();
    setIsStaySignedIn(staySignedIn);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle different auth events
        if (event === 'SIGNED_IN' && session) {
          console.log('User signed in:', session.user.email);
          console.log('User ID:', session.user.id);
          // Start session refresh if user wants to stay signed in
          if (sessionManager.isStaySignedIn()) {
            sessionManager.startSessionRefresh();
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          sessionManager.stopSessionRefresh();
          sessionManager.setStaySignedIn(false);
          setIsStaySignedIn(false);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed for:', session?.user?.email);
        }
      }
    );

    // Check for existing session on app load
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        if (session) {
          console.log('Found existing session for:', session.user.email);
          console.log('User ID:', session.user.id);
          setSession(session);
          setUser(session.user);
          
          // Start session refresh if user wants to stay signed in
          if (sessionManager.isStaySignedIn()) {
            sessionManager.startSessionRefresh();
          }
        } else {
          console.log('No existing session found');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
      sessionManager.stopSessionRefresh();
    };
  }, []);

  const signOut = async () => {
    try {
      await sessionManager.signOut();
      console.log('User signed out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, isStaySignedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}