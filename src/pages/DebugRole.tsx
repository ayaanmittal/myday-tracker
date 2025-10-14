import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { User, Shield, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface DebugInfo {
  user: any;
  profile: any;
  roles: any[];
  tableExists: boolean;
  error: string | null;
}

export default function DebugRole() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      console.log('🔍 Running role debug...');
      
      // 1. Check current user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      if (!currentUser) {
        setDebugInfo({
          user: null,
          profile: null,
          roles: [],
          tableExists: false,
          error: 'No user found - not logged in'
        });
        return;
      }
      
      // 2. Check profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      // 3. Check user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', currentUser.id);
      
      // 4. Check if user_roles table exists
      const { data: tableCheck, error: tableError } = await supabase
        .from('user_roles')
        .select('count')
        .limit(1);
      
      setDebugInfo({
        user: currentUser,
        profile: profileError ? { error: profileError.message } : profile,
        roles: rolesError ? [] : (roles || []),
        tableExists: !tableError,
        error: null
      });
      
    } catch (error) {
      console.error('Debug error:', error);
      setDebugInfo({
        user: null,
        profile: null,
        roles: [],
        tableExists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const assignAdminRole = async () => {
    if (!user) return;
    
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: 'admin'
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Admin role assigned successfully!',
      });
      
      // Refresh debug info
      await runDebug();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign admin role',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    runDebug();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Role Debug Tool
          </h1>
          <p className="text-muted-foreground">
            Debug user authentication and role assignment issues
          </p>
        </div>

        <div className="flex gap-4">
          <Button onClick={runDebug} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Debug Info
          </Button>
          <Button onClick={assignAdminRole} disabled={assigning || !user}>
            {assigning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Assign Admin Role
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-4">
            {/* User Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {debugInfo.user ? (
                  <div className="space-y-2">
                    <p><strong>ID:</strong> {debugInfo.user.id}</p>
                    <p><strong>Email:</strong> {debugInfo.user.email}</p>
                    <p><strong>Created:</strong> {new Date(debugInfo.user.created_at).toLocaleString()}</p>
                    <Badge className="bg-green-100 text-green-800">✅ Authenticated</Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>No user found</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile Info */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                {debugInfo.profile && !debugInfo.profile.error ? (
                  <div className="space-y-2">
                    <p><strong>Name:</strong> {debugInfo.profile.name}</p>
                    <p><strong>Email:</strong> {debugInfo.profile.email}</p>
                    <p><strong>Active:</strong> {debugInfo.profile.is_active ? 'Yes' : 'No'}</p>
                    <Badge className="bg-green-100 text-green-800">✅ Profile Found</Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Profile Error: {debugInfo.profile?.error || 'No profile found'}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Roles Info */}
            <Card>
              <CardHeader>
                <CardTitle>Role Information</CardTitle>
              </CardHeader>
              <CardContent>
                {debugInfo.tableExists ? (
                  <div className="space-y-2">
                    {debugInfo.roles.length > 0 ? (
                      <div>
                        {debugInfo.roles.map((role, index) => (
                          <Badge key={index} className="bg-blue-100 text-blue-800 mr-2">
                            {role.role}
                          </Badge>
                        ))}
                        <Badge className="bg-green-100 text-green-800">✅ Roles Found</Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>No roles assigned</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>user_roles table not accessible</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Info */}
            {debugInfo.error && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    Error Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-600">{debugInfo.error}</p>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {debugInfo.user ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <span>User authenticated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {debugInfo.profile && !debugInfo.profile.error ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <span>Profile exists</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {debugInfo.tableExists ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <span>user_roles table accessible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {debugInfo.roles.length > 0 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <span>Roles assigned</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
