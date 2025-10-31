import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Announcement {
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
  recipients?: { recipient_id: string }[];
  recipient_count?: number;
  view_count?: number;
  is_read?: boolean;
  read_at?: string | null;
}

export interface AnnouncementSummary {
  total: number;
  unread: number;
  urgent: number;
  expired: number;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [summary, setSummary] = useState<AnnouncementSummary>({
    total: 0,
    unread: 0,
    urgent: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch announcements with recipient and view counts
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select(`
          *
        `)
        .order('created_at', { ascending: false });

      if (announcementsError) {
        if (announcementsError.message?.includes('relation "announcements" does not exist')) {
          console.log('Announcements table not found. Please run the database setup script.');
          setAnnouncements([]);
          setSummary({ total: 0, unread: 0, urgent: 0, expired: 0 });
          return;
        }
        throw announcementsError;
      }

      // Fetch creator profiles separately
      const creatorIds = [...new Set(announcementsData?.map(ann => ann.created_by) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', creatorIds);

      if (profilesError) {
        console.warn('Error fetching creator profiles:', profilesError);
      }

      // Create a map of creator profiles
      const creatorProfiles = profilesData?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { id: string; name: string; email: string }>) || {};

      // Fetch user-specific read status
      const { data: userViews, error: viewsError } = await supabase
        .from('announcement_views')
        .select('announcement_id')
        .eq('user_id', user.id);

      if (viewsError) throw viewsError;

      const readAnnouncementIds = new Set(userViews?.map(v => v.announcement_id));

      // Process announcements
      const processedAnnouncements: Announcement[] = (announcementsData || []).map(ann => ({
        ...ann,
        send_to_all: ann.send_to_all || false, // Default to false if column doesn't exist
        created_by_profile: creatorProfiles[ann.created_by] || undefined,
        recipients: ann.recipients || [],
        recipient_count: ann.recipient_count?.[0]?.count || 0,
        view_count: ann.view_count?.[0]?.count || 0,
        is_read: readAnnouncementIds.has(ann.id),
      }));

      setAnnouncements(processedAnnouncements);

      // Calculate summary
      const total = processedAnnouncements.length;
      const unread = processedAnnouncements.filter(ann => !ann.is_read && ann.is_active && (!ann.expires_at || new Date(ann.expires_at) > new Date())).length;
      const urgent = processedAnnouncements.filter(ann => ann.priority === 'urgent' && ann.is_active && (!ann.expires_at || new Date(ann.expires_at) > new Date())).length;
      const expired = processedAnnouncements.filter(ann => ann.expires_at && new Date(ann.expires_at) <= new Date()).length;

      setSummary({ total, unread, urgent, expired });

    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId: string) => {
    if (!user) return;

    try {
      // Create a view record
      const { error } = await supabase
        .from('announcement_views')
        .insert({
          announcement_id: announcementId,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
        });

      if (error && !error.message.includes('duplicate key')) {
        throw error;
      }

      // Update local state
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement.id === announcementId 
            ? { ...announcement, is_read: true }
            : announcement
        )
      );

      // Update summary
      setSummary(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
      }));
    } catch (error) {
      console.error('Error marking announcement as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const unreadAnnouncements = announcements.filter(a => !a.is_read);
      
      if (unreadAnnouncements.length === 0) return;

      // Create view records for all unread announcements
      const viewPromises = unreadAnnouncements.map(announcement =>
        supabase
          .from('announcement_views')
          .insert({
            announcement_id: announcement.id,
            user_id: user.id,
            viewed_at: new Date().toISOString(),
          })
      );

      await Promise.all(viewPromises);

      // Update local state
      setAnnouncements(prev => 
        prev.map(announcement => ({
          ...announcement,
          is_read: true,
        }))
      );

      setSummary(prev => ({
        ...prev,
        unread: 0,
      }));

    } catch (error) {
      console.error('Error marking all announcements as read:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [user]);

  return {
    announcements,
    summary,
    loading,
    error,
    refetch: fetchAnnouncements,
    markAsRead,
    markAllAsRead,
  };
}





