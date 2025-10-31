import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Calendar, User, FileText, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RuleViolation {
  id: string;
  rule_id: string;
  warning_level: number;
  reason: string | null;
  flagged_by: string;
  flagged_at: string;
  created_at: string;
  user_id: string;
  office_rules: {
    id: string;
    title: string;
    description: string;
  };
  user_profile?: {
    id: string;
    name: string;
    email: string;
  } | null;
  flagged_by_profile?: {
    id: string;
    name: string;
  } | null;
}

export default function Violations() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViolation, setSelectedViolation] = useState<RuleViolation | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'employee' && role !== 'manager' && role !== 'admin') {
      navigate('/today');
      return;
    }

    if (user) {
      fetchViolations();
    }
  }, [user, role, roleLoading, navigate]);

  const fetchViolations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('rule_violations')
        .select(`
          id,
          rule_id,
          warning_level,
          reason,
          flagged_by,
          flagged_at,
          created_at,
          user_id,
          office_rules!inner (
            id,
            title,
            description
          )
        `);

      // For admins, fetch all violations; for others, fetch only their own
      if (role === 'admin') {
        query = query.order('flagged_at', { ascending: false });
      } else {
        query = query.eq('user_id', user.id).order('flagged_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching violations:', error);
        throw error;
      }

      console.log('Fetched violations:', data?.length || 0, 'violations');
      
      // Fetch user profiles and flagged_by profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(v => v.user_id))];
        const flaggedByIds = [...new Set(data.map(v => v.flagged_by))];
        const allUserIds = [...new Set([...userIds, ...flaggedByIds])];
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', allUserIds);
        
        if (profilesError) {
          console.warn('Error fetching profiles:', profilesError);
        }
        
        // Combine violations with profile names
        const violationsWithNames = data.map(violation => ({
          ...violation,
          user_profile: profiles?.find(p => p.id === violation.user_id) || null,
          flagged_by_profile: profiles?.find(p => p.id === violation.flagged_by) || null
        }));
        
        setViolations(violationsWithNames);
      } else {
        setViolations([]);
      }
    } catch (error: any) {
      console.error('Error fetching violations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rule violations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getWarningLevelLabel = (level: number) => {
    switch (level) {
      case 1:
        return 'Warning';
      case 2:
        return 'Serious Warning';
      case 3:
        return 'Final Warning';
      default:
        return 'Unknown';
    }
  };

  const getWarningLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 3:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getWarningLevelIcon = (level: number) => {
    switch (level) {
      case 1:
        return '⚠️';
      case 2:
        return '🚨';
      case 3:
        return '🔴';
      default:
        return '❓';
    }
  };

  const getViolationStats = () => {
    const total = violations.length;
    const byLevel = violations.reduce((acc, violation) => {
      acc[violation.warning_level] = (acc[violation.warning_level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return { total, byLevel };
  };

  const getViolationsByEmployee = () => {
    const grouped = violations.reduce((acc, violation) => {
      const employeeName = violation.user_profile?.name || 'Unknown Employee';
      if (!acc[employeeName]) {
        acc[employeeName] = {
          employee: violation.user_profile,
          violations: []
        };
      }
      acc[employeeName].violations.push(violation);
      return acc;
    }, {} as Record<string, { employee: any; violations: RuleViolation[] }>);

    return Object.entries(grouped).map(([name, data]) => ({
      employeeName: name,
      employee: data.employee,
      violations: data.violations,
      count: data.violations.length
    }));
  };

  const toggleEmployeeExpansion = (employeeName: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeName)) {
      newExpanded.delete(employeeName);
    } else {
      newExpanded.add(employeeName);
    }
    setExpandedEmployees(newExpanded);
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  const stats = getViolationStats();

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {role === 'admin' ? 'Employee Violations' : 'Rule Violations'}
            </h1>
            <p className="text-muted-foreground">
              {role === 'admin' 
                ? 'View and manage rule violations for all employees' 
                : 'Your rule violation history and warnings'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-muted-foreground">
              {role === 'admin' 
                ? `${getViolationsByEmployee().length} employees with violations`
                : `${stats.total} ${stats.total === 1 ? 'violation' : 'violations'}`
              }
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        {stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.total}</div>
                <p className="text-sm text-muted-foreground">Total Violations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.byLevel[1] || 0}</div>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{stats.byLevel[2] || 0}</div>
                <p className="text-sm text-muted-foreground">Serious Warnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.byLevel[3] || 0}</div>
                <p className="text-sm text-muted-foreground">Final Warnings</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          {violations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground text-center">
                  <span className="font-medium text-green-600">
                    {role === 'admin' ? 'No violations found' : 'Great job!'}
                  </span><br />
                  {role === 'admin' 
                    ? 'No rule violations found for any employees.' 
                    : 'You have no rule violations on record.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : role === 'admin' ? (
            // Admin view: Grouped by employee
            getViolationsByEmployee().map(({ employeeName, employee, violations: employeeViolations, count }) => (
              <Card key={employeeName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {employeeName}
                        {employee?.email && (
                          <span className="text-sm text-muted-foreground">({employee.email})</span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {count} {count === 1 ? 'violation' : 'violations'}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleEmployeeExpansion(employeeName)}
                      className="flex items-center gap-2"
                    >
                      {expandedEmployees.has(employeeName) ? 'Collapse' : 'Expand'}
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                        {count}
                      </span>
                    </Button>
                  </div>
                </CardHeader>
                {expandedEmployees.has(employeeName) && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {employeeViolations.map((violation) => (
                        <div
                          key={violation.id}
                          className="p-3 border rounded-lg bg-red-50 border-red-200 cursor-pointer hover:bg-red-100"
                          onClick={() => setSelectedViolation(violation)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getWarningLevelColor(violation.warning_level)}`}>
                                {getWarningLevelIcon(violation.warning_level)} {getWarningLevelLabel(violation.warning_level)}
                              </span>
                              <span className="font-medium text-red-800">
                                {violation.office_rules.title}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(violation.flagged_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          {violation.reason && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Reason:</strong> {violation.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          ) : (
            // Employee view: Individual violations
            violations.map((violation) => (
              <Card
                key={violation.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedViolation(violation)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getWarningLevelIcon(violation.warning_level)}
                        {violation.office_rules.title}
                      </CardTitle>
                      <CardDescription className="space-y-2 mt-2">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(violation.flagged_at).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(violation.flagged_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {violation.reason && (
                          <div className="text-sm text-muted-foreground">
                            <strong>Reason:</strong> {violation.reason}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getWarningLevelColor(violation.warning_level)}`}
                      >
                        {getWarningLevelLabel(violation.warning_level)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Violation Details Dialog */}
        {selectedViolation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getWarningLevelIcon(selectedViolation.warning_level)}
                    {selectedViolation.office_rules.title}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedViolation(null)}
                  >
                    Close
                  </Button>
                </div>
                <CardDescription>
                  Violation details and rule information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Warning Level</span>
                    <p className={`px-2 py-1 rounded-full text-xs font-medium border inline-block mt-1 ${getWarningLevelColor(selectedViolation.warning_level)}`}>
                      {getWarningLevelLabel(selectedViolation.warning_level)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Date & Time</span>
                    <p className="font-medium">
                      {new Date(selectedViolation.flagged_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-muted-foreground">Rule Description</span>
                  <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">
                    {selectedViolation.office_rules.description}
                  </p>
                </div>

                {selectedViolation.reason && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Reason for Violation</span>
                    <p className="text-sm mt-1 p-3 bg-red-50 border border-red-200 rounded-md">
                      {selectedViolation.reason}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Flagged by: {selectedViolation.flagged_by_profile?.name || 'Unknown User'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
