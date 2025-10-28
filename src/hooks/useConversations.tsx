import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { socketClient } from '@/lib/socketClient';

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
  const { user, session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect to socket when user is available
  useEffect(() => {
    if (user && session) {
      socketClient.connect(session);
    }

    return () => {
      socketClient.disconnect();
    };
  }, [user, session]);

  const fetchConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      // Fetch conversations where user is a participant
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch other user details for each conversation
      const conversationsWithUsers = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.participant_1 === user.id 
            ? conv.participant_2 
            : conv.participant_1;

          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', otherUserId)
            .single();

          // Get unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            ...conv,
            other_user: profile,
            unread_count: count || 0,
          };
        })
      );

      setConversations(conversationsWithUsers);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Ensure consistent ordering (smaller UUID first)
      const participant1 = user.id < otherUserId ? user.id : otherUserId;
      const participant2 = user.id < otherUserId ? otherUserId : user.id;

      // Check if conversation already exists
      const { data: existing, error: checkError } = await supabase
        .from('conversations')
        .select('*')
        .eq('participant_1', participant1)
        .eq('participant_2', participant2)
        .single();

      if (existing) {
        return existing.id;
      }

      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          participant_1: participant1,
          participant_2: participant2,
        })
        .select()
        .single();

      if (createError) throw createError;

      return newConv.id;
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      return null;
    }
  };

  const sendMessage = async (conversationId: string, content: string): Promise<void> => {
    socketClient.sendMessage(conversationId, content);
  };

  const markMessagesAsRead = async (conversationId: string): Promise<void> => {
    if (!user) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      socketClient.markAsRead(conversationId);
      
      // Refresh conversations to update unread counts
      fetchConversations();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const fetchMessages = async (conversationId: string): Promise<Message[]> => {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles for each message
      const messagesWithProfiles = await Promise.all(
        (messages || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', msg.sender_id)
            .single();

          return {
            ...msg,
            sender_profile: profile,
          };
        })
      );

      return messagesWithProfiles;
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      return [];
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
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
