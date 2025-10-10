import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UnacknowledgedRule {
  rule_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  is_newly_added: boolean;
  is_recently_updated: boolean;
  change_type?: 'added' | 'updated';
}

export function useUnacknowledgedRules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unacknowledged-rules', user?.id],
    queryFn: async (): Promise<UnacknowledgedRule[]> => {
      if (!user?.id) return [];

      // Get all active rules (try with new columns first, fallback to basic columns)
      let allRules;
      let rulesError;
      
      try {
        const result = await supabase
          .from('office_rules')
          .select('id, title, description, created_at, updated_at, is_newly_added, is_recently_updated')
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        
        allRules = result.data;
        rulesError = result.error;
      } catch (error) {
        // Fallback to basic columns if new columns don't exist
        const result = await supabase
          .from('office_rules')
          .select('id, title, description, created_at, updated_at')
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        
        allRules = result.data;
        rulesError = result.error;
      }

      if (rulesError) throw rulesError;

      // Get user's acknowledged rules
      const { data: acknowledgedRules, error: ackError } = await supabase
        .from('rule_acknowledgments')
        .select('rule_id')
        .eq('user_id', user.id);

      if (ackError) throw ackError;

      const acknowledgedRuleIds = new Set(acknowledgedRules?.map(r => r.rule_id) || []);

      // Return rules that haven't been acknowledged
      const unacknowledgedRules = allRules?.filter(rule => !acknowledgedRuleIds.has(rule.id)).map(rule => {
        // Determine change type based on flags (with fallback for missing columns)
        let change_type: 'added' | 'updated' | undefined;
        let is_newly_added = false;
        let is_recently_updated = false;
        
        if ('is_newly_added' in rule && rule.is_newly_added) {
          change_type = 'added';
          is_newly_added = true;
        } else if ('is_recently_updated' in rule && rule.is_recently_updated) {
          change_type = 'updated';
          is_recently_updated = true;
        } else {
          // Fallback: use time-based detection
          const createdDate = new Date(rule.created_at);
          const updatedDate = new Date(rule.updated_at);
          const timeDiff = updatedDate.getTime() - createdDate.getTime();
          
          if (timeDiff < 60000) { // Less than 1 minute = likely new
            change_type = 'added';
            is_newly_added = true;
          } else if (timeDiff > 60000) { // More than 1 minute = likely updated
            change_type = 'updated';
            is_recently_updated = true;
          }
        }

        return {
          rule_id: rule.id,
          title: rule.title,
          description: rule.description,
          created_at: rule.created_at,
          updated_at: rule.updated_at,
          is_newly_added,
          is_recently_updated,
          change_type
        };
      }) || [];

      console.log('useUnacknowledgedRules result:', {
        totalRules: allRules?.length || 0,
        acknowledgedRuleIds: Array.from(acknowledgedRuleIds),
        unacknowledgedRulesCount: unacknowledgedRules.length,
        unacknowledgedRules
      });

      return unacknowledgedRules;
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always check for fresh data
  });
}

export function useHasUnacknowledgedRules() {
  const { data: unacknowledgedRules = [] } = useUnacknowledgedRules();
  return unacknowledgedRules.length > 0;
}
