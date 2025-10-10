import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Get environment variables based on the environment
const getEnvVar = (key: string, fallback?: string) => {
  // Browser environment (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || fallback;
  }
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback || '';
};

// Get environment variables lazily
const getSupabaseConfig = () => {
  const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', "https://iurnwjzxqskliuyttomt.supabase.co");
  const SUPABASE_SERVICE_KEY = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') || 
                               getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || 
                               getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') || 
                               getEnvVar('SUPABASE_ANON_KEY') || '';

  if (!SUPABASE_SERVICE_KEY && typeof process !== 'undefined') {
    console.warn('Missing SUPABASE_SERVICE_ROLE_KEY environment variable - server-side operations will not work');
  }

  return { SUPABASE_URL, SUPABASE_SERVICE_KEY };
};

// Service client for server-side operations (bypasses RLS)
// Create lazily to ensure environment variables are loaded
let _supabaseService: any = null;

export const supabaseService = new Proxy({} as any, {
  get(target, prop) {
    if (!_supabaseService) {
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = getSupabaseConfig();
      
      if (!SUPABASE_SERVICE_KEY) {
        throw new Error('Service client not available - SUPABASE_SERVICE_ROLE_KEY not configured');
      }
      
      _supabaseService = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
    return _supabaseService[prop];
  }
});
