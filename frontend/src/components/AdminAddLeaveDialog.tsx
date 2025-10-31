import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, User, FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  employee_categories: { name: string };
}

interface LeaveType {
  id: string;
  name: string;
  description: string;
  is_paid: boolean;
}

interface AdminAddLeaveDialogProps {
  onLeaveAdded?: () => void;
}

const AdminAddLeaveDialog: React.FC<AdminAddLeaveDialogProps> = ({ onLeaveAdded }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form data
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [workFromHome, setWorkFromHome] = useState(false);
  
  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  useEffect(() => {
    if (open) {
      // Reset form state when dialog opens
      setSelectedEmployee('');
      setSelectedLeaveType('');
      setStartDate(undefined);
      setEndDate(undefined);
      setReason('');
      setWorkFromHome(false);
      setError(null);
      setSuccess(null);
      
      loadEmployees();
      loadLeaveTypes();
    }
  }, [open]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          name, 
          email, 
          employee_categories!inner(name)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, name, description, is_paid')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!selectedEmployee || !selectedLeaveType || !startDate || !endDate) {
        throw new Error('Please fill in all required fields');
      }

      const daysRequested = calculateDays();
      if (daysRequested <= 0) {
        throw new Error('End date must be after start date');
      }

      // Validate that employee and leave type exist
      if (!employees.find(emp => emp.id === selectedEmployee)) {
        throw new Error('Selected employee not found');
      }
      
      if (!leaveTypes.find(lt => lt.id === selectedLeaveType)) {
        throw new Error('Selected leave type not found');
      }

      // Get current user for approved_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create leave request with admin status - using isolated variables to avoid conflicts
      const userId = selectedEmployee;
      const leaveTypeId = selectedLeaveType;
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const daysRequestedNum = Number(daysRequested);
      const reasonStr = reason || 'Leave added by admin';
      const workFromHomeBool = workFromHome === true;
      const statusStr = 'approved';
      const approvedById = user.id;
      const approvedAtStr = new Date().toISOString();
      const processedBool = false;

      // Create minimal insert data to test
      const insertData = {
        user_id: userId,
        leave_type_id: leaveTypeId,
        start_date: startDateStr,
        end_date: endDateStr,
        days_requested: daysRequestedNum,
        reason: reasonStr,
        work_from_home: false, // Hardcoded to false for testing
        status: 'approved',
        approved_by: approvedById,
        approved_at: approvedAtStr,
        processed: false // Hardcoded to false for testing
      };

      console.log('AdminAddLeaveDialog - Insert data:', insertData);
      console.log('AdminAddLeaveDialog - Field types:', {
        user_id: typeof userId,
        leave_type_id: typeof leaveTypeId,
        start_date: typeof startDateStr,
        end_date: typeof endDateStr,
        days_requested: typeof daysRequestedNum,
        reason: typeof reasonStr,
        work_from_home: typeof false,
        status: typeof 'approved',
        approved_by: typeof approvedById,
        approved_at: typeof approvedAtStr,
        processed: typeof false
      });
      console.log('AdminAddLeaveDialog - Raw values:', {
        userId, leaveTypeId, startDateStr, endDateStr, daysRequestedNum,
        reasonStr, workFromHomeBool, statusStr, approvedById, approvedAtStr, processedBool
      });

      const { data, error } = await supabase
        .from('leave_requests')
        .insert(insertData)
        .select();

      if (error) {
        console.error('AdminAddLeaveDialog - Insert error:', error);
        throw new Error(`Failed to create leave request: ${error.message}`);
      }

      setSuccess('Leave added successfully for employee');
      setOpen(false);
      
      // Reset form
      setSelectedEmployee('');
      setSelectedLeaveType('');
      setStartDate(undefined);
      setEndDate(undefined);
      setReason('');
      setWorkFromHome(false);
      setError(null);
      setSuccess(null);
      
      // Notify parent component
      if (onLeaveAdded) {
        onLeaveAdded();
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Leave
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Leave for Employee</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Manually add a leave for an employee. This will be automatically approved.
          </p>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave Type *</Label>
              <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((leaveType) => (
                    <SelectItem key={leaveType.id} value={leaveType.id}>
                      {leaveType.name} {leaveType.is_paid ? '(Paid)' : '(Unpaid)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {startDate && endDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Total Days: {calculateDays()} days
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for leave (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="workFromHome"
              checked={workFromHome === true}
              onChange={(e) => {
                console.log('Checkbox changed:', e.target.checked);
                setWorkFromHome(e.target.checked);
              }}
              className="rounded border-gray-300"
            />
            <Label htmlFor="workFromHome">Work from home during this period</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Leave'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAddLeaveDialog;
