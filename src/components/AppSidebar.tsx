import { Home, Calendar, Users, MessageSquare, Settings, LogOut } from 'lucide-react';
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
import logo from '@/assets/zoogol-logo.png';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();
  const { data: role } = useUserRole();

  const employeeItems = [
    { title: 'Today', url: '/today', icon: Home },
    { title: 'History', url: '/history', icon: Calendar },
    { title: 'Messages', url: '/messages', icon: MessageSquare },
  ];

  const adminItems = [
    { title: 'Dashboard', url: '/dashboard', icon: Home },
    { title: 'Employees', url: '/employees', icon: Users },
    { title: 'Messages', url: '/messages', icon: MessageSquare },
    { title: 'Settings', url: '/settings', icon: Settings },
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
                            : 'text-foreground/90 hover:bg-accent hover:text-accent-foreground'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
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
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-foreground/90"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}