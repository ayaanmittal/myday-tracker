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
import { Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle, Paperclip } from 'lucide-react';
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
  assigned_to_profile?: {
    name: string;
    email: string;
  };
  assigned_by_profile?: {
    name: string;
    email: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string | null;
}

export default function TaskManager() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const { 
    loadMultipleTaskNotifications, 
    getTaskNotification, 
    markTaskAsViewed 
  } = useTaskNotifications();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    selectedAssignees: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: '',
    assignToAll: false,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

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
      fetchTasks();
      fetchEmployees();
    }
  }, [user, role, roleLoading, navigate]);

  const fetchTasks = async () => {
    try {
      if (!user) return;

      // First, get task IDs where the user is either the assigner or a follower
      const { data: assignedTasks, error: assignedError } = await supabase
        .from('tasks')
        .select('id')
        .eq('assigned_by', user.id);

      if (assignedError) {
        // Check if it's a table doesn't exist error
        if (assignedError.message?.includes('relation "tasks" does not exist') || 
            assignedError.message?.includes('relation "public.tasks" does not exist')) {
          console.log('Tasks table not found. Please run the database setup script.');
          setTasks([]);
          return;
        }
        throw assignedError;
      }

      // Get tasks where user is a follower
      const { data: followedTasks, error: followedError } = await supabase
        .from('task_followers')
        .select('task_id')
        .eq('user_id', user.id);

      if (followedError) {
        console.error('Error fetching followed tasks:', followedError);
        // Don't throw here, just log and continue with assigned tasks
      }

      // Combine all task IDs (remove duplicates)
      const allTaskIds = [
        ...(assignedTasks?.map(t => t.id) || []),
        ...(followedTasks?.map(t => t.task_id) || [])
      ];
      const uniqueTaskIds = [...new Set(allTaskIds)];

      // Now fetch the full task data for all these tasks
      let tasksData: any[] | null = [];
      let tasksError: any = null;
      if (uniqueTaskIds.length > 0) {
        const res = await supabase
          .from('tasks')
          .select('*')
          .in('id', uniqueTaskIds)
          .order('created_at', { ascending: false });
        tasksData = res.data as any[] | null;
        tasksError = res.error;
      }

      if (tasksError) {
        throw tasksError;
      }

      // If we have tasks, fetch the profile information separately
      if (tasksData && tasksData.length > 0) {
        const userIds = [...new Set([
          ...tasksData.map(task => task.assigned_to),
          ...tasksData.map(task => task.assigned_by)
        ])];
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        // Combine the data
        const tasksWithProfiles = tasksData.map((task): any => ({
          ...task,
          assigned_to_profile: profilesData?.find(profile => profile.id === task.assigned_to),
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
    if (!formData.assignToAll && formData.selectedAssignees.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one employee or check "Assign to all employees".',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      if (editingTask) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title,
            description: formData.description || null,
            assigned_to: formData.selectedAssignees[0] || formData.assigned_to, // Keep first assignee as primary
            priority: formData.priority,
            due_date: formData.due_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTask.id);

        if (error) throw error;

        // Update task_assignees
        if (formData.selectedAssignees.length > 0) {
          // Remove existing assignees
          await (supabase as any).from('task_assignees').delete().eq('task_id', editingTask.id);
          
          // Add new assignees
          const assigneeData = formData.selectedAssignees.map(userId => ({
            task_id: editingTask.id,
            user_id: userId
          }));
          
          const { error: assigneeError } = await (supabase as any)
            .from('task_assignees')
            .insert(assigneeData);
          
          if (assigneeError) throw assigneeError;
        }

        toast({
          title: 'Task updated',
          description: 'Task has been updated successfully.',
        });
      } else {
        // Create new task(s)
        const assignees = formData.assignToAll ? employees.map(e => e.id) : formData.selectedAssignees;
        
        if (assignees.length === 1) {
          // Create single task with multiple assignees
          const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .insert({
              title: formData.title,
              description: formData.description || null,
              assigned_to: assignees[0], // Primary assignee
              assigned_by: user?.id,
              priority: formData.priority,
              due_date: formData.due_date || null,
            })
            .select()
            .single();

          if (taskError) throw taskError;

          // Add all assignees to task_assignees table
          const assigneeData = assignees.map(userId => ({
            task_id: taskData.id,
            user_id: userId
          }));
          
          const { error: assigneeError } = await (supabase as any)
            .from('task_assignees')
            .insert(assigneeData);
          
          if (assigneeError) throw assigneeError;

          // Upload files if any were selected
          if (selectedFiles.length > 0) {
            await uploadFilesToTask(taskData.id);
          }

          toast({
            title: 'Task created',
            description: `Task has been created with ${assignees.length} assignee(s).`,
          });
        } else {
          // Create separate task for each assignee (legacy behavior for "assign to all")
          const taskData = assignees.map(assigneeId => ({
            title: formData.title,
            description: formData.description || null,
            assigned_to: assigneeId,
            assigned_by: user?.id,
            priority: formData.priority,
            due_date: formData.due_date || null,
          }));

          const { data: createdTasks, error: taskError } = await supabase
            .from('tasks')
            .insert(taskData)
            .select();

          if (taskError) throw taskError;

          // Add assignees to task_assignees table for each task
          const assigneeData = createdTasks.flatMap(task => 
            assignees.map(userId => ({
              task_id: task.id,
              user_id: userId
            }))
          );
          
          const { error: assigneeError } = await (supabase as any)
            .from('task_assignees')
            .insert(assigneeData);
          
          if (assigneeError) throw assigneeError;

          // Upload files to all created tasks if any were selected
          if (selectedFiles.length > 0) {
            for (const task of createdTasks) {
              await uploadFilesToTask(task.id);
            }
          }

          toast({
            title: 'Tasks created',
            description: `Task has been created for ${assignees.length} employees.`,
          });
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchTasks();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (task: Task) => {
    setEditingTask(task);
    
    // Load existing assignees for this task
    const { data: assignees } = await (supabase as any)
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', task.id);
    
    const assigneeIds = assignees?.map((a: any) => a.user_id) || [task.assigned_to];
    
    setFormData({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to,
      selectedAssignees: assigneeIds,
      priority: task.priority,
      due_date: task.due_date || '',
      assignToAll: false,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (task: Task) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Task deleted',
        description: 'Task has been deleted successfully.',
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

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assigned_to: '',
      selectedAssignees: [],
      priority: 'medium',
      due_date: '',
      assignToAll: false,
    });
    setSelectedFiles([]);
    setEditingTask(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToTask = async (taskId: string) => {
    if (selectedFiles.length === 0) return;

    setUploadingFiles(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      for (const file of selectedFiles) {
        const path = `${user.user.id}/${taskId}/${Date.now()}_${file.name}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: '3600'
          });

        if (uploadError) {
          console.error('Error uploading file:', file.name, uploadError);
          continue;
        }

        // Save to database
        const { error: dbError } = await (supabase as any).from('task_attachments').insert({
          task_id: taskId,
          uploaded_by: user.user.id,
          file_name: file.name,
          file_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });

        if (dbError) {
          console.error('Error saving file info:', file.name, dbError);
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Error',
        description: 'Some files failed to upload. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingFiles(false);
    }
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Task Manager</h1>
            <p className="text-muted-foreground">Create, assign, and manage tasks for employees</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </DialogTitle>
                <DialogDescription>
                  {editingTask
                    ? 'Update task details and assignment'
                    : 'Assign a new task to an employee or all employees'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Enter task title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>

                {/* Assign to all employees checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="assignToAll"
                    checked={formData.assignToAll}
                    onCheckedChange={(checked) => {
                      setFormData({ 
                        ...formData, 
                        assignToAll: checked as boolean,
                        selectedAssignees: checked ? employees.map(e => e.id) : [] // Select all employees when checked
                      });
                    }}
                  />
                  <Label htmlFor="assignToAll" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Assign to all employees ({employees.length} employees)
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignees">
                    Select Assignees {formData.assignToAll && <span className="text-muted-foreground">(all selected)</span>}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                    {employees.map((employee) => (
                      <div key={employee.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`assignee-${employee.id}`}
                          checked={formData.selectedAssignees.includes(employee.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                selectedAssignees: [...formData.selectedAssignees, employee.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                selectedAssignees: formData.selectedAssignees.filter(id => id !== employee.id)
                              });
                            }
                          }}
                          disabled={formData.assignToAll}
                        />
                        <Label 
                          htmlFor={`assignee-${employee.id}`} 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {employee.name} {employee.designation && `(${employee.designation})`}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.selectedAssignees.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {formData.selectedAssignees.length} assignee(s) selected
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date (optional)</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                {/* File Upload Section */}
                <div className="space-y-2">
                  <Label htmlFor="attachments">Attachments (optional)</Label>
                  <div className="space-y-3">
                    <Input
                      id="attachments"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                      accept="image/*,application/pdf,text/*,application/*,video/*,audio/*"
                    />
                    
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Selected Files:</Label>
                        <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-gray-500" />
                                <span className="truncate">{file.name}</span>
                                <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFile(index)}
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || uploadingFiles}>
                    {uploadingFiles 
                      ? 'Uploading files...' 
                      : loading 
                        ? 'Saving...' 
                        : editingTask 
                          ? 'Update Task' 
                          : formData.assignToAll 
                            ? `Create Tasks for All (${employees.length})` 
                            : 'Create Task'
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tasks</CardTitle>
            <CardDescription>Create, assign, and manage tasks for your team</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Assigned</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setDetailTaskId(task.id); markTaskAsViewed(task.id); }}>
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
                      <div>
                        <p className="font-medium">{task.assigned_to_profile?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.assigned_to_profile?.email}
                        </p>
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
                        <span className="capitalize">{task.status.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(task.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(task)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(task)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {tasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div>
                  <p>No tasks found</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <TaskDetailDialog
        taskId={detailTaskId}
        open={!!detailTaskId}
        onOpenChange={(open) => setDetailTaskId(open ? detailTaskId : null)}
      />
    </Layout>
  );
}


// Dialog mount
// Placed after main return to avoid large diff; using portal via Dialog
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TaskDetailDialogMount({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  return null;
}
