import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Users, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { 
  processAttendanceHolidays, 
  getAttendanceSummaryWithHolidays,
  GeneratedRecord,
  UpdatedRecord,
  AttendanceSummary 
} from '@/services/attendanceHolidayService';

export default function AttendanceHolidayManager() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [updatedRecords, setUpdatedRecords] = useState<UpdatedRecord[]>([]);
  const [generatedRecords, setGeneratedRecords] = useState<GeneratedRecord[]>([]);
  const [totalUpdated, setTotalUpdated] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);

  // Set default date range (last 30 days)
  const setDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

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
      const result = await processAttendanceHolidays(startDate, endDate);
      
      if (result.success) {
        setUpdatedRecords(result.updatedRecords);
        setGeneratedRecords(result.generatedRecords);
        setTotalUpdated(result.totalUpdated);
        setTotalGenerated(result.totalGenerated);
        
        toast({
          title: 'Success',
          description: `Processed ${result.totalUpdated} updated records and ${result.totalGenerated} generated records`,
        });
      } else {
        toast({
          title: 'Error',
          description: `Failed to process holidays: ${result.errors.join(', ')}`,
          variant: 'destructive',
        });
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
            <CardDescription>Process attendance records and view summaries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button 
                onClick={processHolidays} 
                disabled={processing || !startDate || !endDate}
                className="flex items-center gap-2"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {processing ? 'Processing...' : 'Process Holidays'}
              </Button>
              <Button 
                onClick={getSummary} 
                variant="outline"
                disabled={!startDate || !endDate}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Get Summary
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
