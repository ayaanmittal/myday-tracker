import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'manager' | 'employee';

export function useUserRole() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['userRole', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('useUserRole: No user ID available');
        return null;
      }

      console.log('useUserRole: Fetching role for user ID:', user.id);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      console.log('useUserRole: Query result:', { data, error });

      if (error) {
        console.error('Error fetching user role:', error);
        // Return null instead of throwing to prevent logout
        return null;
      }
      
      console.log('useUserRole: Returning role:', data?.role);
      return data?.role as UserRole | null;
    },
    enabled: !!user?.id,
    retry: false, // Don't retry on error to prevent infinite loops
  });

  console.log('useUserRole: Query state:', { 
    data: query.data, 
    isLoading: query.isLoading, 
    error: query.error,
    status: query.status 
  });

  return query;
}