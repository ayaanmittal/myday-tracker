import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Clock, Bell, Users, Edit, Save, X, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roleLoading && role !== 'admin') {
      navigate('/today');
      return;
    }

    if (role === 'admin') {
      fetchSettings();
    }
  }, [user, role, roleLoading, navigate]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: Setting) => {
    setEditingSetting(setting.id);
    setEditValue(setting.value);
  };

  const handleCancelEdit = () => {
    setEditingSetting(null);
    setEditValue('');
  };

  const handleSaveSetting = async (settingId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({ 
          value: editValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', settingId);

      if (error) throw error;

      toast({
        title: 'Setting updated',
        description: 'Setting has been updated successfully.',
      });

      setEditingSetting(null);
      setEditValue('');
      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getCategories = () => {
    const categories = [...new Set(settings.map(s => s.category))];
    return categories;
  };

  const filteredSettings = settings.filter(setting => 
    categoryFilter === 'all' || setting.category === categoryFilter
  );

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Configure system preferences and policies</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {getCategories().map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Admin Quick Actions */}
        {(role === 'admin' || role === 'manager') && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  Work Days Settings
                </CardTitle>
                <CardDescription>
                  Configure work days for each employee to calculate accurate attendance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link 
                  to="/work-days-settings" 
                  className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
                >
                  Configure Work Days →
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Leave Settings
                </CardTitle>
                <CardDescription>
                  Manage employee categories, leave types, and policies for comprehensive leave management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link 
                  to="/leave-settings" 
                  className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
                >
                  Configure Leave Settings →
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>Manage and configure system settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSettings.map((setting) => (
                  <TableRow key={setting.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {setting.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      {editingSetting === setting.id ? (
                        <div className="flex items-center gap-2">
                          {setting.data_type === 'boolean' ? (
                            <Switch
                              checked={editValue === 'true'}
                              onCheckedChange={(checked) => setEditValue(checked.toString())}
                            />
                          ) : setting.data_type === 'number' ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24"
                            />
                          ) : setting.key.includes('time') ? (
                            <Input
                              type="time"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-32"
                            />
                          ) : (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-48"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {setting.data_type === 'boolean' ? (
                            <Switch
                              checked={setting.value === 'true'}
                              disabled
                            />
                          ) : (
                            <span className="font-mono text-sm">{setting.value}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {setting.data_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {setting.is_public ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(setting.updated_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingSetting === setting.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleSaveSetting(setting.id)}
                            disabled={saving}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(setting)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredSettings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {categoryFilter === 'all' 
                  ? 'No settings found' 
                  : `No settings found in ${categoryFilter} category`}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          © ERCMAX Systems
        </div>
      </div>
    </Layout>
  );
}