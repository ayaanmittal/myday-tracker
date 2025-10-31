import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, Trash2, Flag, Edit } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Rule {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

const ManageRules = () => {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({ title: "", description: "" });
  const [editRule, setEditRule] = useState({ id: "", title: "", description: "" });
  const [flagData, setFlagData] = useState({
    employeeId: "",
    ruleId: "",
    warningLevel: "1",
    reason: "",
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['office-rules-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('office_rules')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Rule[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Employee[];
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: { title: string; description: string }) => {
      // Try to insert with new columns first, fallback to basic insert
      let error;
      try {
        const result = await supabase
          .from('office_rules')
          .insert({
            ...rule,
            is_newly_added: true,
            is_recently_updated: false
          });
        error = result.error;
      } catch (err) {
        // Fallback to basic insert if new columns don't exist
        const result = await supabase
          .from('office_rules')
          .insert(rule);
        error = result.error;
      }

      if (error) throw error;

      // Manually reset all acknowledgments when new rule is created
      const { error: ackError } = await supabase
        .from('rule_acknowledgments')
        .delete()
        .gte('created_at', '1970-01-01'); // Delete all acknowledgments

      if (ackError) {
        console.warn('Failed to reset acknowledgments:', ackError);
      }

      // Also delete all contracts to force re-signature
      const { error: contractError } = await supabase
        .from('rule_contracts')
        .delete()
        .gte('created_at', '1970-01-01'); // Delete all contracts

      if (contractError) {
        console.warn('Failed to reset contracts:', contractError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-rules-admin'] });
      queryClient.invalidateQueries({ queryKey: ['office-rules'] });
      queryClient.invalidateQueries({ queryKey: ['office-rules-first-time'] });
      queryClient.invalidateQueries({ queryKey: ['rule-contract'] });
      queryClient.invalidateQueries({ queryKey: ['rule-acknowledgments'] });
      setNewRule({ title: "", description: "" });
      setIsAddDialogOpen(false);
      toast({
        title: "Rule Created",
        description: "The new rule has been created and all users will need to re-acknowledge rules.",
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async (rule: { id: string; title: string; description: string }) => {
      console.log('Starting rule update for:', rule);
      console.log('Current user:', user);
      console.log('Current role:', role);
      
      // Test if we can read the rules first
      const { data: testRules, error: testError } = await supabase
        .from('office_rules')
        .select('*')
        .eq('id', rule.id);
      console.log('Test read result:', { testRules, testError });
      
      // Try to update with new columns first, fallback to basic update
      let error;
      try {
        console.log('Attempting update with new columns...');
        const result = await supabase
          .from('office_rules')
          .update({ 
            title: rule.title, 
            description: rule.description,
            updated_at: new Date().toISOString(),
            is_newly_added: false,
            is_recently_updated: true
          })
          .eq('id', rule.id);
        error = result.error;
        console.log('Update result with new columns:', { error, data: result.data });
      } catch (err) {
        console.log('New columns not available, falling back to basic update...', err);
        // Fallback to basic update if new columns don't exist
        const result = await supabase
          .from('office_rules')
          .update({ 
            title: rule.title, 
            description: rule.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', rule.id);
        error = result.error;
        console.log('Update result with basic columns:', { error, data: result.data });
      }

      if (error) {
        console.error('Rule update failed:', error);
        throw error;
      }
      
      console.log('Rule update successful, proceeding to reset acknowledgments...');

      // Manually reset all acknowledgments when rule is updated
      console.log('Resetting all acknowledgments...');
      const { error: ackError, count: ackCount } = await supabase
        .from('rule_acknowledgments')
        .delete()
        .gte('created_at', '1970-01-01'); // Delete all acknowledgments

      if (ackError) {
        console.error('Failed to reset acknowledgments:', ackError);
      } else {
        console.log(`Successfully deleted ${ackCount} acknowledgments`);
      }

      // Also delete all contracts to force re-signature
      console.log('Resetting all contracts...');
      const { error: contractError, count: contractCount } = await supabase
        .from('rule_contracts')
        .delete()
        .gte('created_at', '1970-01-01'); // Delete all contracts

      if (contractError) {
        console.error('Failed to reset contracts:', contractError);
      } else {
        console.log(`Successfully deleted ${contractCount} contracts`);
      }
    },
    onSuccess: () => {
      console.log('Rule update mutation successful');
      queryClient.invalidateQueries({ queryKey: ['office-rules-admin'] });
      queryClient.invalidateQueries({ queryKey: ['office-rules'] });
      queryClient.invalidateQueries({ queryKey: ['office-rules-first-time'] });
      queryClient.invalidateQueries({ queryKey: ['rule-contract'] });
      queryClient.invalidateQueries({ queryKey: ['rule-acknowledgments'] });
      setEditRule({ id: "", title: "", description: "" });
      setIsEditDialogOpen(false);
      toast({
        title: "Rule Updated",
        description: "The rule has been updated and all users will need to re-acknowledge rules.",
      });
    },
    onError: (error: any) => {
      console.error('Rule update mutation failed:', error);
      toast({
        title: "Update Failed",
        description: `Failed to update rule: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('office_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office-rules-admin'] });
      queryClient.invalidateQueries({ queryKey: ['office-rules'] });
      toast({
        title: "Rule Deleted",
        description: "The rule has been deleted successfully.",
      });
    },
  });

  const flagEmployeeMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      rule_id: string;
      warning_level: number;
      reason: string;
      flagged_by: string;
    }) => {
      const { error } = await supabase
        .from('rule_violations')
        .insert(data);

      if (error) throw error;
    },
    onSuccess: () => {
      setFlagData({ employeeId: "", ruleId: "", warningLevel: "1", reason: "" });
      setIsFlagDialogOpen(false);
      toast({
        title: "Employee Flagged",
        description: "The violation has been recorded successfully.",
      });
    },
  });

  const handleEditRule = (rule: Rule) => {
    setEditRule({
      id: rule.id,
      title: rule.title,
      description: rule.description,
    });
    setIsEditDialogOpen(true);
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  if (role !== 'admin') {
    return <Navigate to="/office-rules" />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manage Office Rules</h1>
            <p className="text-muted-foreground">Create rules and flag violations</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isFlagDialogOpen} onOpenChange={setIsFlagDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Flag className="mr-2 h-4 w-4" />
                  Flag Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Flag Employee Violation</DialogTitle>
                  <DialogDescription>
                    Record a rule violation for an employee
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Employee</Label>
                    <Select
                      value={flagData.employeeId}
                      onValueChange={(value) =>
                        setFlagData({ ...flagData, employeeId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} ({emp.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rule Violated</Label>
                    <Select
                      value={flagData.ruleId}
                      onValueChange={(value) =>
                        setFlagData({ ...flagData, ruleId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select rule" />
                      </SelectTrigger>
                      <SelectContent>
                        {rules.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Warning Level</Label>
                    <Select
                      value={flagData.warningLevel}
                      onValueChange={(value) =>
                        setFlagData({ ...flagData, warningLevel: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Warning</SelectItem>
                        <SelectItem value="2">2nd Warning</SelectItem>
                        <SelectItem value="3">3rd Warning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reason (Optional)</Label>
                    <Textarea
                      value={flagData.reason}
                      onChange={(e) =>
                        setFlagData({ ...flagData, reason: e.target.value })
                      }
                      placeholder="Provide details about the violation..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (!flagData.employeeId || !flagData.ruleId) {
                        toast({
                          title: "Error",
                          description: "Please select an employee and rule.",
                          variant: "destructive",
                        });
                        return;
                      }
                      flagEmployeeMutation.mutate({
                        user_id: flagData.employeeId,
                        rule_id: flagData.ruleId,
                        warning_level: parseInt(flagData.warningLevel),
                        reason: flagData.reason,
                        flagged_by: user?.id || "",
                      });
                    }}
                    disabled={flagEmployeeMutation.isPending}
                  >
                    Flag Employee
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Office Rule</DialogTitle>
                  <DialogDescription>
                    Create a new rule for employees to acknowledge
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Rule Title</Label>
                    <Input
                      id="title"
                      value={newRule.title}
                      onChange={(e) =>
                        setNewRule({ ...newRule, title: e.target.value })
                      }
                      placeholder="e.g., Punctuality Policy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Rule Description</Label>
                    <Textarea
                      id="description"
                      value={newRule.description}
                      onChange={(e) =>
                        setNewRule({ ...newRule, description: e.target.value })
                      }
                      placeholder="Describe the rule in detail..."
                      rows={5}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createRuleMutation.mutate(newRule)}
                    disabled={!newRule.title || !newRule.description || createRuleMutation.isPending}
                  >
                    Create Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Office Rule</DialogTitle>
                  <DialogDescription>
                    Update the rule details
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-title">Rule Title</Label>
                    <Input
                      id="edit-title"
                      value={editRule.title}
                      onChange={(e) =>
                        setEditRule({ ...editRule, title: e.target.value })
                      }
                      placeholder="e.g., Punctuality Policy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Rule Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editRule.description}
                      onChange={(e) =>
                        setEditRule({ ...editRule, description: e.target.value })
                      }
                      placeholder="Describe the rule in detail..."
                      rows={5}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => updateRuleMutation.mutate(editRule)}
                    disabled={!editRule.title || !editRule.description || updateRuleMutation.isPending}
                  >
                    Update Rule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No rules created yet. Click "Add Rule" to get started.
              </CardContent>
            </Card>
          ) : (
            rules.map((rule, index) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        Rule {index + 1}: {rule.title}
                      </CardTitle>
                      <CardDescription className="mt-2">{rule.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditRule(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ManageRules;
