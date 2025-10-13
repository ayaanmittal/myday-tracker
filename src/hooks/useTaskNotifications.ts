import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TaskNotification {
  taskId: string;
  newComments: number;
  newAttachments: number;
}

export function useTaskNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Record<string, TaskNotification>>({});
  const [lastChecked, setLastChecked] = useState<Record<string, string>>({});

  // Load last checked times from localStorage
  useEffect(() => {
    if (!user) return;
    
    const stored = localStorage.getItem(`task_notifications_${user.id}`);
    if (stored) {
      try {
        setLastChecked(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing stored notifications:', e);
      }
    }
  }, [user]);

  // Save last checked times to localStorage
  const saveLastChecked = (taskId: string, timestamp: string) => {
    if (!user) return;
    
    const newLastChecked = { ...lastChecked, [taskId]: timestamp };
    setLastChecked(newLastChecked);
    localStorage.setItem(`task_notifications_${user.id}`, JSON.stringify(newLastChecked));
  };

  // Mark task as viewed (reset notifications)
  const markTaskAsViewed = (taskId: string) => {
    const now = new Date().toISOString();
    saveLastChecked(taskId, now);
    
    // Clear notifications for this task
    setNotifications(prev => ({
      ...prev,
      [taskId]: { taskId, newComments: 0, newAttachments: 0 }
    }));
  };

  // Load notifications for a specific task
  const loadTaskNotifications = async (taskId: string) => {
    if (!user) return;

    const lastCheckTime = lastChecked[taskId];
    
    // If no last check time exists, set it to now (so no items appear as "new" initially)
    if (!lastCheckTime) {
      const now = new Date().toISOString();
      saveLastChecked(taskId, now);
      setNotifications(prev => ({
        ...prev,
        [taskId]: {
          taskId,
          newComments: 0,
          newAttachments: 0
        }
      }));
      return;
    }

    const since = lastCheckTime;

    try {
      // Count new comments (only unread)
      const { count: commentCount } = await supabase
        .from('task_comments')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .gt('created_at', since);

      // Count new attachments (only unread)
      const { count: attachmentCount } = await supabase
        .from('task_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .gt('created_at', since);

      setNotifications(prev => ({
        ...prev,
        [taskId]: {
          taskId,
          newComments: commentCount || 0,
          newAttachments: attachmentCount || 0
        }
      }));
    } catch (error) {
      console.error('Error loading task notifications:', error);
    }
  };

  // Load notifications for multiple tasks
  const loadMultipleTaskNotifications = async (taskIds: string[]) => {
    if (!user || taskIds.length === 0) return;

    try {
      // Get all comments for these tasks
      const { data: comments } = await supabase
        .from('task_comments')
        .select('task_id, created_at')
        .in('task_id', taskIds);

      // Get all attachments for these tasks
      const { data: attachments } = await supabase
        .from('task_attachments')
        .select('task_id, created_at')
        .in('task_id', taskIds);

      // Count by task using individual last check times
      const newNotifications: Record<string, TaskNotification> = {};
      
      taskIds.forEach(taskId => {
        const lastCheckTime = lastChecked[taskId];
        
        // If no last check time exists, set it to now (so no items appear as "new" initially)
        if (!lastCheckTime) {
          const now = new Date().toISOString();
          saveLastChecked(taskId, now);
          newNotifications[taskId] = {
            taskId,
            newComments: 0,
            newAttachments: 0
          };
          return;
        }
        
        const since = lastCheckTime;
        
        const taskComments = comments?.filter(c => 
          c.task_id === taskId && new Date(c.created_at) > new Date(since)
        ) || [];
        
        const taskAttachments = attachments?.filter(a => 
          a.task_id === taskId && new Date(a.created_at) > new Date(since)
        ) || [];
        
        newNotifications[taskId] = {
          taskId,
          newComments: taskComments.length,
          newAttachments: taskAttachments.length
        };
      });

      setNotifications(prev => ({ ...prev, ...newNotifications }));
    } catch (error) {
      console.error('Error loading multiple task notifications:', error);
    }
  };

  // Get notification for a specific task
  const getTaskNotification = (taskId: string): TaskNotification => {
    return notifications[taskId] || { taskId, newComments: 0, newAttachments: 0 };
  };

  // Check if task has any new notifications
  const hasNewNotifications = (taskId: string): boolean => {
    const notification = getTaskNotification(taskId);
    return notification.newComments > 0 || notification.newAttachments > 0;
  };

  // Reset all notifications (for testing)
  const resetAllNotifications = () => {
    if (!user) return;
    
    const now = new Date().toISOString();
    const allTaskIds = Object.keys(notifications);
    
    allTaskIds.forEach(taskId => {
      saveLastChecked(taskId, now);
    });
    
    setNotifications({});
    console.log('Reset all notifications');
  };

  return {
    notifications,
    loadTaskNotifications,
    loadMultipleTaskNotifications,
    markTaskAsViewed,
    getTaskNotification,
    hasNewNotifications,
    resetAllNotifications
  };
}
