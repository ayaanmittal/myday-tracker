import { Home, Calendar, Users, MessageSquare, Settings, LogOut, UserCog, FileText, Shield, BarChart3, LineChart } from 'lucide-react';
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
import logo from '@/assets/zoogol-logo.png';
import { Badge } from '@/components/ui/badge';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();
  const { data: role } = useUserRole();
  const { unreadCount } = useMessageNotifications();

  const employeeItems = [
    { title: 'Today', url: '/today', icon: Home, badge: 0 },
    { title: 'History', url: '/history', icon: Calendar, badge: 0 },
    { title: 'Analytics', url: '/analytics', icon: BarChart3, badge: 0 },
    { title: 'Office Rules', url: '/office-rules', icon: FileText, badge: 0 },
    { title: 'Messages', url: '/messages', icon: MessageSquare, badge: unreadCount },
  ];

  const adminItems = [
    { title: 'Dashboard', url: '/dashboard', icon: Home, badge: 0 },
    { title: 'Reports', url: '/admin-reports', icon: LineChart, badge: 0 },
    { title: 'Employees', url: '/employees', icon: Users, badge: 0 },
    { title: 'Manage Users', url: '/manage-employees', icon: UserCog, badge: 0 },
    { title: 'Manage Rules', url: '/manage-rules', icon: Shield, badge: 0 },
    { title: 'Messages', url: '/messages', icon: MessageSquare, badge: unreadCount },
    { title: 'Settings', url: '/settings', icon: Settings, badge: 0 },
  ];

  const items = role === 'admin' ? adminItems : employeeItems;

  return (
    <Sidebar className={collapsed ? 'w-16' : 'w-64'} collapsible="icon">
      <SidebarContent className="bg-card">
        <div className={`p-4 border-b ${collapsed ? 'flex justify-center' : ''}`}>
          <img 
            src={logo} 
            alt="Zoogol" 
            className={collapsed ? 'h-8 w-8 object-contain' : 'h-10 w-auto object-contain'}
          />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground px-3">{collapsed ? '' : 'Navigation'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-foreground hover:text-primary :bg-accent/50'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1">
                          <span>{item.title}</span>
                          {item.badge && item.badge > 0 && (
                            <Badge className="ml-auto bg-destructive text-destructive-foreground">
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
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-foreground"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}