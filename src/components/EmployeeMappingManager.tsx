import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, CheckCircle, AlertTriangle, XCircle, UserPlus } from 'lucide-react';

interface UnmappedEmployee {
  emp_code: string;
  name: string | null;
  email: string | null;
  department: string | null;
  designation: string | null;
  suggested_matches: Array<{
    user_id: string;
    name: string;
    email: string;
    match_score: number;
  }>;
}

interface MappingResult {
  success: boolean;
  totalProcessed: number;
  autoMapped: number;
  manualReview: number;
  errors: number;
  results: Array<{
    empCode: string;
    teamofficeName: string;
    status: 'auto_mapped' | 'manual_review' | 'no_match' | 'error';
    ourUserId?: string;
    ourUserName?: string;
    matchScore?: number;
    error?: string;
    suggestedMatches?: Array<{
      user_id: string;
      name: string;
      email: string;
      match_score: number;
    }>;
  }>;
}

export function EmployeeMappingManager() {
  const [unmappedEmployees, setUnmappedEmployees] = useState<UnmappedEmployee[]>([]);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load unmapped employees on component mount
  useEffect(() => {
    loadUnmappedEmployees();
  }, []);

  const loadUnmappedEmployees = async () => {
    setIsLoading(true);
    try {
      // This would call your API endpoint
      const response = await fetch(joinApiPath('/api/employees/unmapped'));
      const data = await response.json();
      setUnmappedEmployees(data);
    } catch (error) {
      console.error('Error loading unmapped employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runBulkMapping = async (config: {
    minMatchScore: number;
    autoMapThreshold: number;
    createMissingUsers: boolean;
  }) => {
    setIsProcessing(true);
    try {
      const response = await fetch(joinApiPath('/api/employees/bulk-mapping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const result = await response.json();
      setMappingResult(result);
      await loadUnmappedEmployees(); // Refresh the list
    } catch (error) {
      console.error('Error running bulk mapping:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const approveMapping = async (empCode: string, userId: string) => {
    try {
      const response = await fetch(joinApiPath('/api/employees/approve-mapping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empCode, userId })
      });
      
      if (response.ok) {
        await loadUnmappedEmployees(); // Refresh the list
      }
    } catch (error) {
      console.error('Error approving mapping:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'auto_mapped':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'manual_review':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'no_match':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_mapped':
        return <Badge variant="default" className="bg-green-100 text-green-800">Auto-mapped</Badge>;
      case 'manual_review':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Manual Review</Badge>;
      case 'no_match':
        return <Badge variant="outline" className="text-red-600">No Match</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employee Mapping Manager</CardTitle>
          <CardDescription>
            Map TeamOffice employees to your users for attendance tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Mapping Actions */}
          <div className="flex gap-4">
            <Button
              onClick={() => runBulkMapping({
                minMatchScore: 0.3,
                autoMapThreshold: 0.9,
                createMissingUsers: false
              })}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Conservative Mapping
            </Button>
            
            <Button
              onClick={() => runBulkMapping({
                minMatchScore: 0.3,
                autoMapThreshold: 0.8,
                createMissingUsers: true
              })}
              disabled={isProcessing}
              variant="outline"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Aggressive Mapping
            </Button>
          </div>

          {/* Mapping Results */}
          {mappingResult && (
            <Alert>
              <AlertDescription>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm font-medium">Total Processed</div>
                    <div className="text-2xl font-bold">{mappingResult.totalProcessed}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Auto-mapped</div>
                    <div className="text-2xl font-bold text-green-600">{mappingResult.autoMapped}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Manual Review</div>
                    <div className="text-2xl font-bold text-yellow-600">{mappingResult.manualReview}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Errors</div>
                    <div className="text-2xl font-bold text-red-600">{mappingResult.errors}</div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Unmapped Employees List */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Unmapped Employees ({unmappedEmployees.length})
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading employees...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {unmappedEmployees.map((emp) => (
                  <Card key={emp.emp_code}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{emp.name || 'Unknown'}</h4>
                          <p className="text-sm text-gray-600">
                            Code: {emp.emp_code} | 
                            {emp.email && ` Email: ${emp.email}`} |
                            {emp.department && ` Dept: ${emp.department}`}
                          </p>
                          
                          {emp.suggested_matches.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium mb-2">Suggested Matches:</p>
                              <div className="space-y-2">
                                {emp.suggested_matches.map((match) => (
                                  <div key={match.user_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div>
                                      <span className="font-medium">{match.name}</span>
                                      <span className="text-sm text-gray-600 ml-2">({match.email})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">
                                        {(match.match_score * 100).toFixed(1)}%
                                      </Badge>
                                      <Button
                                        size="sm"
                                        onClick={() => approveMapping(emp.emp_code, match.user_id)}
                                      >
                                        Approve
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {unmappedEmployees.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>All employees are mapped! 🎉</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






