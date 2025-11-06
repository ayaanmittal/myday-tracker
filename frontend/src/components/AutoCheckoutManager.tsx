import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AutoCheckoutService } from '@/services/autoCheckoutService';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Clock, CheckCircle, AlertCircle, Calendar, Users, RefreshCw, CheckSquare, Settings } from 'lucide-react';

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
  const { data: role } = useUserRole();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'today' | 'date' | 'range'>('today');
  const [recordCount, setRecordCount] = useState(0);
  const [checkoutHour, setCheckoutHour] = useState(17);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Load records on component mount
  useEffect(() => {
    loadTodayRecords();
    if (isAdmin) {
      loadCheckoutTimeConfig();
    }
  }, [isAdmin]);

  const loadCheckoutTimeConfig = async () => {
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'auto_checkout_time_hour')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data?.value) {
        setCheckoutHour(parseInt(data.value, 10));
      }
    } catch (error) {
      console.error('Error loading checkout time config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveCheckoutTimeConfig = async (hour: number) => {
    setLoadingConfig(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'auto_checkout_time_hour',
          value: hour.toString(),
          category: 'attendance',
          description: 'Default checkout hour for auto checkout (0-23)',
          updated_by: (await supabase.auth.getUser()).data.user?.id || null,
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      
      setCheckoutHour(hour);
      toast({
        title: 'Success',
        description: `Checkout time updated to ${formatHour(hour)}`,
      });
    } catch (error: any) {
      console.error('Error saving checkout time config:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save checkout time',
        variant: 'destructive',
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

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
        <Clock className="h-6 w-6 text-white" />
        <h1 className="text-2xl font-bold text-white">Auto Checkout Manager</h1>
      </div>
      
      <p className="text-gray-300">
        Automatically set default checkout time to {formatHour(checkoutHour)} for employees who checked in but didn't check out.
      </p>

      {/* Auto Checkout Time Configuration - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Settings className="h-5 w-5 text-gray-600" />
                Auto Checkout Time Configuration
              </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="checkoutHour">Default Checkout Hour</Label>
              <Select
                value={checkoutHour.toString()}
                onValueChange={(value) => saveCheckoutTimeConfig(parseInt(value, 10))}
                disabled={loadingConfig}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {formatHour(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600">
                This time will be used for all auto checkout operations. Current: {formatHour(checkoutHour)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Control Panel */}
      <Card>
        <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Calendar className="h-5 w-5 text-gray-600" />
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
                className={`w-full ${viewMode === 'today' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700'}`}
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
                  className={`flex-shrink-0 ${viewMode === 'date' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700'}`}
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
                  className={`flex-shrink-0 ${viewMode === 'range' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700'}`}
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
                  className="bg-red-600 hover:bg-red-700 text-white [&_svg]:text-white"
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
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <AlertCircle className="h-5 w-5 text-gray-600" />
                Records Missing Checkout ({recordCount})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700"
                >
                  <CheckSquare className="h-4 w-4" />
                  {selectedRecords.size === records.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  onClick={handleBulkCheckout}
                  disabled={loading || selectedRecords.size === 0}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white [&_svg]:text-white"
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
                      <div className="font-medium text-sm text-gray-900">
                        {record.employee_name || record.employee_code || 'Unknown Employee'}
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Date: {formatDate(record.entry_date)}</div>
                        <div>Check-in: {formatTime(record.check_in_at)}</div>
                        <div>Status: <span className="font-medium text-orange-600">{record.status}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs">
                      <div className="text-gray-700">Will be set to {formatHour(checkoutHour)}</div>
                      <div className="text-orange-600 font-medium">Missing checkout</div>
                    </div>
                    <Button
                      onClick={() => handleIndividualCheckout(record.id)}
                      disabled={loading}
                      size="sm"
                      variant="outline"
                      className="text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700"
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
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <CheckCircle className="h-5 w-5 text-gray-600" />
                How Auto Checkout Works
              </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-900 mb-2">What it does:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
              <li>Sets checkout time to {formatHour(checkoutHour)} ({checkoutHour}:00) for employees who checked in but didn't check out</li>
              <li>Updates status from 'in_progress' to 'completed'</li>
              <li>Calculates total work time from check-in to {formatHour(checkoutHour)}</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium text-gray-900 mb-2">Usage:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
              <li><strong>Check Records:</strong> Click "Check Today/Date/Range" to see which employees need auto checkout</li>
              <li><strong>Individual:</strong> Click "Apply" next to any employee to checkout just that person</li>
              <li><strong>Bulk:</strong> Select multiple employees and click "Apply to Selected"</li>
              <li><strong>All:</strong> Click "Apply to All" to checkout all employees in the current view</li>
            </ul>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 font-medium">💡 Tip: All operations are logged and can be tracked in the system logs.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}