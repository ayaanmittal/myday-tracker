import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, ArrowLeft, CheckCircle, Clock, AlertCircle, Bell } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    announcements, 
    summary, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead 
  } = useAnnouncements();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleMarkAsRead = async (announcementId: string) => {
    await markAsRead(announcementId);
    toast({
      title: 'Marked as read',
      description: 'Announcement has been marked as read.',
    });
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast({
      title: 'All marked as read',
      description: 'All announcements have been marked as read.',
    });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'normal':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'low':
        return <Bell className="h-4 w-4 text-gray-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'normal':
        return <Badge className="bg-blue-100 text-blue-800">Normal</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{priority}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const unreadAnnouncements = announcements.filter(a => !a.is_read);
  const readAnnouncements = announcements.filter(a => a.is_read);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading notifications...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto p-6">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => navigate('/today')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Card className="text-center py-12">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Error Loading Notifications</CardTitle>
              <CardDescription className="text-base mt-4">
                {error}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto p-6">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/today')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold tracking-tight gradient-text">
            Notifications
          </h1>
          <p className="text-muted-foreground mt-2">
            Stay updated with company announcements and important information
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <Megaphone className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold text-orange-600">{summary.unread}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Urgent</p>
                  <p className="text-2xl font-bold text-red-600">{summary.urgent}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-gray-600">{summary.expired}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mark all as read button */}
        {summary.unread > 0 && (
          <div className="mb-6">
            <Button onClick={handleMarkAllAsRead} variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark All as Read
            </Button>
          </div>
        )}

        {/* Announcements Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All ({announcements.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadAnnouncements.length})</TabsTrigger>
            <TabsTrigger value="read">Read ({readAnnouncements.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {announcements.length === 0 ? (
              <Card className="text-center py-12">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <Megaphone className="h-16 w-16 text-muted-foreground opacity-50" />
                  </div>
                  <CardTitle className="text-2xl">No Announcements</CardTitle>
                  <CardDescription className="text-base mt-4">
                    You don't have any announcements yet.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              announcements.map((announcement) => (
                <Card 
                  key={announcement.id} 
                  className={`transition-all duration-200 hover:shadow-md ${
                    !announcement.is_read ? 'border-l-4 border-l-orange-500 bg-orange-50/50' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getPriorityIcon(announcement.priority)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{announcement.title}</CardTitle>
                            {getPriorityBadge(announcement.priority)}
                            {!announcement.is_read && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                New
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-sm text-muted-foreground">
                            By {announcement.created_by_profile?.name} • {formatDate(announcement.created_at)}
                          </CardDescription>
                        </div>
                      </div>
                      {!announcement.is_read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkAsRead(announcement.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    {announcement.expires_at && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Expires: {new Date(announcement.expires_at).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            {unreadAnnouncements.length === 0 ? (
              <Card className="text-center py-12">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <CheckCircle className="h-16 w-16 text-green-500 opacity-50" />
                  </div>
                  <CardTitle className="text-2xl">All Caught Up!</CardTitle>
                  <CardDescription className="text-base mt-4">
                    You have no unread announcements.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              unreadAnnouncements.map((announcement) => (
                <Card 
                  key={announcement.id} 
                  className="border-l-4 border-l-orange-500 bg-orange-50/50 transition-all duration-200 hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getPriorityIcon(announcement.priority)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{announcement.title}</CardTitle>
                            {getPriorityBadge(announcement.priority)}
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              New
                            </Badge>
                          </div>
                          <CardDescription className="text-sm text-muted-foreground">
                            By {announcement.created_by_profile?.name} • {formatDate(announcement.created_at)}
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkAsRead(announcement.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    {announcement.expires_at && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Expires: {new Date(announcement.expires_at).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="read" className="space-y-4">
            {readAnnouncements.length === 0 ? (
              <Card className="text-center py-12">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <Clock className="h-16 w-16 text-muted-foreground opacity-50" />
                  </div>
                  <CardTitle className="text-2xl">No Read Announcements</CardTitle>
                  <CardDescription className="text-base mt-4">
                    You haven't read any announcements yet.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              readAnnouncements.map((announcement) => (
                <Card 
                  key={announcement.id} 
                  className="transition-all duration-200 hover:shadow-md opacity-75"
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {getPriorityIcon(announcement.priority)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{announcement.title}</CardTitle>
                          {getPriorityBadge(announcement.priority)}
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Read
                          </Badge>
                        </div>
                        <CardDescription className="text-sm text-muted-foreground">
                          By {announcement.created_by_profile?.name} • {formatDate(announcement.created_at)}
                          {announcement.read_at && (
                            <span> • Read {formatDate(announcement.read_at)}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    {announcement.expires_at && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Expires: {new Date(announcement.expires_at).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}




