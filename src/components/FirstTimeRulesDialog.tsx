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
import { useAuth } from "@/hooks/useAuth";
import { useRuleContract } from "@/hooks/useRuleContract";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

interface Rule {
  id: string;
  title: string;
  description: string;
}

export function FirstTimeRulesDialog() {
  const { user } = useAuth();
  const { data: contract, isLoading } = useRuleContract();
  const queryClient = useQueryClient();
  const [initials, setInitials] = useState("");
  const [allAcknowledged, setAllAcknowledged] = useState(false);

  const { data: rules = [] } = useQuery({
    queryKey: ['office-rules-first-time'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_rules')
        .select('id, title, description')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Rule[];
    },
  });

  const signContractMutation = useMutation({
    mutationFn: async (userInitials: string) => {
      if (!user?.id) throw new Error("No user");

      // Create contract
      const { error: contractError } = await supabase
        .from('rule_contracts')
        .insert({
          user_id: user.id,
          initials: userInitials.trim().toUpperCase(),
        });

      if (contractError) throw contractError;

      // Acknowledge all rules
      const acknowledgments = rules.map(rule => ({
        user_id: user.id,
        rule_id: rule.id,
      }));

      const { error: ackError } = await supabase
        .from('rule_acknowledgments')
        .insert(acknowledgments);

      if (ackError) throw ackError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-contract'] });
      queryClient.invalidateQueries({ queryKey: ['rule-acknowledgments'] });
      toast({
        title: "Contract Signed",
        description: "You have successfully acknowledged all office rules.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign contract. Please try again.",
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
        description: "Please confirm you have read all rules.",
        variant: "destructive",
      });
      return;
    }

    signContractMutation.mutate(initials);
  };

  // Show dialog only if contract doesn't exist and not loading
  const showDialog = !isLoading && !contract && rules.length > 0;

  return (
    <Dialog open={showDialog} modal>
      <DialogContent className="max-w-3xl max-h-[90vh]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <AlertCircle className="h-6 w-6 text-primary" />
            Welcome! Please Review Office Rules
          </DialogTitle>
          <DialogDescription>
            Before you begin, you must read and acknowledge all office rules. This is a one-time requirement.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {rules.map((rule, index) => (
              <Card key={rule.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Rule {index + 1}: {rule.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {rule.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="acknowledge"
              checked={allAcknowledged}
              onChange={(e) => setAllAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="acknowledge" className="text-sm font-medium">
              I have read and understood all the office rules listed above and agree to comply with them.
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initials">
              Your Initials <span className="text-destructive">*</span>
            </Label>
            <Input
              id="initials"
              placeholder="e.g., JD"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              maxLength={5}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              By entering your initials, you electronically sign this agreement
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!initials.trim() || !allAcknowledged || signContractMutation.isPending}
            className="w-full"
          >
            {signContractMutation.isPending ? "Signing..." : "Sign Contract & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
