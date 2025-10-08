import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  from_user_id: string;
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
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toUserId = searchParams.get('to');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(toUserId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchContacts();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact);
      markMessagesAsRead(selectedContact);
    }
  }, [selectedContact]);

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
          filter: `or(from_user_id.eq.${user.id},to_user_id.eq.${user.id})`,
        },
        (payload) => {
          console.log('New message received:', payload);
          fetchContacts();
          if (
            selectedContact &&
            (payload.new.from_user_id === selectedContact || payload.new.to_user_id === selectedContact)
          ) {
            fetchMessages(selectedContact);
            if (payload.new.to_user_id === user.id) {
              markMessagesAsRead(selectedContact);
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
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedContact]);

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
        .select('from_user_id, to_user_id, is_read')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);

      if (error) throw error;

      // Get unique user IDs
      const userIds = new Set<string>();
      messagesData?.forEach((msg) => {
        if (msg.from_user_id !== user.id) userIds.add(msg.from_user_id);
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
            (msg) => msg.from_user_id === profile.id && msg.to_user_id === user.id && !msg.is_read
          ).length || 0;

          // Get last message with this contact
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('message, created_at, from_user_id')
            .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${profile.id}),and(from_user_id.eq.${profile.id},to_user_id.eq.${user.id})`)
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

      setContacts(contactsWithData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${contactId}),and(from_user_id.eq.${contactId},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profile data separately
      const userIds = [...new Set(data?.map(m => [m.from_user_id, m.to_user_id]).flat())];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const messagesWithProfiles = data?.map(msg => ({
        ...msg,
        from_profile: profiles?.find(p => p.id === msg.from_user_id) || { name: '', email: '' },
        to_profile: profiles?.find(p => p.id === msg.to_user_id) || { name: '', email: '' },
      }));

      setMessages(messagesWithProfiles || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async (contactId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('from_user_id', contactId)
        .eq('to_user_id', user.id)
        .eq('is_read', false);

      fetchContacts(); // Refresh unread counts
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedContact || !newMessage.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('messages').insert({
        from_user_id: user.id,
        to_user_id: selectedContact,
        message: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
      fetchMessages(selectedContact);
      fetchContacts();

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

  return (
    <Layout>
      <div className="h-[calc(100vh-3.5rem)] flex">
        <div className="w-80 border-r bg-card overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg">Conversations</h2>
          </div>
          <div className="divide-y">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact.id)}
                className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                  selectedContact === contact.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.name}</p>
                    {contact.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.last_message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {contact.last_message_time && (
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(contact.last_message_time)}
                      </p>
                    )}
                    {contact.unread_count > 0 && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {contact.unread_count}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {contacts.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No conversations yet
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              <div className="p-4 border-b bg-card">
                <p className="font-semibold">
                  {contacts.find((c) => c.id === selectedContact)?.name}
                </p>
              </div>

              <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.from_user_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
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
                        sendMessage();
                      }
                    }}
                    rows={2}
                    className="resize-none"
                  />
                  <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
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
    </Layout>
  );
}