import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle, User, Calendar, Paperclip, MessageSquare, Bell, ListChecks, Play, StopCircle, ArrowUp, ArrowDown
} from 'lucide-react';

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  last_updated: string;
  assigned_to: string;
  assigned_by: string;
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
  assigned_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  assignee_user_id?: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
}

interface Assignee {
  id: string;
  user_id: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Follower {
  id: string;
  user_id: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ChecklistItem {
  id: string;
  content: string;
  is_done: boolean;
  sort_order: number;
  created_by: string;
}

interface Timer {
  id: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
}

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  const { toast } = useToast();
  const isAdminOrManager = role === 'admin' || role === 'manager';

  const [task, setTask] = useState<Task | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  
  // Check if current user is assigned to this task (primary or additional assignee)
  const isAssignedToTask = task && user && (
    task.assigned_to === user.id || 
    (assignees && assignees.some(a => a.user_id === user.id))
  );
  
  // Check if current user can manage this task (admin, manager, or assigned to task)
  const canManageTask = isAdminOrManager || isAssignedToTask || (task && user && task.assigned_by === user.id);
  
  // Check if current user can view this task (admin, manager, assigned to task, or follower)
  const canViewTask = isAdminOrManager || isAssignedToTask || (followers && followers.some(f => f.user_id === user?.id));
  
  // For now, let's make comments and attachments visible to everyone who can see the task
  // This ensures additional assignees can see them even if the assignees array isn't loaded yet
  const canSeeCommentsAndAttachments = isAdminOrManager || (task && user && task.assigned_to === user.id) || (assignees && assignees.some(a => a.user_id === user?.id)) || (followers && followers.some(f => f.user_id === user?.id));
  
  // Debug logging
  useEffect(() => {
    if (task && user) {
      console.log('TaskDetailDialog Access Debug:', {
        userId: user.id,
        taskAssignedTo: task.assigned_to,
        isPrimaryAssignee: task.assigned_to === user.id,
        assignees: assignees.map(a => a.user_id),
        isAdditionalAssignee: assignees.some(a => a.user_id === user.id),
        isAssignedToTask,
        canManageTask,
        canViewTask,
        isAdminOrManager
      });
    }
  }, [task, user, assignees, isAssignedToTask, canManageTask, canViewTask, isAdminOrManager]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAssignee, setCommentAssignee] = useState<string>('ALL');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingZip, setGeneratingZip] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [editingChecklistItem, setEditingChecklistItem] = useState<string | null>(null);
  const [editingChecklistContent, setEditingChecklistContent] = useState<string>('');
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminder, setNewReminder] = useState<string>('');
  const [userSeconds, setUserSeconds] = useState<number>(0);
  const [runningTimer, setRunningTimer] = useState<Timer | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (!taskId || !open) return;
    console.log('Loading task data for taskId:', taskId);
    void loadTask();
    void loadComments();
    void loadAttachments();
    void loadAssignees();
    void loadFollowers();
    void loadUsers();
    void loadChecklist();
    void loadReminders();
    void loadUserTime();
    void loadRunningTimer();
  }, [taskId, open]);

  // Debug: Log comments whenever they change
  useEffect(() => {
    console.log('Comments state updated:', comments);
  }, [comments]);

  async function loadTask() {
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();
      
      if (taskError) {
        console.error('Error loading task:', taskError);
      }
      let effectiveTask = taskData;
      // Fallback for followers: try RPC if direct select returned null due to RLS or timing
      if (!effectiveTask) {
        const { data: followed } = await supabase.rpc('get_followed_tasks');
        effectiveTask = (followed as any[])?.find((t: any) => t.id === taskId) as any;
        if (!effectiveTask) {
          setTask(null);
          return;
        }
      }

      // Get assigned user details
      const { data: assignedUser } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', effectiveTask.assigned_to)
        .single();

      // Get assigned by user details
      const { data: assignedByUser } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', effectiveTask.assigned_by)
        .single();

      const taskWithUsers = {
        ...effectiveTask,
        assigned_user: assignedUser,
        assigned_by_user: assignedByUser
      };

      console.log('Task loaded:', taskWithUsers);
      setTask(taskWithUsers);
    } catch (err) {
      console.error('Error in loadTask:', err);
      setTask(null);
    }
  }

  async function updateTaskStatus(newStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
    if (!task || !canManageTask) return;
    try {
      const update: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'completed') {
        update.completed_at = new Date().toISOString();
      } else if (task.completed_at) {
        update.completed_at = null;
      }
      const { error } = await supabase.from('tasks').update(update).eq('id', task.id);
      if (error) {
        console.error('Error updating task status:', error);
        alert('Failed to update status');
        return;
      }
      await loadTask();
    } catch (e) {
      console.error('Error in updateTaskStatus:', e);
    }
  }

  async function updateTaskPriority(newPriority: 'low' | 'medium' | 'high' | 'urgent') {
    if (!task || !canManageTask) {
      console.log('Cannot update priority - task:', !!task, 'canManageTask:', canManageTask);
      return;
    }
    
    // Debug: Check user permissions
    const { data: userData } = await supabase.auth.getUser();
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData?.user?.id)
      .maybeSingle();
    
    console.log('Updating task priority:', { 
      taskId: task.id, 
      currentPriority: task.priority, 
      newPriority,
      userId: userData?.user?.id,
      userRole: roleData?.role,
      isAssignedTo: task.assigned_to === userData?.user?.id,
      isCreator: task.assigned_by === userData?.user?.id
    });
    
    // Optimistically update the local state
    setTask({ ...task, priority: newPriority, updated_at: new Date().toISOString() });
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          priority: newPriority, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', task.id)
        .select();
      
      if (error) {
        console.error('Error updating task priority:', error);
        // Revert optimistic update on error
        await loadTask();
        toast({
          title: 'Error',
          description: 'Failed to update priority: ' + error.message,
          variant: 'destructive',
        });
        return;
      }
      
      if (!data || data.length === 0) {
        console.error('Update returned no rows - check RLS permissions');
        // Revert optimistic update
        await loadTask();
        toast({
          title: 'Error',
          description: 'Failed to update priority: No rows updated. You may not have permission.',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Priority update successful:', data[0]);
      
      // Merge the updated task data with existing user info to preserve assigned_user and assigned_by_user
      const updatedTask = {
        ...task,
        ...data[0],
        assigned_user: task.assigned_user,
        assigned_by_user: task.assigned_by_user
      };
      
      // Update local state with merged data
      setTask(updatedTask);
      
      toast({
        title: 'Priority updated',
        description: `Task priority changed to ${newPriority}.`,
      });
    } catch (e) {
      console.error('Error in updateTaskPriority:', e);
      // Revert optimistic update on error
      await loadTask();
      toast({
        title: 'Error',
        description: 'Failed to update priority: ' + (e instanceof Error ? e.message : 'Unknown error'),
        variant: 'destructive',
      });
    }
  }

  async function updateTaskDueDate(newDueDate: string | null) {
    if (!task || !canManageTask) return;
    try {
      const { error } = await supabase.from('tasks').update({ 
        due_date: newDueDate, 
        updated_at: new Date().toISOString() 
      }).eq('id', task.id);
      if (error) {
        console.error('Error updating task due date:', error);
        alert('Failed to update due date');
        return;
      }
      await loadTask();
    } catch (e) {
      console.error('Error in updateTaskDueDate:', e);
    }
  }

  function formatSeconds(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function getUserLabelById(userId?: string) {
    if (!userId) return 'Unknown user';
    const u = (allUsers || []).find((u: any) => u.id === userId);
    return u?.name || u?.email || 'Unknown user';
  }

  async function loadUserTime() {
    if (!taskId) return;
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data, error } = await supabase
        .from('task_timers')
        .select('duration_minutes')
        .eq('task_id', taskId)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('Error loading user time:', error);
        setUserSeconds(0);
        return;
      }

      // Calculate total seconds from all timer records
      const totalMinutes = data?.reduce((sum, timer) => sum + (timer.duration_minutes || 0), 0) || 0;
      setUserSeconds(totalMinutes * 60);
    } catch (err) {
      console.error('Error loading user time:', err);
      setUserSeconds(0);
    }
  }

  async function loadRunningTimer() {
    if (!taskId) return;
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      
      const { data } = await supabase
        .from('task_timers')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.user.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setRunningTimer(data);
    } catch (err) {
      console.error('Error loading running timer:', err);
    }
  }

  async function toggleTimer() {
    if (runningTimer) {
      await stopTimer();
    } else {
      await startTimer();
    }
  }

  async function startTimer() {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user || !taskId) return;
      
      const { error } = await supabase.from('task_timers').insert({
        task_id: taskId, 
        user_id: userRes.user.id, 
        start_time: new Date().toISOString() 
      });
      
      if (error) {
        console.error('Error starting timer:', error);
        alert(`Failed to start timer: ${error.message}`);
        return;
      }
      
      void loadRunningTimer();
      void loadUserTime();
    } catch (err) {
      console.error('Error in startTimer:', err);
      alert(`Failed to start timer: ${err}`);
    }
  }

  async function stopTimer() {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user || !taskId || !runningTimer) return;
      
      const { error } = await supabase
        .from('task_timers')
        .update({ end_time: new Date().toISOString() })
        .eq('id', runningTimer.id);
      
      if (error) {
        console.error('Error stopping timer:', error);
        alert(`Failed to stop timer: ${error.message}`);
        return;
      }
      
      setRunningTimer(null);
      void loadUserTime();
    } catch (err) {
      console.error('Error in stopTimer:', err);
      alert(`Failed to stop timer: ${err}`);
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      console.log('Loading comments for taskId:', taskId);
      
      // First, get all comments for this task
      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }); // Show oldest first for thread-like display
      
      if (commentsError) {
        console.error('Error loading comments:', commentsError);
        setComments([]);
        return;
      }

      console.log('Raw comments data:', commentsData);

      if (!commentsData || commentsData.length === 0) {
        console.log('No comments found for this task');
        setComments([]);
        return;
      }

      // Get unique author IDs
      const authorIds = [...new Set(commentsData.map(c => c.author_id).filter(Boolean))];
      console.log('Author IDs to fetch:', authorIds);
      
      // Fetch author profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', authorIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      console.log('Profiles data:', profilesData);

      // Combine comments with author data
      const commentsWithAuthors = commentsData.map(comment => ({
        ...comment,
        author: profilesData?.find(profile => profile.id === comment.author_id) || {
          id: comment.author_id,
          name: 'Unknown User',
          email: 'unknown@example.com'
        }
      }));

      console.log('Final comments with authors:', commentsWithAuthors);
      setComments(commentsWithAuthors);
    } catch (err) {
      console.error('Error in loadComments:', err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function addComment() {
    if (!newComment.trim() || !taskId) return;
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        alert('You must be logged in to add comments');
        return;
      }
      
      console.log('Adding comment:', { taskId, userId: user?.user?.id, content: newComment.trim(), assignee: commentAssignee });
      
      // Build comment data object
      const commentData: any = {
        task_id: taskId,
        author_id: user?.user?.id,
        content: newComment.trim(),
      };
      
      // Only add assignee_user_id if it's not 'ALL'
      if (commentAssignee !== 'ALL') {
        commentData.assignee_user_id = commentAssignee;
      }
      
      const { error } = await supabase.from('task_comments').insert(commentData);
      
      if (error) {
        console.error('Error adding comment:', error);
        alert(`Failed to add comment: ${error.message}`);
        return;
      }
      
      console.log('Comment added successfully');
      setNewComment('');
      void loadComments();
    } catch (err) {
      console.error('Error in addComment:', err);
      alert(`Failed to add comment: ${err}`);
    }
  }

  async function loadAttachments() {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading attachments:', error);
      }
      console.log('Loaded attachments:', data);
      setAttachments(data || []);
    } catch (err) {
      console.error('Error in loadAttachments:', err);
      setAttachments([]);
    }
  }

  async function loadAssignees() {
    try {
      console.log('Loading assignees for task:', taskId);
      const { data, error } = await supabase
        .from('task_assignees')
        .select('id, user_id, assigned_at')
        .eq('task_id', taskId)
        .order('assigned_at', { ascending: false });
      
      if (error) {
        console.error('Error loading assignees:', error);
        setAssignees([]);
        return;
      }
      
      console.log('Raw assignees data from DB:', data);

      // Get user details for each assignee
      const assigneesWithUsers = await Promise.all(
        (data || []).map(async (assignee) => {
          const { data: user } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', assignee.user_id)
            .single();
          
          return {
            ...assignee,
            user
          };
        })
      );

      // Ensure primary assignee is in the list
      if (task?.assigned_to) {
        const primaryAssigneeExists = assigneesWithUsers.some(a => a.user_id === task.assigned_to);
        if (!primaryAssigneeExists) {
          // Add primary assignee to the list
          const { data: primaryUser } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', task.assigned_to)
            .single();
          
          if (primaryUser) {
            assigneesWithUsers.unshift({
              id: `primary-${task.assigned_to}`,
              user_id: task.assigned_to,
              assigned_at: task.created_at,
              user: primaryUser
            });
          }
        }
      }

      // Filter out the assigned_by user from assignees list 
      // Task creators should only be shown in "Assigned By" section, not as assignees
      const filteredAssignees = assigneesWithUsers.filter(a => a.user_id !== task?.assigned_by);
      
      console.log('Loaded assignees (filtered):', filteredAssignees);

      setAssignees(filteredAssignees);
    } catch (err) {
      console.error('Error in loadAssignees:', err);
      setAssignees([]);
    }
  }

  async function loadFollowers() {
    try {
      const { data, error } = await supabase
        .from('task_followers')
        .select('id, user_id, followed_at')
        .eq('task_id', taskId)
        .order('followed_at', { ascending: false });
      
      if (error) {
        console.error('Error loading followers:', error);
        setFollowers([]);
        return;
      }

      // Get user details for each follower
      const followersWithUsers = await Promise.all(
        (data || []).map(async (follower) => {
          const { data: user } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', follower.user_id)
            .single();
          
          return {
            ...follower,
            user
          };
        })
      );

      setFollowers(followersWithUsers);
    } catch (err) {
      console.error('Error in loadFollowers:', err);
      setFollowers([]);
    }
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('id, name, email').order('name');
    setAllUsers(data || []);
  }

  async function loadChecklist() {
    const { data } = await supabase
      .from('task_checklist')
      .select('*')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });
    setChecklist(data || []);
  }

  async function loadReminders() {
    const { data } = await supabase
      .from('task_reminders')
      .select('*')
      .eq('task_id', taskId)
      .order('remind_at', { ascending: true });
    setReminders(data || []);
  }

  async function addReminder() {
    if (!taskId || !newReminder.trim()) return;
    
    const { error } = await supabase
      .from('task_reminders')
      .insert({
        task_id: taskId,
        note: newReminder.trim(),
        remind_at: new Date().toISOString(),
        created_by: user?.id
      });
    
    if (error) {
      console.error('Error adding reminder:', error);
      toast({
        title: 'Error',
        description: 'Failed to add reminder',
        variant: 'destructive',
      });
    } else {
      setNewReminder('');
      void loadReminders();
      toast({
        title: 'Success',
        description: 'Reminder added successfully',
      });
    }
  }

  async function removeReminder(id: string) {
    const { error } = await supabase
      .from('task_reminders')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error removing reminder:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove reminder',
        variant: 'destructive',
      });
    } else {
      void loadReminders();
      toast({
        title: 'Success',
        description: 'Reminder removed successfully',
      });
    }
  }

  async function addChecklistItem() {
    if (!taskId) return;
    const { error } = await supabase.from('task_checklist').insert({
      task_id: taskId,
      content: 'New checklist item',
      created_by: (await supabase.auth.getUser()).data.user?.id,
      sort_order: checklist.length
    });
    if (error) console.error('Error adding checklist item:', error);
    else void loadChecklist();
  }

  async function toggleChecklist(item: ChecklistItem) {
    const { error } = await supabase.from('task_checklist').update({ is_done: !item.is_done }).eq('id', item.id);
    if (error) console.error('Error toggling checklist item:', error);
    else void loadChecklist();
  }

  async function moveChecklist(item: ChecklistItem, direction: 'up' | 'down') {
    const currentIndex = checklist.findIndex(i => i.id === item.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= checklist.length) return;
    
    const newOrder = [...checklist];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    
    // Update sort_order for both items
    await supabase.from('task_checklist').update({ sort_order: currentIndex }).eq('id', newOrder[currentIndex].id);
    await supabase.from('task_checklist').update({ sort_order: newIndex }).eq('id', newOrder[newIndex].id);
    
    void loadChecklist();
  }

  async function deleteChecklist(id: string) {
    const { error } = await supabase.from('task_checklist').delete().eq('id', id);
    if (error) console.error('Error deleting checklist item:', error);
    else void loadChecklist();
  }

  function startEditingChecklistItem(item: ChecklistItem) {
    setEditingChecklistItem(item.id);
    setEditingChecklistContent(item.content);
  }

  function cancelEditingChecklistItem() {
    setEditingChecklistItem(null);
    setEditingChecklistContent('');
  }

  async function saveChecklistItemEdit(itemId: string) {
    if (!editingChecklistContent.trim()) {
      cancelEditingChecklistItem();
      return;
    }

    const { error } = await supabase
      .from('task_checklist')
      .update({ content: editingChecklistContent.trim() })
      .eq('id', itemId);
    
    if (error) {
      console.error('Error updating checklist item:', error);
    } else {
      void loadChecklist();
    }
    
    cancelEditingChecklistItem();
  }

  function handleChecklistKeyDown(e: React.KeyboardEvent, itemId: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void saveChecklistItemEdit(itemId);
    } else if (e.key === 'Escape') {
      cancelEditingChecklistItem();
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !taskId) return;

    try {
      const { data: authRes } = await supabase.auth.getUser();
      if (!authRes?.user) {
        alert('You must be logged in to upload files');
        return;
      }

      setUploading(true);

      const uploads = Array.from(files).map(async (file) => {
        const path = `${authRes.user.id}/${taskId}/${Date.now()}_${file.name}`;

        const { error: upErr } = await supabase.storage
          .from('task-attachments')
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: '3600'
          });

        if (upErr) {
          console.error('Storage upload error:', upErr);
          throw new Error(`Failed to upload ${file.name}: ${upErr.message}`);
        }

        const attachmentData = {
          task_id: taskId,
          uploaded_by: authRes.user.id,
          file_name: file.name,
          file_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        };

        const { error: dbErr } = await supabase.from('task_attachments').insert(attachmentData);
        if (dbErr) {
          console.error('Database insert error:', dbErr);
          console.error('Attachment data:', attachmentData);
          throw new Error(`Failed to save ${file.name}: ${dbErr.message}`);
        }
      });

      const results = await Promise.allSettled(uploads);
      const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length > 0) {
        alert(`Some files failed to upload:\n${failures.map(f => f.reason?.message || String(f.reason)).join('\n')}`);
      }

      await loadAttachments();
    } catch (err: any) {
      console.error('Error in onFileChange:', err);
      alert(`Failed to upload files: ${err?.message || err}`);
    } finally {
      setUploading(false);
      e.currentTarget.value = '';
    }
  }

  async function getFileUrl(filePath: string) {
    const { data } = await supabase.storage.from('task-attachments').createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  }

  async function downloadAllAsZip() {
    if (attachments.length === 0) return;
    setGeneratingZip(true);
    try {
      const zip = new JSZip();
      for (const attachment of attachments) {
        const url = await getFileUrl(attachment.file_path);
        if (url) {
          const response = await fetch(url);
          const blob = await response.blob();
          zip.file(attachment.file_name, blob);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `task-${taskId}-attachments.zip`;
      link.click();
    } catch (err) {
      console.error('Error generating zip:', err);
      alert(`Failed to generate zip: ${err}`);
    } finally {
      setGeneratingZip(false);
    }
  }

  async function addAssignee(userId: string) {
    if (!taskId) return;
    
    // Don't add if it's the primary assignee (already in the list)
    if (userId === task?.assigned_to) {
      toast({
        title: 'Info',
        description: 'This person is already the primary assignee',
        variant: 'default',
      });
      return;
    }
    
    // Don't add if it's the assigned_by user
    if (userId === task?.assigned_by) {
      toast({
        title: 'Info',
        description: 'Cannot add the task creator as an assignee',
        variant: 'default',
      });
      return;
    }
    
    // Don't add if already in assignees list
    if (assignees.some(a => a.user_id === userId)) {
      toast({
        title: 'Info',
        description: 'This person is already assigned to this task',
        variant: 'default',
      });
      return;
    }
    
    const { error } = await supabase.from('task_assignees').insert({ task_id: taskId, user_id: userId });
    if (error) {
      console.error('Error adding assignee:', error);
      toast({
        title: 'Error',
        description: 'Failed to add assignee',
        variant: 'destructive',
      });
    } else {
      void loadAssignees();
      toast({
        title: 'Success',
        description: 'Assignee added successfully',
      });
    }
  }

  async function removeAssignee(id: string) {
    // Find the assignee to check if it's the primary assignee
    const assigneeToRemove = assignees.find(a => a.id === id);
    if (assigneeToRemove && assigneeToRemove.user_id === task?.assigned_to) {
      toast({
        title: 'Cannot Remove',
        description: 'Cannot remove the primary assignee from this task',
        variant: 'destructive',
      });
      return;
    }
    
    const { error } = await supabase.from('task_assignees').delete().eq('id', id);
    if (error) {
      console.error('Error removing assignee:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove assignee',
        variant: 'destructive',
      });
    } else {
      void loadAssignees();
      toast({
        title: 'Success',
        description: 'Assignee removed successfully',
      });
    }
  }

  async function addFollower(userId: string) {
    if (!taskId) return;
    const { error } = await supabase.from('task_followers').insert({ task_id: taskId, user_id: userId });
    if (error) console.error('Error adding follower:', error);
    else void loadFollowers();
  }

  async function removeFollower(id: string) {
    const { error } = await supabase.from('task_followers').delete().eq('id', id);
    if (error) console.error('Error removing follower:', error);
    else void loadFollowers();
  }

  async function removeAttachment(attachmentId: string, filePath: string) {
    if (!canManageTask) {
      toast({
        title: 'Access Denied',
        description: 'Only admins, managers, or assigned users can remove attachments',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to remove this attachment? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([filePath]);

      if (storageError) {
        console.error('Error removing file from storage:', storageError);
        alert('Failed to remove file from storage');
        return;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) {
        console.error('Error removing attachment from database:', dbError);
        alert('Failed to remove attachment from database');
        return;
      }

      toast({
        title: 'Success',
        description: 'Attachment removed successfully',
      });

      void loadAttachments();
    } catch (error) {
      console.error('Error removing attachment:', error);
      alert('Failed to remove attachment');
    }
  }

  if (!task) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] p-0 overflow-hidden">
          <div className="p-6">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] p-0 overflow-hidden flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] flex-1 overflow-hidden min-h-0">
          {/* Left: main content */}
          <div className="p-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
              <Badge className="text-xs capitalize">{task.status || 'in progress'}</Badge>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="text-gray-600">Created • {new Date(task.created_at).toLocaleString()}</div>
              {task.status === 'completed' && task.completed_at && (
                <div className="text-gray-600">Completed • {new Date(task.completed_at).toLocaleString()}</div>
              )}
              {task.assigned_user && (
                <div className="flex items-center gap-1 text-gray-600">
                  <User className="h-3 w-3" />
                  <span>Assigned to {task.assigned_user.name || task.assigned_user.email}</span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm" 
                  variant={runningTimer ? "destructive" : "default"}
                  onClick={() => void toggleTimer()} 
                  disabled={!user}
                  className="bg-red-600 hover:bg-red-700 text-white [&_svg]:text-white"
                >
                  {runningTimer ? '⏹️ Stop Timer' : '⏵️ Start Timer'}
                </Button>
                {runningTimer && (
                  <div className="text-xs text-gray-600">
                    Running since {new Date(runningTimer.start_time).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            <hr className="my-4" />
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-gray-900">Description</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{task.description || 'No description for this task'}</div>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Checklist Items</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-700 hover:text-gray-900 [&_svg]:text-gray-700" onClick={() => void addChecklistItem()}>+</Button>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2 pr-2">
                {checklist.length === 0 && (
                  <div className="text-sm text-gray-600">Checklist items not found for this task</div>
                )}
                {checklist.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={!!item.is_done} 
                      onChange={() => void toggleChecklist(item)} 
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      {editingChecklistItem === item.id ? (
                        <Input
                          value={editingChecklistContent}
                          onChange={(e) => setEditingChecklistContent(e.target.value)}
                          onKeyDown={(e) => handleChecklistKeyDown(e, item.id)}
                          onBlur={() => void saveChecklistItemEdit(item.id)}
                          className="h-6 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className={`cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded ${item.is_done ? 'line-through text-gray-600' : 'text-gray-900'}`}
                          onClick={() => startEditingChecklistItem(item)}
                        >
                          {item.content}
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900 [&_svg]:text-gray-700" 
                        onClick={() => void moveChecklist(item, 'up')} 
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900 [&_svg]:text-gray-700" 
                        onClick={() => void moveChecklist(item, 'down')} 
                        disabled={i === checklist.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700" 
                        onClick={() => void deleteChecklist(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-gray-900">Attachments</h3>
              <div className="space-y-3">
                {attachments.length > 0 && (
                  <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
                    {Object.entries(
                      attachments.reduce((acc: Record<string, Attachment[]>, a) => {
                        (acc[a.uploaded_by] ||= []).push(a);
                        return acc;
                      }, {})
                    ).map(([uploaderId, items]) => (
                      <div key={uploaderId} className="space-y-2">
                        <div className="text-xs font-medium text-gray-600">
                          Uploaded by: {getUserLabelById(uploaderId)}
                        </div>
                        {items.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                <Paperclip className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium break-all text-gray-900">{a.file_name}</div>
                                <div className="text-xs text-gray-600">
                                  {(a.size_bytes / 1024).toFixed(1)} KB · {new Date(a.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <AttachmentLink fileName={a.file_name} filePath={a.file_path} />
                              {canManageTask && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => removeAttachment(a.id, a.file_path)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <Input 
                    type="file" 
                    onChange={onFileChange} 
                    disabled={uploading} 
                    className="hidden" 
                    id="file-upload"
                    multiple
                  />
                  <label
                    htmlFor="file-upload" 
                    className="flex-1 cursor-pointer border border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 text-gray-700"
                  >
                    {uploading ? 'Uploading…' : 'Click to upload files or drag and drop'}
                  </label>
                  {attachments.length > 0 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => void downloadAllAsZip()} 
                      className="text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700"
                    >
                      Download all as ZIP
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <hr className="my-4" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Comments & Discussion</h3>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => void loadComments()}
                  disabled={loadingComments}
                  className="text-xs text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700"
                >
                  {loadingComments ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto border rounded-lg p-4 bg-gray-50 pr-2">
                {loadingComments ? (
                  <div className="text-sm text-gray-600 text-center py-4">
                    Loading comments...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-sm text-gray-600 text-center py-4">
                    No comments yet. Start the discussion!
                  </div>
                ) : (
                  comments.map((c, index) => {
                    const isConsecutive = index > 0 && comments[index - 1].author_id === c.author_id;
                    const timeDiff = index > 0 ? 
                      new Date(c.created_at).getTime() - new Date(comments[index - 1].created_at).getTime() : 
                      Infinity;
                    const isSameMinute = timeDiff < 60000; // Less than 1 minute
                    const showHeader = !isConsecutive || !isSameMinute;
                    
                    return (
                      <div key={c.id} className={`flex gap-3 ${!showHeader ? 'ml-11' : ''}`}>
                        {showHeader && (
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-blue-600">
                              {(c.author?.name || c.author?.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {showHeader && (
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-gray-900 text-sm">
                                {c.author?.name || c.author?.email || 'User'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(c.created_at).toLocaleTimeString()}
                              </div>
                              {c.assignee_user_id && (
                                <div className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                  To: {allUsers.find((u:any) => u.id === c.assignee_user_id)?.name || 'Assignee'}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="text-gray-700 text-sm bg-white rounded-lg px-3 py-2 shadow-sm">
                            {c.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-4 space-y-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <Label htmlFor="comment-input" className="text-sm font-medium text-gray-700 mb-2 block">
                    Add Comment
                  </Label>
                  <Textarea
                    id="comment-input"
                    placeholder="Write your comment here..." 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void addComment(); } }}
                    className="min-h-[80px] resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <select 
                        className="border border-gray-300 rounded px-3 py-1 text-sm text-gray-900 bg-white" 
                        value={commentAssignee} 
                        onChange={(e) => setCommentAssignee(e.target.value)}
                      >
                        <option value="ALL">All assignees</option>
                        {assignees.map((a:any) => (
                          <option key={a.user_id} value={a.user_id}>
                            {a.user?.name || a.user?.email}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="file" 
                        onChange={onFileChange} 
                        disabled={uploading} 
                        className="hidden" 
                        id="comment-file-upload"
                        multiple
                      />
                      <label 
                        htmlFor="comment-file-upload" 
                        className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm"
                      >
                        📎 Attach file
                      </label>
                    </div>
                    <Button 
                      type="button" 
                      onClick={() => void addComment()} 
                      disabled={!newComment.trim() || uploading}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white [&_svg]:text-white"
                    >
                      {uploading ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  Press Enter to post, Shift+Enter for new line
                </div>
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="border-l border-gray-200 p-6 bg-white overflow-y-auto">
            <h4 className="text-sm font-semibold mb-1 text-gray-900">Task Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                {canManageTask ? (
                  <Select value={task.status} onValueChange={(v) => void updateTaskStatus(v as any)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="capitalize text-gray-900">{(task.status || '').replace('_',' ')}</span>
                )}
              </div>
              <div className="flex items-center justify-between"><span className="text-gray-700">Start Date:</span> <span className="text-gray-900">{task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}</span></div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Priority:</span>
                {canManageTask ? (
                  <Select value={task.priority || 'medium'} onValueChange={(v) => void updateTaskPriority(v as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="capitalize text-gray-900">{task.priority || 'medium'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Due Date:</span>
                {canManageTask ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={task.due_date ? task.due_date.split('T')[0] : ''}
                      onChange={(e) => void updateTaskDueDate(e.target.value || null)}
                      className="w-32 h-8 text-xs text-gray-900"
                    />
                    {task.due_date && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        onClick={() => void updateTaskDueDate(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-900">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</span>
                )}
              </div>
              <div className="flex items-center justify-between"><span className="text-gray-700">Your logged time:</span> <span className="text-gray-900 font-medium">{formatSeconds(userSeconds)}</span></div>
            </div>

            {/* Reminders */}
            <div className="mt-5">
              <h4 className="text-sm font-semibold mb-2 text-gray-900">Reminders</h4>
              <div className="space-y-2">
                {reminders.length === 0 ? (
                  <div className="text-xs text-gray-600">No reminders for this task</div>
                ) : (
                  reminders.map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between text-xs bg-yellow-50 border border-yellow-200 rounded p-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{reminder.note}</div>
                        <div className="text-gray-600">
                          {new Date(reminder.remind_at).toLocaleString()}
                        </div>
                      </div>
                      {canManageTask && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          onClick={() => void removeReminder(reminder.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
                {canManageTask && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a reminder..."
                      value={newReminder}
                      onChange={(e) => setNewReminder(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void addReminder();
                        }
                      }}
                      className="text-xs h-8"
                    />
                    <Button
                      size="sm"
                      onClick={() => void addReminder()}
                      disabled={!newReminder.trim()}
                      className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white [&_svg]:text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned By */}
            {task.assigned_by_user && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Assigned By</h4>
                  <span className="text-xs text-gray-600">(Who created this task)</span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs bg-purple-50 border border-purple-200 rounded px-2 py-1 flex items-center gap-2">
                    <User className="h-3 w-3 text-purple-600" />
                    <span className="font-medium text-purple-900">
                      {task.assigned_by_user.name || task.assigned_by_user.email}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Assignees */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Assignees</h4>
                <span className="text-xs text-gray-600">(Who is working on this task)</span>
              </div>
              <div className="space-y-2">
                {assignees.length === 0 ? (
                  <div className="text-xs text-gray-600">No one assigned to this task</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignees.map(a => {
                      const isPrimaryAssignee = a.user_id === task.assigned_to;
                      return (
                        <div key={a.id} className={`text-xs border rounded px-2 py-1 flex items-center gap-2 ${
                          isPrimaryAssignee 
                            ? 'bg-blue-100 border-blue-300' 
                            : 'bg-blue-50 border-blue-200'
                        }`}>
                          <User className={`h-3 w-3 ${isPrimaryAssignee ? 'text-blue-700' : 'text-blue-600'}`} />
                          <span className={`font-medium ${isPrimaryAssignee ? 'text-blue-900' : 'text-blue-900'}`}>
                            {a.user?.name || a.user?.email}
                            {isPrimaryAssignee && <span className="text-xs text-blue-600 ml-1">(Primary)</span>}
                          </span>
                          {canManageTask && !isPrimaryAssignee && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-4 w-4 p-0 text-red-600 hover:text-red-700"
                              onClick={() => void removeAssignee(a.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {canManageTask && (
                  <div className="space-y-1">
                    <select 
                      className="border border-gray-300 rounded px-2 py-1 text-xs w-full h-8 text-gray-900 bg-white" 
                      onChange={(e) => { 
                        const v = e.target.value; 
                        if (v) void addAssignee(v); 
                        e.currentTarget.selectedIndex = 0; 
                      }}
                    >
                      <option value="">Add additional assignee…</option>
                      {allUsers.filter(u => 
                        !assignees.some(a => a.user_id === u.id) && 
                        u.id !== task?.assigned_to &&
                        u.id !== task?.assigned_by
                      ).map((u:any) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-600">Assignees can work on and update this task</div>
                  </div>
                )}
              </div>
            </div>

            {/* Followers */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Followers</h4>
                <span className="text-xs text-gray-600">(Who can track progress)</span>
              </div>
              <div className="space-y-2">
                {followers.length === 0 ? (
                  <div className="text-xs text-gray-600">No one following this task</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {followers.map(f => (
                      <div key={f.id} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1 flex items-center gap-2">
                        <Bell className="h-3 w-3 text-green-600" />
                        <span className="font-medium text-green-900">{f.user?.name || f.user?.email}</span>
                        {canManageTask && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 text-red-600 hover:text-red-700"
                            onClick={() => void removeFollower(f.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canManageTask && (
                  <div className="space-y-1">
                    <select 
                      className="border border-gray-300 rounded px-2 py-1 text-xs w-full h-8 text-gray-900 bg-white" 
                      onChange={(e) => { 
                        const v = e.target.value; 
                        if (v) void addFollower(v); 
                        e.currentTarget.selectedIndex = 0; 
                      }}
                    >
                      <option value="">Add someone to track this task…</option>
                      {allUsers.filter(u => !followers.some(f => f.user_id === u.id)).map((u:any) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-600">Followers can view this task and track its progress</div>
                  </div>
                )}
              </div>
            </div>

            {/* File Upload Dropzone */}
            <div className="mt-6">
              <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center text-sm text-gray-700 bg-gray-50">
                Click to upload files or drag and drop
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for attachment links
function AttachmentLink({ fileName, filePath }: { fileName: string; filePath: string }) {
  const [url, setUrl] = useState<string>('');
  
  useEffect(() => {
    async function getUrl() {
      const { data } = await supabase.storage.from('task-attachments').createSignedUrl(filePath, 3600);
      setUrl(data?.signedUrl || '');
    }
    void getUrl();
  }, [filePath]);

  if (!url) return <Button size="sm" variant="outline" disabled className="text-gray-600">Loading...</Button>;
  
  return (
    <Button size="sm" variant="outline" asChild className="text-gray-700 hover:text-gray-900 border-gray-300 [&_svg]:text-gray-700">
      <a href={url} download={fileName} className="text-gray-700 hover:text-gray-900">
        Download
      </a>
    </Button>
  );
}