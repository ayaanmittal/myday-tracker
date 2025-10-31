import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Plus, Edit, Trash2, Users, Clock, FileText, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Meeting } from '@/integrations/supabase/types';

export default function Meetings() {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    meeting_date: '',
    meeting_minutes: ''
  });

  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meetings_with_creator')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch meetings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.meeting_date || !formData.meeting_minutes.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingMeeting) {
        // Update existing meeting
        const { error } = await supabase
          .from('meetings')
          .update({
            title: formData.title,
            meeting_date: formData.meeting_date,
            meeting_minutes: formData.meeting_minutes,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingMeeting.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Meeting updated successfully',
        });
      } else {
        // Create new meeting
        const { error } = await supabase
          .from('meetings')
          .insert({
            title: formData.title,
            meeting_date: formData.meeting_date,
            meeting_minutes: formData.meeting_minutes,
            created_by: user?.id
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Meeting created successfully',
        });
      }

      // Reset form and close dialog
      setFormData({ title: '', meeting_date: '', meeting_minutes: '' });
      setEditingMeeting(null);
      setIsDialogOpen(false);
      fetchMeetings();
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to save meeting',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      meeting_minutes: meeting.meeting_minutes
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Meeting deleted successfully',
      });
      fetchMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete meeting',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading meetings...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
              Meetings
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-base sm:text-lg font-medium">
                Meeting minutes and documentation
              </p>
              {!isManagerOrAdmin && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  View Only
                </Badge>
              )}
            </div>
          </div>
          
          {isManagerOrAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingMeeting(null);
                  setFormData({ title: '', meeting_date: '', meeting_minutes: '' });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingMeeting ? 'Edit Meeting' : 'Add New Meeting'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingMeeting ? 'Update the meeting details below.' : 'Create a new meeting record with minutes.'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium mb-2">
                      Meeting Title *
                    </label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter meeting title"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="meeting_date" className="block text-sm font-medium mb-2">
                      Meeting Date *
                    </label>
                    <Input
                      id="meeting_date"
                      type="date"
                      value={formData.meeting_date}
                      onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="meeting_minutes" className="block text-sm font-medium mb-2">
                      Meeting Minutes *
                    </label>
                    <Textarea
                      id="meeting_minutes"
                      value={formData.meeting_minutes}
                      onChange={(e) => setFormData({ ...formData, meeting_minutes: e.target.value })}
                      placeholder="Enter what happened in the meeting..."
                      rows={6}
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingMeeting ? 'Update Meeting' : 'Create Meeting'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {meetings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No meetings found</h3>
              <p className="text-muted-foreground text-center">
                {isManagerOrAdmin 
                  ? 'Get started by creating your first meeting record.'
                  : 'No meetings have been recorded yet. Check back later for meeting updates.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(meeting.meeting_date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDateTime(meeting.created_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Added by: {meeting.created_by_name || 'Unknown User'}
                        </div>
                      </div>
                    </div>
                    
                    {isManagerOrAdmin && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(meeting)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(meeting.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Meeting Minutes:</h4>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{meeting.meeting_minutes}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
