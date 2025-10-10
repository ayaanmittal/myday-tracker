import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnacknowledgedRules } from "@/hooks/useUnacknowledgedRules";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, FileText, Clock } from "lucide-react";

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

export function UpdatedRulesDialog() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [initials, setInitials] = useState("");
  const [allAcknowledged, setAllAcknowledged] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: unacknowledgedRules = [], isLoading } = useUnacknowledgedRules();

  // Show dialog when user is logged in, is employee/manager, and there are unacknowledged rules
  useEffect(() => {
    console.log('UpdatedRulesDialog useEffect:', {
      user: !!user,
      role,
      isLoading,
      unacknowledgedRulesCount: unacknowledgedRules.length,
      unacknowledgedRules
    });
    
    if (user && (role === 'employee' || role === 'manager') && !isLoading && unacknowledgedRules.length > 0) {
      console.log('Opening UpdatedRulesDialog');
      setIsOpen(true);
    }
  }, [user, role, unacknowledgedRules, isLoading]);

  const acknowledgeRulesMutation = useMutation({
    mutationFn: async (userInitials: string) => {
      if (!user?.id) throw new Error("No user");

      // Delete existing contract first, then create new one
      const { error: deleteError } = await supabase
        .from('rule_contracts')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.warn('Failed to delete existing contract:', deleteError);
        // Continue anyway, the insert might still work
      }

      // Create new contract
      const { error: contractError } = await supabase
        .from('rule_contracts')
        .insert({
          user_id: user.id,
          initials: userInitials.trim().toUpperCase(),
          signed_at: new Date().toISOString(),
        });

      if (contractError) throw contractError;

    // Acknowledge all unacknowledged rules (update if exists, insert if not)
    const acknowledgments = unacknowledgedRules.map(rule => ({
      user_id: user.id,
      rule_id: rule.rule_id,
      acknowledged_at: new Date().toISOString(),
    }));

    const { error: ackError } = await supabase
      .from('rule_acknowledgments')
      .upsert(acknowledgments, { 
        onConflict: 'user_id,rule_id',
        ignoreDuplicates: false 
      });

      if (ackError) throw ackError;

      // Try to clear the flags after acknowledgment (if columns exist)
      try {
        const ruleIds = unacknowledgedRules.map(rule => rule.rule_id);
        const { error: clearError } = await supabase
          .from('office_rules')
          .update({ 
            is_newly_added: false, 
            is_recently_updated: false 
          } as any) // Type assertion to handle missing columns
          .in('id', ruleIds);

        if (clearError) {
          console.warn('Failed to clear rule flags (columns may not exist yet):', clearError);
        }
      } catch (error) {
        console.warn('Rule flag clearing not available yet:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-contract'] });
      queryClient.invalidateQueries({ queryKey: ['rule-acknowledgments'] });
      queryClient.invalidateQueries({ queryKey: ['unacknowledged-rules'] });
      queryClient.invalidateQueries({ queryKey: ['has-unacknowledged-rules'] });
      setIsOpen(false);
      toast({
        title: "Rules Acknowledged",
        description: "You have successfully acknowledged all updated office rules.",
      });
    },
    onError: (error: any) => {
      console.error('Rules acknowledgment error:', error);
      toast({
        title: "Error",
        description: `Failed to acknowledge rules: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!initials.trim()) {
      toast({
        title: "Initials Required",
        description: "Please enter your initials to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!allAcknowledged) {
      toast({
        title: "Acknowledgment Required",
        description: "Please confirm you have read all updated rules.",
        variant: "destructive",
      });
      return;
    }

    acknowledgeRulesMutation.mutate(initials);
  };

  const isNewRule = (rule: UnacknowledgedRule) => {
    return rule.is_newly_added || rule.change_type === 'added';
  };

  const isUpdatedRule = (rule: UnacknowledgedRule) => {
    return rule.is_recently_updated || rule.change_type === 'updated';
  };

  const hasUpdatedRules = unacknowledgedRules.some(isUpdatedRule);
  const hasNewRules = unacknowledgedRules.some(isNewRule);
  const hasAnyChanges = hasUpdatedRules || hasNewRules;

  if (!user || roleLoading || isLoading || unacknowledgedRules.length === 0 || (role !== 'employee' && role !== 'manager')) {
    return null;
  }

  return (
    <Dialog open={isOpen} modal onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  Rules have been updated
                </DialogTitle>
          <DialogDescription>
            {hasAnyChanges 
              ? "New office rules have been added or existing rules have been updated. Please review and acknowledge all changes before continuing."
              : "Please review and acknowledge the office rules before continuing."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Summary of changes */}
          <div className="flex gap-4 text-sm flex-shrink-0">
            {hasNewRules && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  <FileText className="h-3 w-3 mr-1" />
                  {unacknowledgedRules.filter(isNewRule).length} New
                </Badge>
              </div>
            )}
            {hasUpdatedRules && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  <Clock className="h-3 w-3 mr-1" />
                  {unacknowledgedRules.filter(isUpdatedRule).length} Updated
                </Badge>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {unacknowledgedRules.map((rule, index) => (
                <Card key={rule.rule_id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        Rule {index + 1}: {rule.title}
                      </CardTitle>
                      <div className="flex gap-2">
                        {isNewRule(rule) && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            ✨ New
                          </Badge>
                        )}
                        {isUpdatedRule(rule) && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                            🔄 Updated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {rule.description}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {isNewRule(rule) ? '✨ Added' : isUpdatedRule(rule) ? '🔄 Updated' : 'Created'}: {new Date(rule.updated_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <Separator className="flex-shrink-0" />

          <div className="space-y-4 flex-shrink-0">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="acknowledge-updated"
                checked={allAcknowledged}
                onChange={(e) => setAllAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="acknowledge-updated" className="text-sm font-medium">
                I have read and understood all the updated office rules listed above and agree to comply with them.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initials-updated">
                Your Initials <span className="text-destructive">*</span>
              </Label>
              <Input
                id="initials-updated"
                placeholder="e.g., JD"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                maxLength={5}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                By entering your initials, you electronically sign this updated agreement
              </p>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              onClick={handleSubmit}
              disabled={!initials.trim() || !allAcknowledged || acknowledgeRulesMutation.isPending}
              className="w-full"
            >
              {acknowledgeRulesMutation.isPending ? "Acknowledging..." : "Acknowledge Updated Rules & Continue"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
