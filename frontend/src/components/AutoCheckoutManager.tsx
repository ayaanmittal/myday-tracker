import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AutoCheckoutService } from '@/services/autoCheckoutService';
import { Clock, CheckCircle, AlertCircle, Calendar, Users, RefreshCw, CheckSquare } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  user_id: string;
  employee_name: string;
  employee_code: string;
  entry_date: string;
  check_in_at: string;
  check_out_at: string | null;
  status: string;
  total_work_time_minutes: number;
}

export function AutoCheckoutManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'today' | 'date' | 'range'>('today');
  const [recordCount, setRecordCount] = useState(0);

  // Load records on component mount
  useEffect(() => {
    loadTodayRecords();
  }, []);

  const loadTodayRecords = async () => {
    try {
      const result = await AutoCheckoutService.getAffectedRecordsForToday();
      setRecords(result.records);
      setRecordCount(result.count);
      setViewMode('today');
    } catch (error) {
      console.error('Error loading today\'s records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load today\'s records',
        variant: 'destructive',
      });
    }
  };

  const loadDateRecords = async () => {
    try {
      const result = await AutoCheckoutService.getAffectedRecordsForDate(selectedDate);
      setRecords(result.records);
      setRecordCount(result.count);
      setViewMode('date');
    } catch (error) {
      console.error('Error loading date records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load records for selected date',
        variant: 'destructive',
      });
    }
  };

  const loadRangeRecords = async () => {
    try {
      const result = await AutoCheckoutService.getAffectedRecordsForDateRange(startDate, endDate);
      setRecords(result.records);
      setRecordCount(result.count);
      setViewMode('range');
    } catch (error) {
      console.error('Error loading range records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load records for date range',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(record => record.id)));
    }
  };

  const handleSelectRecord = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const handleIndividualCheckout = async (recordId: string) => {
    setLoading(true);
    try {
      console.log('Applying individual checkout for record:', recordId);
      const result = await AutoCheckoutService.runForIndividualRecord(recordId);
      
      console.log('Individual checkout result:', result);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload records
        if (viewMode === 'today') await loadTodayRecords();
        else if (viewMode === 'date') await loadDateRecords();
        else if (viewMode === 'range') await loadRangeRecords();
      } else {
        console.error('Individual checkout failed:', result);
        toast({
          title: 'Error',
          description: result.message || 'Failed to apply auto checkout',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Individual checkout error:', error);
      toast({
        title: 'Error',
        description: `Failed to apply auto checkout: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCheckout = async () => {
    if (selectedRecords.size === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select records to checkout',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Get unique dates from selected records
      const selectedDates = Array.from(selectedRecords)
        .map(id => records.find(r => r.id === id)?.entry_date)
        .filter((date, index, arr) => date && arr.indexOf(date) === index);

      let successCount = 0;
      for (const date of selectedDates) {
        if (date) {
          const result = await AutoCheckoutService.runForDate(date);
          if (result.success) successCount++;
        }
      }

      toast({
        title: 'Success',
        description: `Auto checkout applied for ${successCount} date(s)`,
      });

      // Reload records
      if (viewMode === 'today') await loadTodayRecords();
      else if (viewMode === 'date') await loadDateRecords();
      else if (viewMode === 'range') await loadRangeRecords();

      setSelectedRecords(new Set());
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply bulk auto checkout',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunAllForCurrentView = async () => {
    setLoading(true);
    try {
      let result;
      if (viewMode === 'today') {
        result = await AutoCheckoutService.runForToday();
      } else if (viewMode === 'date') {
        result = await AutoCheckoutService.runForDate(selectedDate);
      } else if (viewMode === 'range') {
        result = await AutoCheckoutService.runForDateRange(startDate, endDate);
      }

      if (result?.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload records
        if (viewMode === 'today') await loadTodayRecords();
        else if (viewMode === 'date') await loadDateRecords();
        else if (viewMode === 'range') await loadRangeRecords();
      } else {
        toast({
          title: 'Error',
          description: result?.message || 'Failed to run auto checkout',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run auto checkout',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Auto Checkout Manager</h1>
      </div>
      
      <p className="text-muted-foreground">
        Automatically set default checkout time to 5:00 PM for employees who checked in but didn't check out.
      </p>

      {/* Main Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Check Records & Apply Auto Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today */}
            <div className="space-y-2">
              <Label>Today's Records</Label>
              <Button 
                onClick={loadTodayRecords}
                variant={viewMode === 'today' ? 'default' : 'outline'}
                className="w-full"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Check Today
              </Button>
            </div>

            {/* Specific Date */}
            <div className="space-y-2">
              <Label htmlFor="selectedDate">Specific Date</Label>
              <div className="flex gap-2 min-w-0">
                <Input
                  id="selectedDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 min-w-0"
                />
                <Button 
                  onClick={loadDateRecords}
                  variant={viewMode === 'date' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-shrink-0"
                >
                  Check
                </Button>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex gap-2 min-w-0">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs flex-1 min-w-0"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs flex-1 min-w-0"
                />
                <Button 
                  onClick={loadRangeRecords}
                  variant={viewMode === 'range' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-shrink-0"
                >
                  Check
                </Button>
              </div>
            </div>
          </div>

          {/* Current View Info */}
          {recordCount > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    {recordCount} employees need auto checkout
                  </span>
                </div>
                <Button 
                  onClick={handleRunAllForCurrentView}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Processing...' : `Apply to All (${recordCount})`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Records Table */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Records Missing Checkout ({recordCount})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <CheckSquare className="h-4 w-4" />
                  {selectedRecords.size === records.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  onClick={handleBulkCheckout}
                  disabled={loading || selectedRecords.size === 0}
                  size="sm"
                >
                  {loading ? 'Processing...' : `Apply to Selected (${selectedRecords.size})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {records.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50 hover:bg-yellow-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedRecords.has(record.id)}
                      onCheckedChange={() => handleSelectRecord(record.id)}
                    />
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {record.employee_name || record.employee_code || 'Unknown Employee'}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Date: {formatDate(record.entry_date)}</div>
                        <div>Check-in: {formatTime(record.check_in_at)}</div>
                        <div>Status: <span className="font-medium text-orange-600">{record.status}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Will be set to 5:00 PM</div>
                      <div className="text-orange-600 font-medium">Missing checkout</div>
                    </div>
                    <Button
                      onClick={() => handleIndividualCheckout(record.id)}
                      disabled={loading}
                      size="sm"
                      variant="outline"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            How Auto Checkout Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-2">What it does:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Sets checkout time to 5:00 PM (17:00) for employees who checked in but didn't check out</li>
              <li>Updates status from 'in_progress' to 'completed'</li>
              <li>Calculates total work time from check-in to 5:00 PM</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium text-foreground mb-2">Usage:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Check Records:</strong> Click "Check Today/Date/Range" to see which employees need auto checkout</li>
              <li><strong>Individual:</strong> Click "Apply" next to any employee to checkout just that person</li>
              <li><strong>Bulk:</strong> Select multiple employees and click "Apply to Selected"</li>
              <li><strong>All:</strong> Click "Apply to All" to checkout all employees in the current view</li>
            </ul>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 font-medium">💡 Tip: All operations are logged and can be tracked in the system logs.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}