import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Clock, AlertCircle, Megaphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expires_at: string | null;
  send_to_all: boolean;
  created_by_profile?: {
    name: string;
    email: string;
  };
  recipients_count?: number;
  views_count?: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string | null;
}

export default function Announcements() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    expires_at: '',
    sendToAll: true,
    selectedEmployees: [] as string[],
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'admin' && role !== 'manager') {
      navigate('/today');
      return;
    }

    if (role === 'admin' || role === 'manager') {
      fetchAnnouncements();
      fetchEmployees();
    }
  }, [user, role, roleLoading, navigate]);

  const fetchAnnouncements = async () => {
    try {
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (announcementsError) {
        if (announcementsError.message?.includes('relation "announcements" does not exist')) {
          console.log('Announcements table not found. Please run the database setup script.');
          setAnnouncements([]);
          return;
        }
        throw announcementsError;
      }

      // Fetch recipient and view counts for each announcement
      const announcementsWithCounts = await Promise.all(
        (announcementsData || []).map(async (announcement) => {
          const [recipientsResult, viewsResult] = await Promise.all([
            supabase
              .from('announcement_recipients')
              .select('id', { count: 'exact' })
              .eq('announcement_id', announcement.id),
            supabase
              .from('announcement_views')
              .select('id', { count: 'exact' })
              .eq('announcement_id', announcement.id),
          ]);

          return {
            ...announcement,
            recipients_count: recipientsResult.count || 0,
            views_count: viewsResult.count || 0,
          };
        })
      );

      setAnnouncements(announcementsWithCounts);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch announcements',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, email, designation')
        .eq('is_active', true)
        .order('name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate form
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in both title and content.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (!formData.sendToAll && formData.selectedEmployees.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select employees or choose "Send to all employees".',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      if (editingAnnouncement) {
        // Update existing announcement
        const { error } = await supabase
          .from('announcements')
          .update({
            title: formData.title,
            content: formData.content,
            priority: formData.priority,
            expires_at: formData.expires_at || null,
            send_to_all: formData.sendToAll,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAnnouncement.id);

        if (error) throw error;

        toast({
          title: 'Announcement updated',
          description: 'Announcement has been updated successfully.',
        });
      } else {
        // Create new announcement
        const { data: announcementData, error: announcementError } = await supabase
          .from('announcements')
          .insert({
            title: formData.title,
            content: formData.content,
            created_by: user?.id,
            priority: formData.priority,
            expires_at: formData.expires_at || null,
            send_to_all: formData.sendToAll,
          })
          .select()
          .single();

        if (announcementError) throw announcementError;

        // Create recipients
        if (!formData.sendToAll && formData.selectedEmployees.length > 0) {
          // Send to selected employees
          const recipientData = formData.selectedEmployees.map(employeeId => ({
            announcement_id: announcementData.id,
            user_id: employeeId,
          }));

          const { error: recipientsError } = await supabase
            .from('announcement_recipients')
            .insert(recipientData);

          if (recipientsError) throw recipientsError;

          toast({
            title: 'Announcement created',
            description: `Announcement sent to ${formData.selectedEmployees.length} selected employees.`,
          });
        } else if (formData.sendToAll) {
          // Send to all employees (handled by trigger)
          toast({
            title: 'Announcement created',
            description: `Announcement sent to all ${employees.length} employees.`,
          });
        } else {
          // No employees selected
          toast({
            title: 'Announcement created',
            description: 'Announcement created but no recipients selected.',
          });
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error saving announcement:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save announcement',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;

      toast({
        title: 'Announcement deleted',
        description: 'Announcement has been deleted successfully.',
      });

      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete announcement',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (announcementId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !currentStatus })
        .eq('id', announcementId);

      if (error) throw error;

      toast({
        title: 'Announcement updated',
        description: `Announcement ${!currentStatus ? 'activated' : 'deactivated'} successfully.`,
      });

      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error updating announcement:', error);
      toast({
        title: 'Error',
        description: 'Failed to update announcement',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'normal':
        return <Badge className="bg-blue-100 text-blue-800">Normal</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{priority}</Badge>;
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      priority: 'normal',
      expires_at: '',
      sendToAll: true,
      selectedEmployees: [],
    });
    setEditingAnnouncement(null);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
      sendToAll: true, // For editing, we'll assume it was sent to all
      selectedEmployees: [],
    });
    setDialogOpen(true);
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight gradient-text">
              Announcements
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage announcements for employees
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
                </DialogTitle>
                <DialogDescription>
                  {editingAnnouncement
                    ? 'Update announcement details'
                    : 'Create a new announcement for employees'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Enter announcement title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    required
                    placeholder="Enter announcement content"
                    rows={6}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: 'low' | 'normal' | 'high' | 'urgent') =>
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expires_at">Expires At (optional)</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    />
                  </div>
                </div>

                {/* Send to all employees checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendToAll"
                    checked={formData.sendToAll}
                    onCheckedChange={(checked) => {
                      setFormData({ 
                        ...formData, 
                        sendToAll: checked as boolean,
                        selectedEmployees: checked ? [] : formData.selectedEmployees
                      });
                    }}
                  />
                  <Label htmlFor="sendToAll" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Send to all employees ({employees.length} employees)
                  </Label>
                </div>

                {/* Employee selection */}
                {!formData.sendToAll && (
                  <div className="space-y-2">
                    <Label>Select Employees</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                      {employees.map((employee) => (
                        <div key={employee.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`employee-${employee.id}`}
                            checked={formData.selectedEmployees.includes(employee.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  selectedEmployees: [...formData.selectedEmployees, employee.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  selectedEmployees: formData.selectedEmployees.filter(id => id !== employee.id)
                                });
                              }
                            }}
                          />
                          <Label htmlFor={`employee-${employee.id}`} className="text-sm">
                            {employee.name} {employee.designation && `(${employee.designation})`}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading 
                      ? 'Saving...' 
                      : editingAnnouncement 
                        ? 'Update Announcement' 
                        : formData.sendToAll 
                          ? `Create for All (${employees.length})` 
                          : `Create for Selected (${formData.selectedEmployees.length})`
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Announcements</CardTitle>
            <CardDescription>Manage and track all announcements</CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No announcements created yet</p>
                <p className="text-sm">Click "Create Announcement" to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{announcement.title}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {announcement.content}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(announcement.priority)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{announcement.created_by_profile?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {announcement.created_by_profile?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{announcement.recipients_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{announcement.views_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                          {announcement.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(announcement.created_at).toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(announcement)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(announcement.id, announcement.is_active)}
                          >
                            {announcement.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(announcement.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
