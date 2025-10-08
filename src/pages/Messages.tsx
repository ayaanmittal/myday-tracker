import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Send, Plus, Users } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  sender_id: string;
  to_user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  from_profile: { name: string; email: string };
  to_profile: { name: string; email: string };
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toUserId = searchParams.get('to');

  const {
    conversations,
    loading: conversationsLoading,
    getOrCreateConversation,
    sendMessage: sendMessageToConversation,
    markMessagesAsRead: markConversationMessagesAsRead,
    fetchMessages: fetchConversationMessages,
  } = useConversations();

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<Contact[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [initialMessage, setInitialMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAllUsers();
  }, [user, navigate]);

  // Debug: Log when allUsers changes
  useEffect(() => {
    console.log('allUsers updated:', allUsers);
  }, [allUsers]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
      markConversationMessagesAsRead(selectedConversation);
    }
  }, [selectedConversation]);

  const loadMessages = async (conversationId: string) => {
    try {
      const messagesData = await fetchConversationMessages(conversationId);
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('New message received:', payload);
          // Reload messages if it's for the current conversation
          if (selectedConversation && payload.new.conversation_id === selectedConversation) {
            loadMessages(selectedConversation);
            if (payload.new.sender_id !== user.id) {
              markConversationMessagesAsRead(selectedConversation);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Reload messages if it's for the current conversation
          if (selectedConversation) {
            loadMessages(selectedConversation);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const fetchContacts = async () => {
    if (!user) return;

    try {
      // Get all users this person has exchanged messages with
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('sender_id, to_user_id, is_read')
        .or(`sender_id.eq.${user.id},to_user_id.eq.${user.id}`);

      if (error) throw error;

      // Get unique user IDs
      const userIds = new Set<string>();
      messagesData?.forEach((msg) => {
        if (msg.sender_id !== user.id) userIds.add(msg.sender_id);
        if (msg.to_user_id !== user.id) userIds.add(msg.to_user_id);
      });

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Get last messages for each contact
      const contactsWithData = await Promise.all(
        profiles?.map(async (profile) => {
          const unreadCount = messagesData?.filter(
            (msg) => msg.sender_id === profile.id && msg.to_user_id === user.id && !msg.is_read
          ).length || 0;

          // Get last message with this contact
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('message, created_at, sender_id')
            .or(`and(sender_id.eq.${user.id},to_user_id.eq.${profile.id}),and(sender_id.eq.${profile.id},to_user_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...profile,
            unread_count: unreadCount,
            last_message: lastMsg?.message,
            last_message_time: lastMsg?.created_at,
          };
        }) || []
      );

      // Sort by last message time
      contactsWithData.sort((a, b) => {
        const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
        const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
        return timeB - timeA;
      });

      // This function is no longer needed with conversations
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchAllUsers = async () => {
    if (!user) return;

    try {
      console.log('Fetching all users...');
      
      // Fetch from the new users table
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .eq('is_active', true)
        .neq('id', user.id) // Exclude current user
        .order('name', { ascending: true });

      console.log('Users query result:', { users, usersError });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      if (!users || users.length === 0) {
        console.log('No users found');
        setAllUsers([]);
        return;
      }

      // Now fetch roles for these users
      const userIds = users.map(u => u.id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        // Continue without roles
      }

      // Combine users with roles
      const usersWithRoles = users.map(user => {
        const userRole = roles?.find(r => r.user_id === user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: userRole?.role || 'employee',
          unread_count: 0,
        };
      });

      console.log('Setting users:', usersWithRoles);
      setAllUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching all users:', error);
      setAllUsers([]);
    }
  };

  const createNewConversation = async () => {
    if (!user || !selectedUser || !initialMessage.trim()) return;

    setLoading(true);
    try {
      // Get or create conversation
      const conversationId = await getOrCreateConversation(selectedUser);
      
      if (!conversationId || typeof conversationId !== 'string') {
        throw new Error('Failed to create conversation');
      }
      
      // Send the initial message
      await sendMessageToConversation(conversationId, initialMessage.trim());

      // Close dialog and reset form
      setIsNewConversationOpen(false);
      setSelectedUser('');
      setInitialMessage('');

      // Select the new conversation
      setSelectedConversation(conversationId as string);

      toast({
        title: 'Conversation started',
        description: 'Your message has been sent.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesForContact = async (contactId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},to_user_id.eq.${contactId}),and(sender_id.eq.${contactId},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profile data separately
      const userIds = [...new Set(data?.map(m => [m.sender_id, m.to_user_id]).flat())];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const messagesWithProfiles = data?.map(msg => ({
        ...msg,
        from_profile: profiles?.find(p => p.id === msg.sender_id) || { name: '', email: '' },
        to_profile: profiles?.find(p => p.id === msg.to_user_id) || { name: '', email: '' },
      }));

      setMessages(messagesWithProfiles || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return;

    setLoading(true);
    try {
      await sendMessageToConversation(selectedConversation, newMessage.trim());
      setNewMessage('');
      
      toast({
        title: 'Message sent',
        description: 'Your message has been delivered.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'employee':
        return 'Employee';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'employee':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-3.5rem)] flex">
        <div className="w-80 border-r bg-card overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Conversations</h2>
              <Button
                size="sm"
                onClick={() => setIsNewConversationOpen(true)}
                className="h-8 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation.id)}
                className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                  selectedConversation === conversation.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{conversation.other_user?.name || 'Unknown User'}</p>
                    {conversation.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.last_message.content}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {conversation.last_message_at && (
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(conversation.last_message_at)}
                      </p>
                    )}
                    {conversation.unread_count && conversation.unread_count > 0 && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {conversation.unread_count}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {conversations.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No conversations yet
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b bg-card">
                <p className="font-semibold">
                  {conversations.find((c) => c.id === selectedConversation)?.other_user?.name || 'Unknown User'}
                </p>
              </div>

              <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-card">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={2}
                    className="resize-none"
                  />
                  <Button onClick={handleSendMessage} disabled={loading || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
        <DialogContent className="sm:max-w-[600px] w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Start New Conversation
            </DialogTitle>
            <DialogDescription>
              Select a user and send your first message to start a new conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a user to message">
                    {selectedUser && allUsers.find(u => u.id === selectedUser) && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {allUsers.find(u => u.id === selectedUser)?.name}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getRoleBadgeColor(allUsers.find(u => u.id === selectedUser)?.role || 'employee')}`}>
                          {getRoleDisplayName(allUsers.find(u => u.id === selectedUser)?.role || 'employee')}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-full min-w-[500px]">
                  {allUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="w-full">
                      <div className="flex flex-col w-full min-w-0 py-1">
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium flex-1 min-w-0">{user.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border flex-shrink-0 ${getRoleBadgeColor(user.role || 'employee')}`}>
                            {getRoleDisplayName(user.role || 'employee')}
                          </span>
                        </div>
                        <div className="flex flex-col w-full min-w-0 mt-1">
                          <span className="text-sm text-muted-foreground w-full break-all">{user.email}</span>
                          {user.phone && (
                            <span className="text-xs text-muted-foreground w-full">{user.phone}</span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="initial-message">Initial Message</Label>
              <Textarea
                id="initial-message"
                placeholder="Type your message here..."
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsNewConversationOpen(false);
                setSelectedUser('');
                setInitialMessage('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={createNewConversation}
              disabled={!selectedUser || !initialMessage.trim() || loading}
            >
              {loading ? 'Sending...' : 'Start Conversation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}