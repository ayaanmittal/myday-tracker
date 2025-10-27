import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { 
  processAttendanceHolidays, 
  getAttendanceSummaryWithHolidays,
  GeneratedRecord,
  UpdatedRecord,
  AttendanceSummary 
} from '@/services/attendanceHolidayService';
import { supabase } from '@/integrations/supabase/client';
import { markUsersHolidayRange, markOfficeHolidayRange } from '@/services/attendanceHolidayService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AttendanceHolidayManager() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [employees, setEmployees] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [updatedRecords, setUpdatedRecords] = useState<UpdatedRecord[]>([]);
  const [generatedRecords, setGeneratedRecords] = useState<GeneratedRecord[]>([]);
  const [totalUpdated, setTotalUpdated] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [approvedLeaves, setApprovedLeaves] = useState<{ user_id: string; start_date: string; end_date: string; approved_by: string | null; reason: string | null; processed: boolean; user_name?: string; user_email?: string; approver_name?: string }[]>([]);
  const [selectedApproved, setSelectedApproved] = useState<{ user_id: string; start_date: string; end_date: string }[]>([]);
  const [selectAllEmployees, setSelectAllEmployees] = useState(false);
  const [companyHolidays, setCompanyHolidays] = useState<{ id: string; holiday_date: string; title: string; created_at: string; created_by: string }[]>([]);

  // Calculate day count for selected date range
  const getDayCount = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    return diffDays;
  };

  // Set default date range (last 30 days)
  const setDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  // Load employees for selection
  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name');
    if (!error) setEmployees(data || []);
  };

  if (employees.length === 0) {
    void loadEmployees();
  }

  const processHolidays = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Please select both start and end dates',
        variant: 'destructive',
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: 'Error',
        description: 'Start date must be before end date',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    setSummary(null);
    setUpdatedRecords([]);
    setGeneratedRecords([]);
    setTotalUpdated(0);
    setTotalGenerated(0);

    try {
      // Use bulk RPC to upsert unified_attendance for ALL active employees
      const res = await markUsersHolidayRange(startDate, endDate, []);
      if (res.success) {
        toast({
          title: 'Holidays processed',
          description: `Inserted ${res.inserted}, Updated ${res.updated}`,
        });
      } else {
        toast({ title: 'Error', description: res.errors.join(', '), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error processing holidays:', error);
      toast({
        title: 'Error',
        description: 'Failed to process holidays',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const markBulkLeave = async () => {
    if (!startDate || !endDate || selectedEmployees.length === 0) {
      toast({ title: 'Error', description: 'Select dates and at least one employee', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const res = await markUsersHolidayRange(startDate, endDate, selectedEmployees);
      if (res.success) {
        toast({ title: 'Leave processed', description: `Inserted ${res.inserted}, Updated ${res.updated}` });
      } else {
        toast({ title: 'Error', description: res.errors.join(', '), variant: 'destructive' });
      }
    } finally {
      setProcessing(false);
    }
  };

  const getSummary = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Please select both start and end dates',
        variant: 'destructive',
      });
      return;
    }

    try {
      // For now, get summary for all users (you might want to add user selection)
      const result = await getAttendanceSummaryWithHolidays('', startDate, endDate);
      
      if (result.success && result.summary) {
        setSummary(result.summary);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to get attendance summary',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error getting summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to get attendance summary',
        variant: 'destructive',
      });
    }
  };

  const loadApprovedLeaves = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    // Fetch future approved leave requests including processed status
    const { data, error } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date, approved_by, reason, processed')
      .eq('status', 'approved')
      .gte('end_date', todayStr)
      .order('start_date');
    if (error) return;
    const rows = data || [];
    const userIds = Array.from(new Set(rows.map(r => r.user_id)));
    const approverIds = Array.from(new Set(rows.map(r => r.approved_by).filter(Boolean) as string[]));
    let profiles: any[] | null = [];
    let approvers: any[] | null = [];
    if (userIds.length > 0) {
      const res1 = await supabase.from('profiles').select('id, name, email').in('id', userIds);
      profiles = res1.data as any[] | null;
    }
    if (approverIds.length > 0) {
      const res2 = await supabase.from('profiles').select('id, name').in('id', approverIds);
      approvers = res2.data as any[] | null;
    }
    const withDetails = rows.map(r => {
      const p = profiles?.find(pr => pr.id === r.user_id);
      const a = approvers?.find(ap => ap.id === r.approved_by);
      return {
        ...r,
        user_name: p?.name,
        user_email: p?.email,
        approver_name: a?.name || null,
      };
    });
    setApprovedLeaves(withDetails);
  };

  const loadCompanyHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .order('holiday_date', { ascending: false })
        .limit(50); // Show last 50 holidays

      if (error) {
        console.error('Error loading company holidays:', error);
        return;
      }

      setCompanyHolidays(data || []);
    } catch (error) {
      console.error('Error loading company holidays:', error);
    }
  };

  useEffect(() => {
    void loadApprovedLeaves();
    void loadCompanyHolidays();
  }, []);

  const toggleApprovedSelection = (row: { user_id: string; start_date: string; end_date: string; processed: boolean }) => {
    // Don't allow selection of processed leaves
    if (row.processed) {
      return;
    }
    
    setSelectedApproved(prev => {
      const key = `${row.user_id}-${row.start_date}-${row.end_date}`;
      const exists = prev.some(r => `${r.user_id}-${r.start_date}-${r.end_date}` === key);
      if (exists) {
        return prev.filter(r => `${r.user_id}-${r.start_date}-${r.end_date}` !== key);
      }
      return [...prev, row];
    });
  };

  const applySelectedApprovedLeaves = async () => {
    if (selectedApproved.length === 0) return;
    setProcessing(true);
    try {
      const results = await Promise.all(selectedApproved.map(async (r) => {
        const res = await markUsersHolidayRange(r.start_date, r.end_date, [r.user_id]);
        return res;
      }));
      const inserted = results.reduce((sum, r) => sum + (r.success ? (r.inserted || 0) : 0), 0);
      const updated = results.reduce((sum, r) => sum + (r.success ? (r.updated || 0) : 0), 0);
      const failed = results.filter(r => !r.success).length;
      
      // Mark successfully processed leaves as processed
      if (inserted > 0 || updated > 0) {
        const userIds = selectedApproved.map(r => r.user_id);
        const startDates = selectedApproved.map(r => r.start_date);
        const endDates = selectedApproved.map(r => r.end_date);
        
        // Mark each leave request as processed
        for (let i = 0; i < selectedApproved.length; i++) {
          const { error } = await supabase
            .from('leave_requests')
            .update({ processed: true })
            .eq('user_id', selectedApproved[i].user_id)
            .eq('start_date', selectedApproved[i].start_date)
            .eq('end_date', selectedApproved[i].end_date)
            .eq('status', 'approved');
          
          if (error) {
            console.error('Error marking leave as processed:', error);
          }
        }
      }
      
      toast({ title: 'Processed approved leaves', description: `Updated ${updated}, Inserted ${inserted}${failed ? `, Failed ${failed}` : ''}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to apply approved leaves', variant: 'destructive' });
    } finally {
      setProcessing(false);
      setSelectedApproved([]);
      void loadApprovedLeaves();
    }
  };

  const handleSelectAllEmployees = (checked: boolean) => {
    setSelectAllEmployees(checked);
    if (checked) {
      setSelectedEmployees(employees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const markAsOfficeHoliday = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Please select both start and end dates',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      // Mark all employees as office holiday for the selected date range
      const res = await markOfficeHolidayRange(startDate, endDate, null, holidayName || undefined);
      if (res.success) {
        toast({
          title: 'Office Holiday Applied',
          description: `Marked ${res.inserted + res.updated} days as office holiday for all employees${holidayName ? ` (${holidayName})` : ''}`,
        });
        // Refresh company holidays list
        void loadCompanyHolidays();
      } else {
        toast({ title: 'Error', description: res.errors.join(', '), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error marking office holiday:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark as office holiday',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Attendance Holiday Manager
            </h1>
            <p className="text-muted-foreground">
              Manage holiday vs absent days based on employee work schedules
            </p>
          </div>
        </div>

        {/* Date Range Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Date Range</CardTitle>
            <CardDescription>Select the date range to process attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holidayName">Holiday Name (Optional)</Label>
                <Input
                  id="holidayName"
                  type="text"
                  placeholder="e.g., Diwali, Christmas, New Year"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Quick Actions</Label>
                <Button 
                  variant="outline" 
                  onClick={setDefaultDateRange}
                  className="w-full"
                >
                  Last 30 Days
                </Button>
              </div>
            </div>
            {startDate && endDate && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-700">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    Selected Range: {getDayCount()} day{getDayCount() !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  From {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Employees</CardTitle>
            <CardDescription>Choose employees to mark as on leave for the selected range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={selectAllEmployees}
                  onChange={(e) => handleSelectAllEmployees(e.target.checked)}
                />
                <span>Select All Employees</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
              {employees.map(emp => {
                const checked = selectedEmployees.includes(emp.id);
                return (
                  <label key={emp.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedEmployees(prev => e.target.checked
                          ? [...prev, emp.id]
                          : prev.filter(id => id !== emp.id)
                        );
                        // Update select all state
                        if (e.target.checked) {
                          if (selectedEmployees.length + 1 === employees.length) {
                            setSelectAllEmployees(true);
                          }
                        } else {
                          setSelectAllEmployees(false);
                        }
                      }}
                    />
                    <span>{emp.name || emp.email}</span>
                  </label>
                );
              })}
            </div>
            {employees.length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Selected: {selectedEmployees.length} / {employees.length}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
            <CardDescription>Process attendance records and view summaries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Button 
                onClick={getSummary} 
                variant="outline"
                disabled={!startDate || !endDate}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Get Summary
              </Button>
              <Button
                onClick={markBulkLeave}
                disabled={processing || !startDate || !endDate || selectedEmployees.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Mark Selected Employees Leave (Not Absent)
              </Button>
              <Button
                onClick={markAsOfficeHoliday}
                disabled={processing || !startDate || !endDate}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Calendar className="h-4 w-4" />
                Mark as Office Holiday
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Attendance Summary
              </CardTitle>
              <CardDescription>Breakdown of attendance records for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{summary.total_days}</div>
                  <div className="text-sm text-muted-foreground">Total Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{summary.present_days}</div>
                  <div className="text-sm text-muted-foreground">Present Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.absent_days}</div>
                  <div className="text-sm text-muted-foreground">Absent Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{summary.holiday_days}</div>
                  <div className="text-sm text-muted-foreground">Holiday Days</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-purple-600">{summary.work_days}</div>
                  <div className="text-sm text-muted-foreground">Work Days</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-yellow-600">{summary.in_progress_days}</div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approved Leaves (future) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Approved Leaves (Upcoming)</CardTitle>
            <CardDescription>All approved future leaves across employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Button
                onClick={applySelectedApprovedLeaves}
                disabled={processing || selectedApproved.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Process Leave
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No upcoming approved leaves
                    </TableCell>
                  </TableRow>
                ) : (
                  approvedLeaves.map((row, idx) => (
                    <TableRow key={`${row.user_id}-${row.start_date}-${row.end_date}-${idx}`}>
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedApproved.some(r => r.user_id === row.user_id && r.start_date === row.start_date && r.end_date === row.end_date)}
                          onChange={() => toggleApprovedSelection({ user_id: row.user_id, start_date: row.start_date, end_date: row.end_date, processed: row.processed })}
                          disabled={row.processed}
                          className={row.processed ? 'opacity-50 cursor-not-allowed' : ''}
                        />
                      </TableCell>
                      <TableCell>{row.user_name || row.user_id}</TableCell>
                      <TableCell className="text-muted-foreground">{row.user_email || '-'}</TableCell>
                      <TableCell>{new Date(row.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(row.end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{row.approver_name || row.approved_by || '-'}</TableCell>
                      <TableCell>
                        {row.processed ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Processed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate" title={row.reason || ''}>{row.reason || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Company Holidays Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              Company Holidays
            </CardTitle>
            <CardDescription>List of all company holidays in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {companyHolidays.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No company holidays found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyHolidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium">
                          {new Date(holiday.holiday_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{holiday.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(holiday.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {(totalUpdated > 0 || totalGenerated > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Processing Results
              </CardTitle>
              <CardDescription>Records updated and generated during processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Updated Records ({totalUpdated})</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Records changed from 'absent' to 'holiday' because they were not work days
                  </p>
                  {updatedRecords.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {updatedRecords.slice(0, 10).map((record, index) => (
                        <div key={index} className="text-xs bg-gray-100 p-2 rounded">
                          {record.entry_date}: {record.old_status} → {record.new_status}
                        </div>
                      ))}
                      {updatedRecords.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {updatedRecords.length - 10} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Generated Records ({totalGenerated})</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    New records created for missing attendance days
                  </p>
                  {generatedRecords.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {generatedRecords.slice(0, 10).map((record, index) => (
                        <div key={index} className="text-xs bg-gray-100 p-2 rounded">
                          {record.entry_date}: {record.status}
                        </div>
                      ))}
                      {generatedRecords.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {generatedRecords.length - 10} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
