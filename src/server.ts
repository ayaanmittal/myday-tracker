import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabaseService } from './integrations/supabase/service';
import type { Server as HTTPServer } from 'http';

dotenv.config();

const app = express();
const server: HTTPServer = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.VITE_CLIENT_URL || 'http://localhost:8080',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Store active users
const activeUsers = new Map<string, { userId: string; socketId: string; profile: any }>();

// Authentication middleware for Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseService.auth.getUser(token);
    
    if (error || !user) {
      return next(new Error('Authentication error'));
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    socket.data.user = user;
    socket.data.profile = profile;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  const profile = socket.data.profile;

  if (!user) {
    socket.disconnect();
    return;
  }

  console.log(`User connected: ${user.email} (${user.id})`);

  // Add user to active users
  activeUsers.set(user.id, { userId: user.id, socketId: socket.id, profile });

  // Join user's personal room
  socket.join(`user:${user.id}`);

  // Emit user online status
  io.emit('user-online', { userId: user.id, profile });

  // Handle join conversation
  socket.on('join-conversation', async ({ conversationId }) => {
    try {
      // Verify user is part of this conversation
      const { data: conversation, error } = await supabaseService
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error || !conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Check if user is a participant
      if (conversation.participant_1 !== user.id && conversation.participant_2 !== user.id) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      console.log(`User ${user.email} joined conversation ${conversationId}`);
    } catch (error) {
      console.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  // Handle leave conversation
  socket.on('leave-conversation', ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(`User ${user.email} left conversation ${conversationId}`);
  });

  // Handle send message
  socket.on('send-message', async ({ conversationId, content, attachments }) => {
    try {
      const { data: conversation, error: convError } = await supabaseService
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError || !conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Verify user is part of this conversation
      if (conversation.participant_1 !== user.id && conversation.participant_2 !== user.id) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      // Insert message into database
      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: content,
        is_read: false,
      };

      // Add attachments if provided
      if (attachments) {
        messageData.attachments = attachments;
      }

      const { data: message, error: msgError } = await supabaseService
        .from('messages')
        .insert(messageData)
        .select('*')
        .single();

      if (msgError) {
        console.error('Error inserting message:', msgError);
        socket.emit('error', { message: 'Failed to send message' });
        return;
      }

      // Update conversation last message
      await supabaseService
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_id: message.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      // Emit message to all participants in the conversation room
      io.to(`conversation:${conversationId}`).emit('new-message', {
        ...message,
        attachments: attachments || message.attachments,
        sender_profile: profile,
      });

      // Notify the recipient (if not in the conversation)
      const otherUserId = conversation.participant_1 === user.id 
        ? conversation.participant_2 
        : conversation.participant_1;

      socket.to(`user:${otherUserId}`).emit('new-message-notification', {
        conversationId,
        message,
        sender: profile,
      });

      console.log(`Message sent in conversation ${conversationId} by ${user.email}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle mark as read
  socket.on('mark-as-read', async ({ conversationId }) => {
    try {
      // Get conversation details
      const { data: conversation, error: convError } = await supabaseService
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError || !conversation) {
        console.error('Conversation not found');
        return;
      }

      const otherUserId = conversation.participant_1 === user.id 
        ? conversation.participant_2 
        : conversation.participant_1;

      // Mark all unread messages in this conversation as read
      const { error } = await supabaseService
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }

      // Notify the sender that messages were read
      io.to(`user:${otherUserId}`).emit('messages-read', {
        conversationId,
        readBy: user.id,
      });

      console.log(`Messages marked as read in conversation ${conversationId} by ${user.email}`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle typing indicator
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('user-typing', {
      userId: user.id,
      profile,
      isTyping,
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${user.email}`);
    activeUsers.delete(user.id);
    io.emit('user-offline', { userId: user.id });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeUsers: activeUsers.size });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});

