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
import { useEffect, useState } from 'react';
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
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);

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
  }, []);

  // Fetch user profile information
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', user.id)
            .single();
          
          if (!error && profile) {
            setUserProfile({
              name: profile.name || 'Unknown User',
              email: profile.email || user.email || 'No email'
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  const employeeItems = [
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
  ];

  const adminItems = [
    { title: 'Today', url: '/today', icon: Home },
    { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
    { title: 'Reports', url: '/admin-reports', icon: LineChart },
    { title: 'Employees', url: '/employees', icon: Users, badge: employeeCount },
    { title: 'Manage Users', url: '/manage-employees', icon: UserCog },
    { title: 'Admin Tools', url: '/admin-tools', icon: Wrench },
    { title: 'Task Manager', url: '/task-manager', icon: ClipboardList },
    { title: 'Leaves', url: '/leave-approval', icon: Plane, badge: leavePendingCount },
    { title: 'Meetings', url: '/meetings', icon: Users2 },
    { title: 'Violations', url: '/violations', icon: AlertTriangle, badge: violationCount },
    { title: 'Announcements', url: '/announcements', icon: Megaphone, badge: unreadAnnouncementCount },
    { title: 'Manage Rules', url: '/manage-rules', icon: Shield },
    { title: 'Work Days Settings', url: '/work-days-settings', icon: Clock },
    { title: 'Holiday Manager', url: '/attendance-holiday-manager', icon: CalendarDays },
    { title: 'Auto Checkout', url: '/auto-checkout', icon: Timer },
    { title: 'Salary Management', url: '/salary-management', icon: DollarSign },
    { title: 'Messages', url: '/messages', icon: MessageSquare, badge: unreadCount },
    { title: 'Settings', url: '/settings', icon: Settings },
  ];

  const managerItems = [
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
  ];

  const items = role === 'admin' ? adminItems : role === 'manager' ? managerItems : employeeItems;

  return (
    <Sidebar className={`${collapsed ? 'w-16' : 'w-64'} elegant-shadow`} collapsible="icon" side="left">
      <SidebarContent className="bg-card text-black">
        <div className={`p-4 border-b ${collapsed ? 'flex justify-center' : ''}`}>
          <img 
            src={logo} 
            alt="Logo" 
            className={`${collapsed ? 'h-8 w-8' : 'h-10 w-auto'} object-contain transition-all duration-200`}
          />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-black px-3">
            {collapsed ? '' : 'Navigation'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 py-2">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="elegant-button">
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-black hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 text-black" />
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="truncate text-black !text-black" style={{ color: 'black' }}>{item.title}</span>
                          {item.badge && item.badge > 0 && (
                            <Badge className="ml-2 bg-destructive text-destructive-foreground text-xs font-semibold px-1 py-0.5 rounded-full h-4 min-w-4 flex items-center justify-center">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto border-t p-4">
          {/* User Profile Info */}
          {!collapsed && (
            <div className="mb-3 px-3 py-2 bg-muted/50 rounded-md">
              {userProfile ? (
                <>
                  <div className="text-sm font-medium text-black">{userProfile.name}</div>
                  <div className="text-xs text-muted-foreground">{userProfile.email}</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Loading...</div>
              )}
            </div>
          )}
          
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-black"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-black !text-black" style={{ color: 'black' }}>Sign Out</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}