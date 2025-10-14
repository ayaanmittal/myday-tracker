import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Calendar, Clock, User, Save, X } from 'lucide-react';

interface DayEntry {
  id: string;
  user_id: string;
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  manual_status: string | null;
  manual_override_by: string | null;
  manual_override_at: string | null;
  manual_override_reason: string | null;
  is_late: boolean;
  device_info: string | null;
  modification_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface OverrideUser {
  id: string;
  name: string;
  email: string;
}

interface WorkHistoryEditDialogProps {
  entry: DayEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function WorkHistoryEditDialog({ entry, open, onOpenChange, onSave }: WorkHistoryEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [overrideUser, setOverrideUser] = useState<OverrideUser | null>(null);
  const [formData, setFormData] = useState({
    manual_status: 'none',
    manual_override_reason: '',
    check_in_at: '',
    check_out_at: '',
    total_work_time_minutes: 0
  });

  const fetchOverrideUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching override user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching override user:', error);
      return null;
    }
  };

  useEffect(() => {
    if (entry) {
      setFormData({
        manual_status: entry.manual_status || 'none',
        manual_override_reason: entry.manual_override_reason || '',
        check_in_at: entry.check_in_at ? new Date(entry.check_in_at).toISOString().slice(0, 16) : '',
        check_out_at: entry.check_out_at ? new Date(entry.check_out_at).toISOString().slice(0, 16) : '',
        total_work_time_minutes: entry.total_work_time_minutes || 0
      });

      // Fetch override user if there's an override
      if (entry.manual_override_by) {
        fetchOverrideUser(entry.manual_override_by).then(user => {
          setOverrideUser(user);
        });
      } else {
        setOverrideUser(null);
      }
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to edit work history',
          variant: 'destructive',
        });
        return;
      }

      const updateData: any = {
        manual_status: formData.manual_status === 'none' ? null : formData.manual_status || null,
        manual_override_by: user.user.id,
        manual_override_at: new Date().toISOString(),
        manual_override_reason: formData.manual_override_reason || null,
        updated_at: new Date().toISOString()
      };

      // Only update time fields if manual_status is not set to absent, holiday, or leave_granted
      if (formData.manual_status !== 'absent' && formData.manual_status !== 'holiday' && formData.manual_status !== 'leave_granted') {
        updateData.check_in_at = formData.check_in_at ? new Date(formData.check_in_at).toISOString() : null;
        updateData.check_out_at = formData.check_out_at ? new Date(formData.check_out_at).toISOString() : null;
        updateData.total_work_time_minutes = formData.total_work_time_minutes;
      } else {
        // Clear time fields for absent/holiday/leave_granted
        updateData.check_in_at = null;
        updateData.check_out_at = null;
        updateData.total_work_time_minutes = null;
      }

      const { error } = await supabase
        .from('unified_attendance')
        .update(updateData)
        .eq('id', entry.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Work history entry updated successfully',
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating work history:', error);
      toast({
        title: 'Error',
        description: 'Failed to update work history entry',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setFormData(prev => ({
      ...prev,
      manual_status: status
    }));
  };

  const calculateWorkTime = () => {
    if (!formData.check_in_at || !formData.check_out_at) return 0;
    
    const checkIn = new Date(formData.check_in_at);
    const checkOut = new Date(formData.check_out_at);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    
    return Math.max(0, diffMinutes);
  };

  const handleTimeChange = () => {
    const workTime = calculateWorkTime();
    setFormData(prev => ({
      ...prev,
      total_work_time_minutes: workTime
    }));
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Edit Work History Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entry Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm font-medium text-gray-600">Date</Label>
              <p className="text-sm">{new Date(entry.entry_date).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Current Status</Label>
              <p className="text-sm capitalize">{entry.status}</p>
            </div>
          </div>

          {/* Override Info - Show if there's an existing override */}
          {entry.manual_status && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-yellow-600" />
                <Label className="text-sm font-medium text-yellow-800">Manual Override Applied</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs font-medium text-yellow-700">Override Status</Label>
                  <p className="text-yellow-900 capitalize">{entry.manual_status}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-yellow-700">Override Date</Label>
                  <p className="text-yellow-900">
                    {entry.manual_override_at ? new Date(entry.manual_override_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                {overrideUser && (
                  <div>
                    <Label className="text-xs font-medium text-yellow-700">Override By</Label>
                    <p className="text-yellow-900">{overrideUser.name} ({overrideUser.email})</p>
                  </div>
                )}
                {entry.manual_override_reason && (
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium text-yellow-700">Override Reason</Label>
                    <p className="text-yellow-900">{entry.manual_override_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Status Override */}
          <div className="space-y-2">
            <Label htmlFor="manual_status">Override Status</Label>
            <Select value={formData.manual_status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select status override" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Override (Use Original Status)</SelectItem>
                <SelectItem value="present">Present (No Times Required)</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="leave_granted">Leave Granted</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Override the original status with a manual status
            </p>
          </div>

          {/* Time Fields - Only show if not absent, holiday, or leave_granted */}
          {formData.manual_status !== 'absent' && formData.manual_status !== 'holiday' && formData.manual_status !== 'leave_granted' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="check_in_at">Check In Time</Label>
                <Input
                  id="check_in_at"
                  type="datetime-local"
                  value={formData.check_in_at}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, check_in_at: e.target.value }));
                    handleTimeChange();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check_out_at">Check Out Time</Label>
                <Input
                  id="check_out_at"
                  type="datetime-local"
                  value={formData.check_out_at}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, check_out_at: e.target.value }));
                    handleTimeChange();
                  }}
                />
              </div>
            </div>
          )}

          {/* Work Time Display */}
          {formData.manual_status !== 'absent' && formData.manual_status !== 'holiday' && formData.manual_status !== 'leave_granted' && (
            <div className="space-y-2">
              <Label>Total Work Time</Label>
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">
                  {Math.floor(formData.total_work_time_minutes / 60)}h {formData.total_work_time_minutes % 60}m
                </span>
              </div>
            </div>
          )}

          {/* Override Reason */}
          <div className="space-y-2">
            <Label htmlFor="manual_override_reason">Override Reason</Label>
            <Textarea
              id="manual_override_reason"
              value={formData.manual_override_reason}
              onChange={(e) => setFormData(prev => ({ ...prev, manual_override_reason: e.target.value }))}
              placeholder="Enter reason for this override..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
