import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Task {
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

export interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary>({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch tasks assigned to the current user
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        if (tasksError.message?.includes('relation "tasks" does not exist')) {
          console.log('Tasks table not found. Please run the database setup script.');
          setTasks([]);
          setSummary({ total: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 });
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

        // Calculate summary
        const summary = {
          total: tasksData.length,
          pending: tasksData.filter(t => t.status === 'pending').length,
          in_progress: tasksData.filter(t => t.status === 'in_progress').length,
          completed: tasksData.filter(t => t.status === 'completed').length,
          cancelled: tasksData.filter(t => t.status === 'cancelled').length,
        };
        setSummary(summary);
      } else {
        setTasks([]);
        setSummary({ total: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 });
      }
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      setError(error.message);
      setTasks([]);
      setSummary({ total: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  return {
    tasks,
    summary,
    loading,
    error,
    refetch: fetchTasks,
  };
}


