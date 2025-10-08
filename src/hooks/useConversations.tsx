import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string | null;
  last_message_id: string | null;
  created_at: string;
  updated_at: string;
  other_user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender_profile?: {
    id: string;
    name: string;
    email: string;
  };
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch conversations first
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsLast: true });

      if (conversationsError) {
        console.error('Error fetching conversations:', conversationsError);
        throw conversationsError;
      }

      console.log('Fetched conversations:', conversationsData);

      if (!conversationsData || conversationsData.length === 0) {
        console.log('No conversations found');
        setConversations([]);
        return;
      }

      // Get all participant IDs
      const participantIds = new Set<string>();
      conversationsData.forEach(conv => {
        participantIds.add(conv.participant_1);
        participantIds.add(conv.participant_2);
      });

      // Fetch profiles for all participants
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', Array.from(participantIds));

      console.log('Participant IDs:', Array.from(participantIds));
      console.log('Fetched profiles:', profiles);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Transform the data to include other user info
      const transformedConversations = await Promise.all(conversationsData.map(async (conv) => {
        const isParticipant1 = conv.participant_1 === user.id;
        const otherUserId = isParticipant1 ? conv.participant_2 : conv.participant_1;
        let otherUser = profiles?.find(p => p.id === otherUserId);
        
        // If profile not found in batch, try to fetch it using the RPC function
        if (!otherUser) {
          console.log('Profile not found in batch, fetching using RPC for:', otherUserId);
          try {
            const { data: userProfile, error: rpcError } = await supabase
              .rpc('get_user_profile', { user_id: otherUserId });
            
            if (!rpcError && userProfile && userProfile.length > 0) {
              otherUser = userProfile[0];
              console.log('Found user profile via RPC:', otherUser);
            } else {
              // Final fallback
              console.log('RPC failed, creating fallback user for:', otherUserId);
              otherUser = {
                id: otherUserId,
                name: `User ${otherUserId.slice(0, 8)}`,
                email: ''
              };
              console.log('Created fallback user:', otherUser);
            }
          } catch (err) {
            console.error('Error fetching user profile via RPC:', err);
            // Final fallback
            otherUser = {
              id: otherUserId,
              name: `User ${otherUserId.slice(0, 8)}`,
              email: ''
            };
          }
        }
        
        console.log('Processing conversation:', {
          convId: conv.id,
          participant_1: conv.participant_1,
          participant_2: conv.participant_2,
          currentUser: user.id,
          isParticipant1,
          otherUserId,
          otherUserIdType: typeof otherUserId,
          foundProfile: otherUser,
          allProfiles: profiles,
          profileMatch: profiles?.find(p => {
            console.log('Comparing:', { profileId: p.id, otherUserId, match: p.id === otherUserId });
            return p.id === otherUserId;
          })
        });
        
        return {
          ...conv,
          other_user: otherUser || { id: otherUserId, name: 'Unknown User', email: '' },
        };
      }));

      // Get unread counts and last messages for each conversation
      const conversationIds = transformedConversations.map(c => c.id);
      if (conversationIds.length > 0) {
        // Get unread counts
        const { data: unreadData } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        // Count unread messages per conversation
        const unreadCounts = unreadData?.reduce((acc, msg) => {
          acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        // Get last messages for each conversation
        const lastMessages = await Promise.all(conversationIds.map(async (convId) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return { conversationId: convId, lastMessage: lastMsg };
        }));

        // Add unread counts and last messages to conversations
        transformedConversations.forEach(conv => {
          conv.unread_count = unreadCounts[conv.id] || 0;
          const lastMsgData = lastMessages.find(lm => lm.conversationId === conv.id);
          if (lastMsgData?.lastMessage) {
            conv.last_message = lastMsgData.lastMessage;
          }
        });
      }

      console.log('Final transformed conversations:', transformedConversations);
      setConversations(transformedConversations);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setError(err.message);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateConversation = async (otherUserId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        p_user1_id: user.id,
        p_user2_id: otherUserId
      });

      if (error) throw error;
      
      // Refresh conversations list to show the new conversation
      await fetchConversations();
      
      return data;
    } catch (err: any) {
      console.error('Error getting/creating conversation:', err);
      throw err;
    }
  };

  const sendMessage = async (conversationId: string, content: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch (err: any) {
      console.error('Error marking messages as read:', err);
    }
  };

  const fetchMessages = async (conversationId: string): Promise<Message[]> => {
    if (!user) return [];

    try {
      // Fetch messages first
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (!messagesData || messagesData.length === 0) {
        return [];
      }

      // Get unique sender IDs
      const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];

      // Fetch profiles for all senders
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', senderIds);

      if (profilesError) {
        console.error('Error fetching sender profiles:', profilesError);
      }

      // Transform messages to include sender profiles
      const messagesWithProfiles = messagesData.map(msg => ({
        ...msg,
        sender_profile: profiles?.find(p => p.id === msg.sender_id) || { 
          id: msg.sender_id, 
          name: 'Unknown User', 
          email: '' 
        }
      }));

      return messagesWithProfiles;
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      return [];
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    getOrCreateConversation,
    sendMessage,
    markMessagesAsRead,
    fetchMessages,
  };
}
