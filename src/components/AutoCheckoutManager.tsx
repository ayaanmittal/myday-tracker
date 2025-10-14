import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AutoCheckoutService } from '@/services/autoCheckoutService';
import { Clock, CheckCircle, AlertCircle, Calendar, Users } from 'lucide-react';

export function AutoCheckoutManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [affectedRecords, setAffectedRecords] = useState<any[]>([]);
  const [affectedCount, setAffectedCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordsNeedingAutoCheckout, setRecordsNeedingAutoCheckout] = useState<any[]>([]);
  const [autoCheckoutCount, setAutoCheckoutCount] = useState(0);

  // Load affected records for today on component mount
  useEffect(() => {
    loadAffectedRecordsForToday();
    loadRecordsNeedingAutoCheckout();
  }, []);

  const loadAffectedRecordsForToday = async () => {
    try {
      const result = await AutoCheckoutService.getAffectedRecordsForToday();
      setAffectedRecords(result.records);
      setAffectedCount(result.count);
    } catch (error) {
      console.error('Error loading affected records:', error);
    }
  };

  const loadAffectedRecordsForDate = async (date: string) => {
    try {
      const result = await AutoCheckoutService.getAffectedRecordsForDate(date);
      setAffectedRecords(result.records);
      setAffectedCount(result.count);
    } catch (error) {
      console.error('Error loading affected records:', error);
    }
  };

  const loadAffectedRecordsForDateRange = async (start: string, end: string) => {
    try {
      const result = await AutoCheckoutService.getAffectedRecordsForDateRange(start, end);
      setAffectedRecords(result.records);
      setAffectedCount(result.count);
    } catch (error) {
      console.error('Error loading affected records:', error);
    }
  };

  const handleRunForToday = async () => {
    setLoading(true);
    try {
      const result = await AutoCheckoutService.runForToday();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload affected records
        await loadAffectedRecordsForToday();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run auto checkout for today',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunForDate = async () => {
    setLoading(true);
    try {
      const result = await AutoCheckoutService.runForDate(selectedDate);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload affected records
        await loadAffectedRecordsForDate(selectedDate);
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run auto checkout for selected date',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunForDateRange = async () => {
    setLoading(true);
    try {
      const result = await AutoCheckoutService.runForDateRange(startDate, endDate);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload affected records
        await loadAffectedRecordsForDateRange(startDate, endDate);
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run auto checkout for date range',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAffectedRecords = async () => {
    await loadAffectedRecordsForDate(selectedDate);
  };

  const handleCheckAffectedRecordsRange = async () => {
    await loadAffectedRecordsForDateRange(startDate, endDate);
  };

  const loadRecordsNeedingAutoCheckout = async () => {
    try {
      const result = await AutoCheckoutService.getRecordsNeedingAutoCheckout();
      setRecordsNeedingAutoCheckout(result.records);
      setAutoCheckoutCount(result.count);
    } catch (error) {
      console.error('Error loading records needing auto checkout:', error);
    }
  };

  const handleRunAutoCheckoutAt1159PM = async () => {
    setLoading(true);
    try {
      const result = await AutoCheckoutService.runAutoCheckoutAt1159PM();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        // Reload records
        await loadRecordsNeedingAutoCheckout();
        await loadAffectedRecordsForToday();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run auto checkout at 11:59 PM',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

      {/* 11:59 PM Auto Checkout */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Clock className="h-5 w-5" />
            11:59 PM Auto Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">
                {autoCheckoutCount} employees need auto checkout at 11:59 PM
              </span>
            </div>
            <Button 
              onClick={loadRecordsNeedingAutoCheckout}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
          </div>
          
          <div className="p-3 bg-orange-100 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Auto Checkout at 11:59 PM:</strong> Employees who checked in but didn't check out will automatically have their checkout time set to 5:00 PM.
            </p>
          </div>
          
          <Button 
            onClick={handleRunAutoCheckoutAt1159PM}
            disabled={loading || autoCheckoutCount === 0}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? 'Processing...' : `Run 11:59 PM Auto Checkout (${autoCheckoutCount} records)`}
          </Button>
        </CardContent>
      </Card>

      {/* Today's Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">
                {affectedCount} employees need auto checkout
              </span>
            </div>
            <Button 
              onClick={loadAffectedRecordsForToday}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
          </div>
          
          <Button 
            onClick={handleRunForToday}
            disabled={loading || affectedCount === 0}
            className="w-full"
          >
            {loading ? 'Processing...' : `Run Auto Checkout for Today (${affectedCount} records)`}
          </Button>
        </CardContent>
      </Card>

      {/* Specific Date */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Specific Date
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="selectedDate">Select Date</Label>
              <Input
                id="selectedDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleCheckAffectedRecords}
                variant="outline"
                size="sm"
              >
                Check Records
              </Button>
            </div>
          </div>
          
          <Button 
            onClick={handleRunForDate}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Processing...' : `Run Auto Checkout for ${selectedDate}`}
          </Button>
        </CardContent>
      </Card>

      {/* Date Range */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleCheckAffectedRecordsRange}
              variant="outline"
              size="sm"
            >
              Check Records
            </Button>
            <Button 
              onClick={handleRunForDateRange}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Processing...' : `Run Auto Checkout for Range`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records Needing 11:59 PM Auto Checkout */}
      {recordsNeedingAutoCheckout.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              Records Needing 11:59 PM Auto Checkout ({autoCheckoutCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recordsNeedingAutoCheckout.map((record, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {record.profiles?.name || record.employee_name || record.employee_code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Check-in: {new Date(record.check_in_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-orange-600 font-medium">
                    Will be set to 5:00 PM
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Affected Records List */}
      {affectedRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Affected Records ({affectedCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {affectedRecords.map((record, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {record.employee_name || record.employee_code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Check-in: {new Date(record.check_in_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Will be set to 5:00 PM
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
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong>11:59 PM Auto Checkout:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Automatically runs at 11:59 PM for employees who checked in but didn't check out</li>
            <li>Sets checkout time to 5:00 PM (17:00) for the same day</li>
            <li>Updates status from 'in_progress' to 'completed'</li>
            <li>Calculates total work time from check-in to 5:00 PM</li>
          </ul>
          
          <p><strong>Manual Auto Checkout:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Can be run manually for any date or date range</li>
            <li>Sets checkout time to 5:00 PM for employees who:</li>
            <li className="ml-4">- Have a check-in time for the specified date</li>
            <li className="ml-4">- Do not have a check-out time (NULL)</li>
            <li className="ml-4">- Are not already marked as absent or holiday</li>
          </ul>
          
          <p>• All operations are logged in the api_refresh_logs table</p>
        </CardContent>
      </Card>
    </div>
  );
}
