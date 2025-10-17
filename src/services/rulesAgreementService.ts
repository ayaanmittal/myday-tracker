import { supabase } from '@/integrations/supabase/client';

export interface RulesAgreementData {
  hasSignedContract: boolean;
  contractSignedAt: string | null;
  contractInitials: string | null;
  acknowledgedRulesCount: number;
  totalActiveRulesCount: number;
  unacknowledgedRules: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  lastAcknowledgmentAt: string | null;
}

export class RulesAgreementService {
  /**
   * Get rules agreement data for a specific user
   */
  static async getRulesAgreementData(userId: string): Promise<RulesAgreementData> {
    try {
      // Get contract data
      const { data: contractData } = await supabase
        .from('rule_contracts')
        .select('signed_at, initials')
        .eq('user_id', userId)
        .single();

      // Get active rules count
      const { count: totalActiveRulesCount } = await supabase
        .from('office_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get acknowledged rules for this user
      const { data: acknowledgedRules } = await supabase
        .from('rule_acknowledgments')
        .select(`
          acknowledged_at,
          office_rules!inner(
            id,
            title,
            description
          )
        `)
        .eq('user_id', userId);

      // Get all active rules to find unacknowledged ones
      const { data: allActiveRules } = await supabase
        .from('office_rules')
        .select('id, title, description')
        .eq('is_active', true);

      const acknowledgedRuleIds = new Set(acknowledgedRules?.map(ar => ar.office_rules.id) || []);
      const unacknowledgedRules = allActiveRules?.filter(rule => !acknowledgedRuleIds.has(rule.id)) || [];

      // Find the most recent acknowledgment
      const lastAcknowledgmentAt = acknowledgedRules?.length 
        ? acknowledgedRules.reduce((latest, current) => 
            new Date(current.acknowledged_at) > new Date(latest.acknowledged_at) 
              ? current 
              : latest
          ).acknowledged_at
        : null;

      return {
        hasSignedContract: !!contractData,
        contractSignedAt: contractData?.signed_at || null,
        contractInitials: contractData?.initials || null,
        acknowledgedRulesCount: acknowledgedRules?.length || 0,
        totalActiveRulesCount: totalActiveRulesCount || 0,
        unacknowledgedRules,
        lastAcknowledgmentAt
      };
    } catch (error) {
      console.error('Error fetching rules agreement data:', error);
      return {
        hasSignedContract: false,
        contractSignedAt: null,
        contractInitials: null,
        acknowledgedRulesCount: 0,
        totalActiveRulesCount: 0,
        unacknowledgedRules: [],
        lastAcknowledgmentAt: null
      };
    }
  }

  /**
   * Get rules agreement data for multiple users (for admin view)
   */
  static async getBulkRulesAgreementData(userIds: string[]): Promise<Record<string, RulesAgreementData>> {
    try {
      const results: Record<string, RulesAgreementData> = {};
      
      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchPromises = batch.map(userId => 
          this.getRulesAgreementData(userId).then(data => ({ userId, data }))
        );
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ userId, data }) => {
          results[userId] = data;
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching bulk rules agreement data:', error);
      return {};
    }
  }

  /**
   * Check if user has completed all required agreements
   */
  static isFullyCompliant(agreementData: RulesAgreementData): boolean {
    return agreementData.hasSignedContract && 
           agreementData.acknowledgedRulesCount === agreementData.totalActiveRulesCount;
  }

  /**
   * Get compliance status for display
   */
  static getComplianceStatus(agreementData: RulesAgreementData): {
    status: 'compliant' | 'partial' | 'non-compliant';
    message: string;
    color: string;
  } {
    if (this.isFullyCompliant(agreementData)) {
      return {
        status: 'compliant',
        message: 'Fully compliant',
        color: 'text-green-600'
      };
    }

    if (agreementData.hasSignedContract && agreementData.acknowledgedRulesCount > 0) {
      return {
        status: 'partial',
        message: `Partially compliant (${agreementData.acknowledgedRulesCount}/${agreementData.totalActiveRulesCount} rules)`,
        color: 'text-yellow-600'
      };
    }

    return {
      status: 'non-compliant',
      message: 'Not compliant',
      color: 'text-red-600'
    };
  }
}

