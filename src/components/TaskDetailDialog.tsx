import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
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
  created_at: string;
  last_updated: string;
  assigned_to: string;
  assigned_by: string;
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
  const isAdminOrManager = role === 'admin' || role === 'manager';

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAssignee, setCommentAssignee] = useState<string>('ALL');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingZip, setGeneratingZip] = useState(false);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
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
    void loadUserTime();
    void loadRunningTimer();
  }, [taskId, open]);

  // Debug: Log comments whenever they change
  useEffect(() => {
    console.log('Comments state updated:', comments);
  }, [comments]);

  async function loadTask() {
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).single();
      if (error) {
        console.error('Error loading task:', error);
      } else {
        console.log('Task loaded:', data);
      }
      setTask(data);
    } catch (err) {
      console.error('Error in loadTask:', err);
    }
  }

  function formatSeconds(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  async function loadUserTime() {
    if (!taskId) return;
    try {
      const { data } = await supabase
        .from('v_task_time_by_user')
        .select('total_minutes, seconds_spent')
        .eq('task_id', taskId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
        .single();
      
      // Handle both column names for backward compatibility
      const minutes = data?.total_minutes || (data?.seconds_spent ? Math.floor(data.seconds_spent / 60) : 0);
      setUserSeconds(minutes * 60);
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
    const { data } = await supabase
      .from('task_assignees')
      .select('id, user_id, user: user_id (id, name, email)')
      .eq('task_id', taskId)
      .order('assigned_at', { ascending: false });
    setAssignees(data || []);
  }

  async function loadFollowers() {
    const { data } = await supabase
      .from('task_followers')
      .select('id, user_id, user: user_id (id, name, email)')
      .eq('task_id', taskId)
      .order('followed_at', { ascending: false });
    setFollowers(data || []);
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

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !taskId) return;
    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        alert('You must be logged in to upload files');
        setUploading(false);
        return;
      }
      
      console.log('Uploading file:', { fileName: file.name, fileSize: file.size, taskId, userId: user?.user?.id });
      
      // Use a simpler path structure that works better with RLS
      const path = `${user?.user?.id}/${taskId}/${Date.now()}_${file.name}`;
      console.log('Upload path:', path);
      
      const { error: upErr } = await supabase.storage
        .from('task-attachments')
        .upload(path, file, { 
          upsert: false, 
          contentType: file.type,
          cacheControl: '3600'
        });
      
      if (upErr) {
        console.error('Storage upload error:', upErr);
        console.error('Upload details:', { path, fileName: file.name, fileSize: file.size, contentType: file.type });
        alert(`Failed to upload file: ${upErr.message}\n\nDetails: ${JSON.stringify(upErr, null, 2)}`);
        return;
      }
      
      console.log('File uploaded to storage, now saving to database');
      const attachmentData: any = {
        task_id: taskId,
        uploaded_by: user?.user?.id,
        file_name: file.name,
        file_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      };
      
      console.log('Inserting attachment data:', attachmentData);
      const { error: dbErr } = await supabase.from('task_attachments').insert(attachmentData);
      
      if (dbErr) {
        console.error('Database insert error:', dbErr);
        console.error('Attachment data:', attachmentData);
        alert(`Failed to save file info: ${dbErr.message}\n\nDetails: ${JSON.stringify(dbErr, null, 2)}`);
        return;
      }
      
      console.log('File attachment saved successfully');
      void loadAttachments();
    } catch (err) {
      console.error('Error in onFileChange:', err);
      alert(`Failed to upload file: ${err}`);
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
    const { error } = await supabase.from('task_assignees').insert({ task_id: taskId, user_id: userId });
    if (error) console.error('Error adding assignee:', error);
    else void loadAssignees();
  }

  async function removeAssignee(id: string) {
    const { error } = await supabase.from('task_assignees').delete().eq('id', id);
    if (error) console.error('Error removing assignee:', error);
    else void loadAssignees();
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
    if (!isAdminOrManager) {
      alert('Only admins and managers can remove attachments');
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
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <div className="p-6">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr]">
          {/* Left: main content */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{task.title}</h2>
              <Badge className="text-xs capitalize">{(task.status || '').replace('_',' ') || 'in progress'}</Badge>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="text-muted-foreground">Created • {new Date(task.created_at).toLocaleString()}</div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm" 
                  variant={runningTimer ? "destructive" : "default"}
                  onClick={() => void toggleTimer()} 
                  disabled={!user}
                >
                  {runningTimer ? '⏹️ Stop Timer' : '⏵️ Start Timer'}
                </Button>
                {runningTimer && (
                  <div className="text-xs text-muted-foreground">
                    Running since {new Date(runningTimer.start_time).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            <hr className="my-4" />
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description || 'No description for this task'}</div>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Checklist Items</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void addChecklistItem()}>+</Button>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2 pr-2">
                {checklist.length === 0 && (
                  <div className="text-sm text-muted-foreground">Checklist items not found for this task</div>
                )}
                {checklist.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!item.is_done} onChange={() => void toggleChecklist(item)} />
                    <span className={item.is_done ? 'line-through text-muted-foreground' : ''}>{item.content}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => void moveChecklist(item, 'up')} disabled={i===0}>↑</Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => void moveChecklist(item, 'down')} disabled={i===checklist.length-1}>↓</Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => void deleteChecklist(item.id)}>✕</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2">Attachments</h3>
              <div className="space-y-3">
                {attachments.length > 0 && (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                    {attachments.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                            <Paperclip className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{a.file_name}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(a.created_at).toLocaleDateString()} at {new Date(a.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AttachmentLink fileName={a.file_name} filePath={a.file_path} />
                          {isAdminOrManager && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => removeAttachment(a.id, a.file_path)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              title="Remove attachment"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
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
                  />
                  <label
                    htmlFor="file-upload" 
                    className="flex-1 cursor-pointer border border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50"
                  >
                    {uploading ? 'Uploading...' : 'Click to upload files or drag and drop'}
                  </label>
                  {attachments.length > 0 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => void downloadAllAsZip()} 
                      disabled={generatingZip}
                    >
                      {generatingZip ? 'Preparing...' : 'Download All (.zip)'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <hr className="my-4" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Comments & Discussion</h3>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => void loadComments()}
                  disabled={loadingComments}
                  className="text-xs"
                >
                  {loadingComments ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto border rounded-lg p-4 bg-gray-50 pr-2">
                {loadingComments ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Loading comments...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No comments yet. Start the discussion!
                    <div className="text-xs mt-2 text-gray-400">
                      Debug: Task ID: {taskId}
                    </div>
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
                        className="border rounded px-3 py-1 text-sm" 
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
                    >
                      {uploading ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Press Enter to post, Shift+Enter for new line
                </div>
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="border-l p-6 bg-background/50">
            <h4 className="text-sm font-semibold mb-1">Task Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Status:</span> <span className="capitalize">{(task.status || '').replace('_',' ')}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Start Date:</span> <span>{task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Priority:</span> <span className="capitalize">{task.priority || 'medium'}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Your logged time:</span> <span>{formatSeconds(userSeconds)}</span></div>
            </div>

            {/* Reminders */}
            <div className="mt-5">
              <h4 className="text-sm font-semibold">Reminders</h4>
              <div className="text-xs text-muted-foreground">No reminders for this task</div>
            </div>

            {/* Assignees */}
            <div className="mt-5">
              <h4 className="text-sm font-semibold mb-2">Assignees</h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {assignees.map(a => (
                  <div key={a.id} className="text-xs border rounded px-2 py-1 flex items-center gap-2">
                    <span>{a.user?.name || a.user?.email}</span>
                    {isAdminOrManager && (
                      <button type="button" className="text-red-600" onClick={() => void removeAssignee(a.id)}>×</button>
                    )}
                  </div>
                ))}
                {assignees.length === 0 && (<div className="text-xs text-muted-foreground">No assignees</div>)}
              </div>
              {isAdminOrManager && (
              <select className="border rounded px-2 py-1 text-sm w-full" onChange={(e) => { const v = e.target.value; if (v) void addAssignee(v); e.currentTarget.selectedIndex = 0; }}>
                <option value="">Add assignee…</option>
                {allUsers.map((u:any) => (<option key={u.id} value={u.id}>{u.name || u.email}</option>))}
              </select>
              )}
            </div>

            {/* Followers */}
            <div className="mt-5">
              <h4 className="text-sm font-semibold mb-2">Followers</h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {followers.map(f => (
                  <div key={f.id} className="text-xs border rounded px-2 py-1 flex items-center gap-2">
                    <span>{f.user?.name || f.user?.email}</span>
                    {isAdminOrManager && (
                      <button type="button" className="text-red-600" onClick={() => void removeFollower(f.id)}>×</button>
                    )}
                  </div>
                ))}
                {followers.length === 0 && (<div className="text-xs text-muted-foreground">No followers for this task</div>)}
              </div>
              {isAdminOrManager && (
              <select className="border rounded px-2 py-1 text-sm w-full" onChange={(e) => { const v = e.target.value; if (v) void addFollower(v); e.currentTarget.selectedIndex = 0; }}>
                <option value="">Add follower…</option>
                {allUsers.map((u:any) => (<option key={u.id} value={u.id}>{u.name || u.email}</option>))}
              </select>
              )}
            </div>

            {/* File Upload Dropzone */}
            <div className="mt-6">
              <div className="border-2 border-dashed rounded p-6 text-center text-sm text-muted-foreground">
                Drop files here to upload
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

  if (!url) return <Button size="sm" variant="outline" disabled>Loading...</Button>;
  
  return (
    <Button size="sm" variant="outline" asChild>
      <a href={url} download={fileName} className="text-blue-600 hover:text-blue-800">
        Download
      </a>
    </Button>
  );
}