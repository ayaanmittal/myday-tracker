import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  RotateCcw, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RolloverSummary {
  from_year: number;
  to_year: number;
  employees_with_balances: number;
  total_remaining_days: number;
  eligible_for_rollover: number;
  balances_in_target_year: number;
}

interface RolloverResult {
  success: boolean;
  from_year: number;
  to_year: number;
  max_rollover_days: number;
  employees_processed: number;
  balances_created: number;
  message: string;
  error?: string;
}

const LeaveRolloverManager: React.FC = () => {
  const [fromYear, setFromYear] = useState(2024);
  const [toYear, setToYear] = useState(2025);
  const [maxRolloverDays, setMaxRolloverDays] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rolloverSummary, setRolloverSummary] = useState<RolloverSummary | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(i);
    }
    return years;
  };

  const loadRolloverSummary = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_rollover_summary', {
          from_year: parseInt(fromYear.toString()),
          to_year: parseInt(toYear.toString())
        });

      if (error) throw error;
      setRolloverSummary(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (fromYear && toYear) {
      loadRolloverSummary();
    }
  }, [fromYear, toYear]);

  const handleRollover = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase
        .rpc('rollover_leave_balances', {
          from_year: parseInt(fromYear.toString()),
          to_year: parseInt(toYear.toString()),
          max_rollover_days: parseInt(maxRolloverDays.toString())
        });

      if (error) throw error;

      if (data.success) {
        setSuccess(`Successfully rolled over leave balances from ${fromYear} to ${toYear}. ${data.balances_created} balances created.`);
        await loadRolloverSummary();
      } else {
        setError(data.error || 'Rollover failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Leave Balance Rollover</h2>
          <p className="text-muted-foreground">
            Roll over unused leave balances from one year to the next
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Rollover Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Rollover Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="from-year">From Year</Label>
              <Select value={fromYear.toString()} onValueChange={(value) => setFromYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="to-year">To Year</Label>
              <Select value={toYear.toString()} onValueChange={(value) => setToYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="max-rollover">Max Rollover Days</Label>
              <Input
                id="max-rollover"
                type="number"
                min="0"
                max="30"
                value={maxRolloverDays}
                onChange={(e) => setMaxRolloverDays(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex space-x-2">
            <Button 
              onClick={loadRolloverSummary} 
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Summary
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Rollover
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Rollover Preview</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {rolloverSummary && (
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Employees with Balances</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{rolloverSummary.employees_with_balances}</div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Total Remaining Days</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{rolloverSummary.total_remaining_days}</div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Eligible for Rollover</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{rolloverSummary.eligible_for_rollover}</div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Existing Balances in {toYear}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{rolloverSummary.balances_in_target_year}</div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Rollover Summary */}
      {rolloverSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Rollover Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{rolloverSummary.employees_with_balances}</div>
                <div className="text-sm text-muted-foreground">Employees with Balances</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{rolloverSummary.total_remaining_days}</div>
                <div className="text-sm text-muted-foreground">Total Remaining Days</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{rolloverSummary.eligible_for_rollover}</div>
                <div className="text-sm text-muted-foreground">Eligible for Rollover</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{rolloverSummary.balances_in_target_year}</div>
                <div className="text-sm text-muted-foreground">Existing in {toYear}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rollover Action */}
      <Card>
        <CardHeader>
          <CardTitle>Execute Rollover</CardTitle>
          <p className="text-sm text-muted-foreground">
            This will create new leave balances for {toYear} with rolled over days from {fromYear}
          </p>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                onClick={clearMessages}
                disabled={loading || fromYear >= toYear}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {loading ? 'Processing...' : `Rollover from ${fromYear} to ${toYear}`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Leave Rollover</AlertDialogTitle>
                <AlertDialogDescription>
                  This will roll over unused leave balances from {fromYear} to {toYear}. 
                  Maximum {maxRolloverDays} days will be rolled over per leave type.
                  <br /><br />
                  This action cannot be undone. Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRollover}>
                  Confirm Rollover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveRolloverManager;
