import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Rule {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
}

interface Acknowledgment {
  rule_id: string;
  acknowledged_at: string;
}

interface Violation {
  id: string;
  rule_id: string;
  warning_level: number;
  reason: string | null;
  flagged_at: string;
  office_rules: {
    title: string;
  };
}

const OfficeRules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['office-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_rules')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Rule[];
    },
  });

  const { data: acknowledgments = [] } = useQuery({
    queryKey: ['rule-acknowledgments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('rule_acknowledgments')
        .select('rule_id, acknowledged_at')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as Acknowledgment[];
    },
    enabled: !!user?.id,
  });

  const { data: violations = [] } = useQuery({
    queryKey: ['rule-violations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('rule_violations')
        .select('id, rule_id, warning_level, reason, flagged_at, office_rules(title)')
        .eq('user_id', user.id)
        .order('flagged_at', { ascending: false });

      if (error) throw error;
      return data as Violation[];
    },
    enabled: !!user?.id,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('rule_acknowledgments')
        .insert({ user_id: user?.id, rule_id: ruleId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-acknowledgments'] });
      toast({
        title: "Rule Acknowledged",
        description: "You have successfully acknowledged this rule.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to acknowledge rule.",
        variant: "destructive",
      });
    },
  });

  const isAcknowledged = (ruleId: string) => {
    return acknowledgments.some(ack => ack.rule_id === ruleId);
  };

  const getViolationsForRule = (ruleId: string) => {
    return violations.filter(v => v.rule_id === ruleId);
  };

  const getWarningColor = (level: number) => {
    if (level === 1) return "bg-yellow-500";
    if (level === 2) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Office Rules</h1>
          <p className="text-muted-foreground">Review and acknowledge our office policies</p>
        </div>

        {violations.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Your Violations
              </CardTitle>
              <CardDescription>You have been flagged for the following violations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {violations.map((violation) => (
                  <div key={violation.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{violation.office_rules.title}</p>
                        <Badge className={getWarningColor(violation.warning_level)}>
                          {violation.warning_level === 1 ? "1st Warning" : 
                           violation.warning_level === 2 ? "2nd Warning" : "3rd Warning"}
                        </Badge>
                      </div>
                      {violation.reason && (
                        <p className="text-sm text-muted-foreground">{violation.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Flagged on {format(new Date(violation.flagged_at), "PPP")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {rulesLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading rules...
              </CardContent>
            </Card>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No office rules have been set yet.
              </CardContent>
            </Card>
          ) : (
            rules.map((rule, index) => {
              const acknowledged = isAcknowledged(rule.id);
              const ruleViolations = getViolationsForRule(rule.id);

              return (
                <Card key={rule.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Rule {index + 1}: {rule.title}
                          {acknowledged && (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          )}
                        </CardTitle>
                        {ruleViolations.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {ruleViolations.map((v) => (
                              <Badge key={v.id} variant="destructive" className={getWarningColor(v.warning_level)}>
                                Warning {v.warning_level}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => acknowledgeMutation.mutate(rule.id)}
                        disabled={acknowledged || acknowledgeMutation.isPending}
                        variant={acknowledged ? "outline" : "default"}
                      >
                        {acknowledged ? "Acknowledged" : "I Agree"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{rule.description}</p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
};

export default OfficeRules;
