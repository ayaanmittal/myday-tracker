# Real-Time Messaging System with Socket.io

This guide explains how to use the new real-time messaging system.

## Features

✅ **Bi-directional real-time chat** between managers, admins, and employees  
✅ **Socket.io backend** for instant message delivery  
✅ **Supabase database** for persistent message storage  
✅ **Beautiful chat UI** with conversation lists  
✅ **Read receipts** and typing indicators  
✅ **Unread message counts**  
✅ **Start new conversations** with any user  

## Setup Instructions

### 1. Start the Socket.io Server

The messaging system requires a Socket.io backend server to run. Start it with:

```bash
npm run server
```

This will start the server on port 3000 (or the PORT specified in your `.env`).

### 2. Add Environment Variables

Create or update your `.env` file:

```env
# Socket.io Server Configuration
PORT=3000
VITE_SOCKET_URL=http://localhost:3000

# Supabase Configuration (should already exist)
VITE_SUPABASE_URL=https://iurnwjzxqskliuyttomt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

### 3. Start the Frontend

In a separate terminal, start the frontend development server:

```bash
npm run dev
```

## How It Works

### Architecture

1. **Socket.io Server** (`src/server.ts`)
   - Handles WebSocket connections
   - Authenticates users via Supabase tokens
   - Manages conversation rooms
   - Broadcasts messages in real-time

2. **Socket Client** (`src/lib/socketClient.ts`)
   - Connects to the server with auth token
   - Provides methods for sending/receiving messages
   - Manages connection lifecycle

3. **React Hooks** (`src/hooks/useConversations.tsx`)
   - Fetches conversations from Supabase
   - Provides functions to send messages
   - Handles real-time updates

4. **UI Component** (`src/pages/Messages.tsx`)
   - Beautiful chat interface
   - Conversation list sidebar
   - Real-time message display
   - User selection for new conversations

### Database Schema

The messaging system uses these Supabase tables:

**Conversations** - Stores conversation pairs between users
- `id` - Unique conversation ID
- `participant_1` - First user ID
- `participant_2` - Second user ID
- `last_message_at` - Timestamp of last message
- `last_message_id` - Reference to last message
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Messages** - Stores individual messages
- `id` - Unique message ID
- `conversation_id` - Reference to conversation
- `sender_id` - Message sender's user ID
- `content` - Message text
- `is_read` - Read status
- `created_at` - Message timestamp
- `updated_at` - Last update timestamp

### Message Flow

1. User selects a person from the conversation list
2. User types a message and hits Enter
3. Message is sent via Socket.io to the server
4. Server validates and saves to Supabase database
5. Server broadcasts to all participants in the conversation room
6. Both users see the message instantly

### Starting a New Conversation

1. Click the users icon (👥) in the conversations list
2. Browse available users
3. Click on a user to start chatting
4. The conversation will appear in your list
5. Type and send messages!

## Features in Detail

### Real-Time Updates
- Messages appear instantly for both participants
- No page refresh needed
- Automatic reconnection if connection drops

### Read Receipts
- Messages are marked as read when viewed
- Both users can see if their messages have been read
- Real-time read status updates

### Typing Indicators
- Shows when the other person is typing
- Automatically times out after 3 seconds
- Real-time typing status updates

### Unread Count
- Shows number of unread messages per conversation
- Badge displayed on conversation list
- Auto-updates in real-time

### User Selection
- Browse all active users
- Search by name or email
- See user avatars and basic info
- Start conversations instantly

## Troubleshooting

### Messages Not Sending
- Check that the Socket.io server is running
- Verify authentication token is valid
- Check browser console for errors

### Real-Time Updates Not Working
- Ensure WebSocket connection is established
- Check network/firewall settings
- Verify CORS configuration

### Conversation Not Appearing
- Refresh the conversations list
- Check Supabase database for the conversation
- Verify user IDs are correct

### Server Not Starting
- Check that port 3000 is available
- Verify all dependencies are installed
- Check environment variables are set

## Production Deployment

### For Production:
1. Update `VITE_SOCKET_URL` to your production server URL
2. Update CORS settings in `src/server.ts` to allow your production domain
3. Set up reverse proxy for Socket.io (nginx/apache)
4. Use environment variables for sensitive config
5. Enable HTTPS for WebSocket connections (wss://)

### Recommended Setup:
- Socket.io server: Separate Node.js process
- Use PM2 or similar for process management
- Set up monitoring and logging
- Use Supabase Realtime for additional features

## Notes

- The server uses Supabase's service client to bypass RLS when needed
- All messages are stored in Supabase for persistence
- Socket.io handles real-time delivery
- Messages are automatically loaded when opening a conversation
- Connection is maintained while the page is open

Enjoy your new real-time messaging system! 🎉

