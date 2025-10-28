import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private session: any = null;

  async connect(session: any) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.session = session;

    // Get the auth token from session
    const token = session?.access_token;

    if (!token) {
      console.error('No auth token available for socket connection');
      return null;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

    this.socket = io(socketUrl, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventListeners();

    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  joinConversation(conversationId: string) {
    if (this.socket?.connected) {
      this.socket.emit('join-conversation', { conversationId });
    }
  }

  leaveConversation(conversationId: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave-conversation', { conversationId });
    }
  }

  sendMessage(conversationId: string, content: string, attachments?: string) {
    if (this.socket?.connected) {
      this.socket.emit('send-message', { conversationId, content, attachments });
    }
  }

  markAsRead(conversationId: string) {
    if (this.socket?.connected) {
      this.socket.emit('mark-as-read', { conversationId });
    }
  }

  setTyping(conversationId: string, isTyping: boolean) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { conversationId, isTyping });
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  getSocket() {
    return this.socket;
  }
}

export const socketClient = new SocketClient();

