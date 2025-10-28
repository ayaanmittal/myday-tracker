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
        return null;
      }
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }
      
      return data?.role as UserRole | null;
    },
    enabled: !!user?.id,
    retry: false, // Don't retry on error to prevent infinite loops
    staleTime: Infinity, // Cache forever until manually invalidated
    gcTime: Infinity, // Keep in cache forever
  });

  return query;
}