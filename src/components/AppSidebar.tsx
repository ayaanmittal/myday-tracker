import { Home, Calendar, Users, MessageSquare, Settings, LogOut, UserCog, FileText, Shield, BarChart3, LineChart, CheckSquare, ClipboardList, Plane, Megaphone, Bell, Wrench, Users2, AlertTriangle, Clock, CalendarDays, Timer, DollarSign, Receipt } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useTasks } from '@/hooks/useTasks';
import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { Badge } from '@/components/ui/badge';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();
  const { data: role } = useUserRole();
  const { unreadCount } = useMessageNotifications();
  const { pendingCount: leavePendingCount } = useLeaveRequests();
  const { summary: announcementSummary } = useAnnouncements();
  const unreadAnnouncementCount = announcementSummary?.unread || 0;
  const { summary: taskSummary } = useTasks();
  const pendingTaskCount = taskSummary?.pending || 0;
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [violationCount, setViolationCount] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; designation?: string | null } | null>(() => {
    // Don't initialize from cache - always fetch fresh data
    return null;
  });
  const hasFetchedProfile = useRef(false);

  // Fetch employee count for admin and manager users
  useEffect(() => {
    if (role === 'admin' || role === 'manager') {
      const fetchEmployeeCount = async () => {
        try {
          const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
          
          if (!error && count !== null) {
            setEmployeeCount(count);
          }
        } catch (error) {
          console.error('Error fetching employee count:', error);
        }
      };

      fetchEmployeeCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Fetch violation count for all users
  useEffect(() => {
    const fetchViolationCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { count, error } = await supabase
            .from('rule_violations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
          
          if (!error && count !== null) {
            setViolationCount(count);
          }
        }
      } catch (error) {
        console.error('Error fetching violation count:', error);
      }
    };

    fetchViolationCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user profile information (only once on mount)
  useEffect(() => {
    // Don't fetch if we already have the profile or have already fetched
    if (userProfile || hasFetchedProfile.current) return;
    
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('name, email, designation')
            .eq('id', user.id)
            .single();
          
          if (!error && profile) {
            const profileData = {
              name: profile.name || user.email?.split('@')[0] || 'User',
              email: profile.email || user.email || 'No email',
              designation: profile.designation || null
            };
            setUserProfile(profileData);
          } else {
            // Fallback to auth user data if profile doesn't exist
            const profileData = {
              name: user.email?.split('@')[0] || 'User',
              email: user.email || 'email@example.com',
              designation: null
            };
            setUserProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        hasFetchedProfile.current = true;
      }
    };

    fetchUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount

  const employeeItems = useMemo(() => [
    { title: 'Today', url: '/today', icon: Home },
    { title: 'History', url: '/history', icon: Calendar },
    { title: 'Analytics', url: '/analytics', icon: BarChart3 },
    { title: 'My Tasks', url: '/tasks', icon: CheckSquare, badge: pendingTaskCount },
    { title: 'Leave', url: '/leave', icon: Plane },
    { title: 'My Leaves & Salary', url: '/my-leaves-salary', icon: Receipt },
    { title: 'Meetings', url: '/meetings', icon: Users2 },
    { title: 'Violations', url: '/violations', icon: AlertTriangle, badge: violationCount },
    { title: 'Office Rules', url: '/office-rules', icon: FileText },
    { title: 'Notifications', url: '/notifications', icon: Bell, badge: announcementSummary.unread },
    { title: 'Messages', url: '/messages', icon: MessageSquare, badge: unreadCount },
  ], [pendingTaskCount, violationCount, announcementSummary.unread, unreadCount]);

  const adminItems = useMemo(() => [
    { title: 'Today', url: '/today', icon: Home },
    { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
    { title: 'Reports', url: '/admin-reports', icon: LineChart },
    { title: 'Employees', url: '/employees', icon: Users, badge: employeeCount },
    { title: 'Manage Users', url: '/manage-employees', icon: UserCog },
    { title: 'Task Manager', url: '/task-manager', icon: ClipboardList },
    { title: 'Leaves', url: '/leave-approval', icon: Plane, badge: leavePendingCount },
    { title: 'Meetings', url: '/meetings', icon: Users2 },
    { title: 'Violations', url: '/violations', icon: AlertTriangle, badge: violationCount },
    { title: 'Announcements', url: '/announcements', icon: Megaphone, badge: unreadAnnouncementCount },
    { title: 'Manage Rules', url: '/manage-rules', icon: Shield },
    { title: 'Holiday Manager', url: '/attendance-holiday-manager', icon: CalendarDays },
    { title: 'Auto Checkout', url: '/auto-checkout', icon: Timer },
    { title: 'Salary Management', url: '/salary-management', icon: DollarSign },
    { title: 'Messages', url: '/messages', icon: MessageSquare, badge: unreadCount },
    { title: 'Settings', url: '/settings', icon: Settings },
  ], [employeeCount, leavePendingCount, violationCount, unreadAnnouncementCount, unreadCount]);

  const managerItems = useMemo(() => [
    // Employee features
    { title: 'Today', url: '/today', icon: Home },
    { title: 'History', url: '/history', icon: Calendar },
    { title: 'Analytics', url: '/analytics', icon: BarChart3 },
    { title: 'My Tasks', url: '/tasks', icon: CheckSquare, badge: pendingTaskCount },
    { title: 'Task Manager', url: '/task-manager', icon: ClipboardList },
    { title: 'Leave', url: '/leave', icon: Plane },
    { title: 'My Leaves & Salary', url: '/my-leaves-salary', icon: Receipt },
    { title: 'Meetings', url: '/meetings', icon: Users2 },
    { title: 'Violations', url: '/violations', icon: AlertTriangle, badge: violationCount },
    { title: 'Office Rules', url: '/office-rules', icon: FileText },
    { title: 'Notifications', url: '/notifications', icon: Bell, badge: announcementSummary.unread },
    { title: 'Messages', url: '/messages', icon: MessageSquare, badge: unreadCount },
    // Admin features
    { title: 'Employees', url: '/employees', icon: Users, badge: employeeCount },
    { title: 'Announcements', url: '/announcements', icon: Megaphone, badge: unreadAnnouncementCount },
    { title: 'Settings', url: '/settings', icon: Settings },
  ], [pendingTaskCount, violationCount, announcementSummary.unread, unreadCount, employeeCount, unreadAnnouncementCount]);

  const items = useMemo(() => role === 'admin' ? adminItems : role === 'manager' ? managerItems : employeeItems, [role, adminItems, managerItems, employeeItems]);

  return (
    <Sidebar className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 shadow-sm`} collapsible="icon" side="left">
      <SidebarContent className="bg-transparent">
        {/* Logo Section */}
        <div className={`p-4 ${collapsed ? 'flex justify-center' : 'px-4'}`}>
          <img 
            src={logo} 
            alt="Logo" 
            className={`${collapsed ? 'h-8 w-8' : 'h-10 w-auto'} object-contain`}
          />
        </div>

        <SidebarGroup className={collapsed ? 'mt-2' : ''}>
          <SidebarGroupLabel className="text-gray-500 font-medium px-4 text-xs uppercase tracking-wider">
            {collapsed ? '' : 'Menu'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 py-2 space-y-0.5">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="group">
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-600'}`} />
                          {!collapsed && (
                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span>{item.title}</span>
                              {item.badge && item.badge > 0 && (
                                <Badge className="ml-2 bg-blue-700 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] h-5 flex items-center justify-center">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Profile and Sign Out Section */}
        <div className="mt-auto px-4 pb-4 border-t border-gray-200 pt-4 space-y-3">
          {!collapsed && userProfile && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-200">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-semibold shadow-sm">
                {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{userProfile?.name || 'User'}</div>
                <div className="text-xs text-gray-600 truncate">{userProfile?.email || 'email@example.com'}</div>
                {role && (
                  <div className="text-xs text-gray-500 mt-0.5 capitalize">{role}</div>
                )}
              </div>
            </div>
          )}
          
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition-all duration-200 w-full text-gray-700 font-medium border border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}