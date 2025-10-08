import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    // Temporarily disabled - schema mismatch
    console.log('Conversations feature temporarily disabled');
    setConversations([]);
    setLoading(false);
  };

  const getOrCreateConversation = async (otherUserId: string) => {
    console.log('Conversations feature temporarily disabled');
    return null;
  };

  const sendMessage = async (conversationId: string, content: string) => {
    console.log('Messaging feature temporarily disabled');
    return null;
  };

  const markMessagesAsRead = async (conversationId: string) => {
    console.log('Messaging feature temporarily disabled');
  };

  const fetchMessages = async (conversationId: string): Promise<Message[]> => {
    console.log('Messaging feature temporarily disabled');
    return [];
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
