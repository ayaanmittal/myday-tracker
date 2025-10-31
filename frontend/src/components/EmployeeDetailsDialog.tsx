import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { User2, Shield } from 'lucide-react';

interface EmployeeDetailsDialogProps {
  employeeId: string;
  employeeName?: string;
  trigger?: React.ReactNode;
  onSaved?: () => void;
}

type ProfileRecord = {
  id: string;
  name: string;
  email: string;
  team: string | null;
  designation?: string | null;
  phone?: string | null;
  address?: string | null;
  is_active?: boolean;
};

type UserRole = {
  id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'employee';
  created_at: string;
};

export function EmployeeDetailsDialog({ employeeId, employeeName, trigger, onSaved }: EmployeeDetailsDialogProps) {
  const { toast } = useToast();
  const { data: role } = useUserRole();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const isAdmin = role === 'admin';
  const isReadOnly = !isAdmin;

  const supports = useMemo(() => ({
    designation: typeof (profile as any)?.designation !== 'undefined',
    phone: typeof (profile as any)?.phone !== 'undefined',
    address: typeof (profile as any)?.address !== 'undefined',
  }), [profile]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        // Load profile and role in parallel
        const [profileResult, roleResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', employeeId)
            .single(),
          supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', employeeId)
            .single()
        ]);

        if (profileResult.error) throw profileResult.error;
        if (roleResult.error) throw roleResult.error;

        setProfile(profileResult.data as ProfileRecord);
        setUserRole(roleResult.data as UserRole);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load employee details', variant: 'destructive' });
        setOpen(false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, employeeId, toast]);

  const [form, setForm] = useState<Partial<ProfileRecord>>({});
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'employee'>('employee');

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        email: profile.email,
        team: profile.team || '',
        designation: profile.designation ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (userRole) {
      setSelectedRole(userRole.role);
    }
  }, [userRole]);

  const handleSave = async () => {
    if (!profile || !userRole) return;
    setLoading(true);
    try {
      // Build update payload conservatively: include only known/existing keys
      const payload: Record<string, any> = {};
      if (typeof form.name !== 'undefined') payload.name = form.name;
      if (typeof form.team !== 'undefined') payload.team = form.team || null;
      if (typeof (profile as any).designation !== 'undefined' && typeof form.designation !== 'undefined') payload.designation = form.designation || null;
      if (typeof (profile as any).phone !== 'undefined' && typeof form.phone !== 'undefined') payload.phone = form.phone || null;
      if (typeof (profile as any).address !== 'undefined' && typeof form.address !== 'undefined') payload.address = form.address || null;

      // Email typically managed by auth; only allow if present on table and changed
      if (typeof form.email !== 'undefined' && form.email !== profile.email) {
        payload.email = form.email;
      }

      // Update profile if there are changes
      if (Object.keys(payload).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', profile.id);
        if (profileError) throw profileError;
      }

      // Update role if changed
      if (selectedRole !== userRole.role) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('id', userRole.id);
        if (roleError) throw roleError;
      }

      if (Object.keys(payload).length === 0 && selectedRole === userRole.role) {
        toast({ title: 'No changes', description: 'Nothing to update.' });
        return;
      }

      toast({ title: 'Saved', description: 'Employee details updated.' });
      onSaved?.();
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save changes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="text-xs">
            <User2 className="h-3 w-3 mr-1" />
            Employee Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User2 className="h-5 w-5" />
            Employee Details{employeeName ? ` - ${employeeName}` : ''}
          </DialogTitle>
        </DialogHeader>

        {!profile ? (
          <div className="py-6 text-muted-foreground">{loading ? 'Loading...' : 'No data found'}</div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Role Section */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4" />
                <h3 className="font-medium">Role & Permissions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">User Role</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value: 'admin' | 'manager' | 'employee') => setSelectedRole(value)}
                    disabled={isReadOnly || loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedRole === 'admin' && 'Full system access and management capabilities'}
                    {selectedRole === 'manager' && 'Team management and oversight permissions'}
                    {selectedRole === 'employee' && 'Basic user access and time tracking'}
                  </p>
                </div>
                <div>
                  <Label>Current Status</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`h-2 w-2 rounded-full ${
                      profile.is_active ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm">
                      {profile.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Details Section */}
            <div>
              <h3 className="font-medium mb-3">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name as string || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={isReadOnly || loading} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={form.email as string || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={isReadOnly || loading} />
                </div>
                <div>
                  <Label htmlFor="team">Team</Label>
                  <Input id="team" value={(form.team as string) || ''} onChange={(e) => setForm({ ...form, team: e.target.value })} disabled={isReadOnly || loading} />
                </div>
                {supports.designation && (
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input id="designation" value={(form.designation as string) || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} disabled={isReadOnly || loading} />
                  </div>
                )}
                {supports.phone && (
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={(form.phone as string) || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={isReadOnly || loading} />
                  </div>
                )}
                {supports.address && (
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={(form.address as string) || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={isReadOnly || loading} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Close</Button>
              {isAdmin && (
                <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


