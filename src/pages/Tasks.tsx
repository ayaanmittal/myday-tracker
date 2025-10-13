import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, Calendar, User } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskDetailDialog } from '@/components/TaskDetailDialog';
import { TaskNotificationBadge } from '@/components/TaskNotificationBadge';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_by_profile?: {
    name: string;
    email: string;
  };
}

export default function Tasks() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const { 
    loadMultipleTaskNotifications, 
    getTaskNotification, 
    markTaskAsViewed 
  } = useTaskNotifications();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading) {
      fetchTasks();
    }
  }, [user, roleLoading, navigate]);

  const fetchTasks = async () => {
    try {
      // First, fetch tasks without the profile join
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user?.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        // Check if it's a table doesn't exist error
        if (tasksError.message?.includes('relation "tasks" does not exist') || 
            tasksError.message?.includes('relation "public.tasks" does not exist')) {
          console.log('Tasks table not found. Please run the database setup script.');
          setTasks([]);
          return;
        }
        throw tasksError;
      }

      // If we have tasks, fetch the assigned_by profile information separately
      if (tasksData && tasksData.length > 0) {
        const assignedByIds = [...new Set(tasksData.map(task => task.assigned_by))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', assignedByIds);

        // Combine the data
        const tasksWithProfiles = tasksData.map((task): any => ({
          ...task,
          assigned_by_profile: profilesData?.find(profile => profile.id === task.assigned_by)
        }));

        setTasks(tasksWithProfiles);
        
        // Load notifications for all tasks
        const taskIds = tasksWithProfiles.map((task: Task) => task.id);
        void loadMultipleTaskNotifications(taskIds);
      } else {
        setTasks([]);
      }
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      // Don't show error toast if table doesn't exist
      if (!error.message?.includes('relation "tasks" does not exist') && 
          !error.message?.includes('relation "public.tasks" does not exist')) {
        toast({
          title: 'Error',
          description: 'Failed to fetch tasks',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus !== 'completed') {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task updated',
        description: `Task status updated to ${newStatus.replace('_', ' ')}.`,
      });

      fetchTasks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
    // Mark task as viewed to clear notifications
    markTaskAsViewed(task.id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'all') return true;
    return task.status === statusFilter;
  });

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
    const pending = tasks.filter((task) => task.status === 'pending').length;

    return { total, completed, inProgress, pending };
  };

  const stats = getTaskStats();

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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground">View and manage your assigned tasks</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task List</CardTitle>
            <CardDescription>
              {statusFilter === 'all' 
                ? 'All your assigned tasks' 
                : `Tasks with status: ${statusFilter.replace('_', ' ')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned By</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Assigned</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleTaskClick(task)}>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{task.title}</p>
                          <TaskNotificationBadge 
                            newComments={getTaskNotification(task.id).newComments}
                            newAttachments={getTaskNotification(task.id).newAttachments}
                          />
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {task.description.length > 100
                              ? `${task.description.substring(0, 100)}...`
                              : task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{task.assigned_by_profile?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.assigned_by_profile?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {task.status !== 'completed' && task.status !== 'cancelled' && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={task.status}
                            onValueChange={(value) => handleStatusChange(task.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {task.status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Completed</span>
                        </div>
                      )}
                      {task.status === 'cancelled' && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">Cancelled</span>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="ml-2" onClick={(e) => { e.stopPropagation(); setDetailTaskId(task.id); markTaskAsViewed(task.id); }}>Open Dialog</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {statusFilter === 'all' 
                  ? 'No tasks assigned to you yet' 
                  : `No ${statusFilter.replace('_', ' ')} tasks found`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {selectedTask?.title}
              </DialogTitle>
              <DialogDescription>
                Task Details
              </DialogDescription>
            </DialogHeader>
            
            {selectedTask && (
              <div className="space-y-6">
                {/* Task Description */}
                {selectedTask.description && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Description</h4>
                    <p className="text-sm leading-relaxed">{selectedTask.description}</p>
                  </div>
                )}

                {/* Task Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Status</h4>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedTask.status)}
                      <Badge className={getStatusColor(selectedTask.status)}>
                        {selectedTask.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Priority</h4>
                    <Badge className={getPriorityColor(selectedTask.priority)}>
                      {selectedTask.priority}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Assigned By</h4>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{selectedTask.assigned_by_profile?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedTask.assigned_by_profile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Due Date</h4>
                    <p className="text-sm">
                      {selectedTask.due_date 
                        ? new Date(selectedTask.due_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'No due date'
                      }
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Created</h4>
                    <p className="text-sm">
                      {new Date(selectedTask.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {selectedTask.completed_at && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Completed</h4>
                      <p className="text-sm">
                        {new Date(selectedTask.completed_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status Update Section */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">Update Status</h4>
                  <Select
                    value={selectedTask.status}
                    onValueChange={(value) => {
                      handleStatusChange(selectedTask.id, value);
                      setDialogOpen(false);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <TaskDetailDialog taskId={detailTaskId} open={!!detailTaskId} onOpenChange={(open) => setDetailTaskId(open ? detailTaskId : null)} />
    </Layout>
  );
}
