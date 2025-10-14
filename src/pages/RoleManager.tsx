import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { User, Shield, Plus, CheckCircle } from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string;
  name: string;
  role: string | null;
}

export default function RoleManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq('is_active', true)
        .order('name');

      if (usersError) {
        console.error('Error loading users:', usersError);
        // Try without the join to see all users
        const { data: allUsers, error: allUsersError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('is_active', true)
          .order('name');

        if (allUsersError) {
          throw allUsersError;
        }

        // Get roles separately
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) {
          console.error('Error loading roles:', rolesError);
        }

        const usersWithRoles = (allUsers || []).map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: rolesData?.find(r => r.user_id === u.id)?.role || null
        }));

        setUsers(usersWithRoles);
      } else {
        const usersWithRoles = (usersData || []).map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.user_roles?.[0]?.role || null
        }));
        setUsers(usersWithRoles);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async (userId: string, role: 'admin' | 'manager' | 'employee') => {
    setAssigning(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Role assigned successfully`,
      });

      // Reload users
      await loadUsers();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign role',
        variant: 'destructive',
      });
    } finally {
      setAssigning(null);
    }
  };

  const getRoleColor = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'employee': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Role Manager
          </h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Users ({users.length})
            </CardTitle>
            <CardDescription>
              Assign roles to users to control access to different features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-medium">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge className={getRoleColor(user.role)}>
                      {user.role || 'No Role'}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignRole(user.id, 'admin')}
                      disabled={assigning === user.id || user.role === 'admin'}
                      className="text-xs"
                    >
                      {assigning === user.id ? 'Assigning...' : 'Admin'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignRole(user.id, 'manager')}
                      disabled={assigning === user.id || user.role === 'manager'}
                      className="text-xs"
                    >
                      {assigning === user.id ? 'Assigning...' : 'Manager'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => assignRole(user.id, 'employee')}
                      disabled={assigning === user.id || user.role === 'employee'}
                      className="text-xs"
                    >
                      {assigning === user.id ? 'Assigning...' : 'Employee'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                If you can't see any users or roles, you may need to:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Run the SQL script in Supabase SQL Editor</li>
                <li>Check if the user_roles table exists</li>
                <li>Verify RLS policies are set up correctly</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
