import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, type Message } from '@/hooks/useConversations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, ArrowLeft, Send, Users, User, Check, CheckCheck, Search, MoreVertical, Trash2, Paperclip, Image, File, X } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { socketClient } from '@/lib/socketClient';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    conversations,
    loading,
    getOrCreateConversation,
    sendMessage: sendMsg,
    markMessagesAsRead,
    fetchMessages,
    fetchConversations,
  } = useConversations();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;

    // Fetch all users for starting conversations
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .eq('is_active', true);

      setAllUsers(data || []);
    };

    fetchUsers();
  }, [user]);

  const regenerateAttachmentUrl = async (path: string) => {
    try {
      const { data: signedUrlData } = await supabase.storage
        .from('message-attachments')
        .createSignedUrl(path, 31536000);
      
      return signedUrlData?.signedUrl || '';
    } catch (error) {
      console.error('Error regenerating signed URL:', error);
      return '';
    }
  };

  useEffect(() => {
    if (!selectedConversationId) return;

    const loadConversation = async () => {
      setMessagesLoading(true);
      socketClient.joinConversation(selectedConversationId);
      
      try {
        const msgData = await fetchMessages(selectedConversationId);
        console.log('Loaded messages:', msgData);
        
        // Process messages to ensure attachment URLs are valid
        const processedMessages = await Promise.all(
          msgData.map(async (msg: any) => {
            if (msg.attachments) {
              try {
                let attachmentsArray = [];
                if (typeof msg.attachments === 'string') {
                  attachmentsArray = JSON.parse(msg.attachments);
                } else if (Array.isArray(msg.attachments)) {
                  attachmentsArray = msg.attachments;
                }
                
                // Regenerate signed URLs for each attachment
                const processedAttachments = await Promise.all(
                  attachmentsArray.map(async (att: any) => {
                    if (att.path && (!att.url || att.url === '')) {
                      att.url = await regenerateAttachmentUrl(att.path);
                    }
                    return att;
                  })
                );
                
                msg.attachments = JSON.stringify(processedAttachments);
              } catch (error) {
                console.error('Error processing attachments:', error);
              }
            }
            return msg;
          })
        );
        
        setMessages(processedMessages);
        markMessagesAsRead(selectedConversationId);
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    loadConversation();

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      if (message.conversation_id === selectedConversationId) {
        console.log('Received new message via socket:', message);
        setMessages((prev) => {
          // Check if message already exists to avoid duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        markMessagesAsRead(selectedConversationId);
      }
    };

    // Listen for read receipts
    const handleMessagesRead = (data: any) => {
      if (data.conversationId === selectedConversationId) {
        console.log('Messages marked as read by:', data.readBy);
        setMessages((prev) =>
          prev.map((msg) => {
            // Mark all messages in this conversation as read when the other user reads them
            if (msg.sender_id === user?.id && !msg.is_read) {
              return { ...msg, is_read: true };
            }
            return msg;
          })
        );
      }
    };

    socketClient.on('new-message', handleNewMessage);
    socketClient.on('messages-read', handleMessagesRead);

    // Also set up a poll to reload messages every 2 seconds as a fallback
    const pollInterval = setInterval(async () => {
      try {
        const msgData = await fetchMessages(selectedConversationId);
        setMessages(msgData);
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    }, 2000);

    return () => {
      socketClient.off('new-message', handleNewMessage);
      socketClient.off('messages-read', handleMessagesRead);
      socketClient.leaveConversation(selectedConversationId);
      clearInterval(pollInterval);
    };
  }, [selectedConversationId]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedConversationId) return;

    try {
      let attachments: any[] = [];
      
      // Upload files if any are selected
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles();
        setSelectedFiles([]);
      }

      const content = newMessage.trim();
      setNewMessage('');
      setIsTyping(false);
      socketClient.setTyping(selectedConversationId, false);

      console.log('Sending message:', { selectedConversationId, content, attachments });
      
      // Send message with attachments via Socket.io
      if (socketClient.isConnected()) {
        const attachmentsData = attachments.length > 0 ? JSON.stringify(attachments) : undefined;
        socketClient.sendMessage(selectedConversationId, content, attachmentsData);
      } else {
        await sendMsg(selectedConversationId, content);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleTyping = () => {
    if (!selectedConversationId) return;

    if (!isTyping) {
      setIsTyping(true);
      socketClient.setTyping(selectedConversationId, true);
    }
  };

  const startConversation = async (targetUserId: string) => {
    const conversationId = await getOrCreateConversation(targetUserId);
    if (conversationId) {
      setSelectedConversationId(conversationId);
      setShowUsers(false);
      setSearchQuery(''); // Clear search query
      // Refresh conversations to include the new one
      await fetchConversations();
    }
  };

  const handleDeleteClick = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the conversation selection
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!conversationToDelete || !user) return;

    try {
      // Delete the conversation (this will cascade delete all messages)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationToDelete);

      if (error) throw error;

      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been removed from your messages.',
      });

      // Clear the selected conversation if it was the one deleted
      if (selectedConversationId === conversationToDelete) {
        setSelectedConversationId(null);
        setMessages([]);
      }

      // Refresh conversations list
      await fetchConversations();

      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return File;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const uploadFiles = async (): Promise<any[]> => {
    if (!user || selectedFiles.length === 0) return [];

    const uploadedAttachments: any[] = [];
    setUploading(true);

    try {
      for (const file of selectedFiles) {
        const path = `${user.id}/${selectedConversationId}/${Date.now()}_${file.name}`;
        
        // Upload to storage
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('message-attachments')
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: '3600'
          });

        if (uploadError) {
          console.error('Error uploading file:', file.name, uploadError);
          toast({
            title: 'Upload failed',
            description: `Failed to upload ${file.name}`,
            variant: 'destructive',
          });
          continue;
        }

        // Get a signed URL that's accessible by both sender and receiver
        const { data: signedUrlData } = await supabase.storage
          .from('message-attachments')
          .createSignedUrl(path, 31536000); // Valid for 1 year

        uploadedAttachments.push({
          id: uploadData.path,
          type: file.type.startsWith('image/') ? 'image' : 
                file.type.startsWith('video/') ? 'video' : 'file',
          url: signedUrlData?.signedUrl || '',
          name: file.name,
          size: file.size,
          mime_type: file.type,
          path: path, // Store path for regenerating signed URLs later if needed
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload error',
        description: 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }

    return uploadedAttachments;
  };

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto p-6">
          <div className="text-center">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-3 sm:p-6 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-8rem)] max-w-7xl">
        <div className="flex h-full gap-3 sm:gap-4 flex-col sm:flex-row">
          {/* Conversations List */}
          <Card className={`flex-shrink-0 flex flex-col w-full sm:w-80 ${selectedConversation ? 'hidden sm:flex' : 'flex'}`}>
            <CardHeader className="pb-3 flex-shrink-0 border-b sticky top-0 bg-card z-[1]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Messages</CardTitle>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setShowUsers(!showUsers);
                    if (showUsers) {
                      setSearchQuery(''); // Reset search when switching back to chats
                    }
                  }}
                >
                  {showUsers ? (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chats
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      New Chat
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {showUsers ? (
                  <>
                    <div className="p-3 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Search users..."
                          className="pl-9"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    {(() => {
                      const filteredUsers = allUsers.filter((u) =>
                        searchQuery === '' ||
                        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
                      );

                      if (filteredUsers.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full p-6">
                            <Search className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">No users found</p>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                              Try a different search term
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="divide-y overflow-y-auto">
                          {filteredUsers.map((u) => (
                            <div
                              key={u.id}
                              className="p-4 hover:bg-muted cursor-pointer transition-colors"
                              onClick={() => startConversation(u.id)}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarFallback className="text-base font-semibold">
                                    {u.name?.[0]?.toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{u.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-6">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">No conversations yet</p>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Click "New Chat" to start a conversation
                    </p>
                  </div>
                ) : (
                  <div className="divide-y overflow-y-auto">
                        {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-4 hover:bg-muted cursor-pointer transition-colors relative group ${
                          selectedConversationId === conv.id ? 'bg-blue-50 hover:bg-blue-100' : ''
                        }`}
                        onClick={() => setSelectedConversationId(conv.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-base font-semibold">
                              {conv.other_user?.name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-sm truncate">
                                {conv.other_user?.name}
                              </p>
                              <div className="flex items-center gap-2">
                                {conv.unread_count! > 0 && (
                                  <Badge 
                                    variant="destructive" 
                                    className="flex-shrink-0 h-5 min-w-[1.25rem] px-1.5"
                                  >
                                    {conv.unread_count}
                                  </Badge>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button 
          variant="ghost" 
                                      size="sm"
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
                                      <MoreVertical className="h-4 w-4" />
        </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive cursor-pointer"
                                      onClick={(e) => handleDeleteClick(conv.id, e)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Conversation
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.last_message_at ? 'Tap to view messages' : 'No messages yet'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className={`flex-1 flex flex-col ${selectedConversation ? 'flex' : 'hidden sm:flex'}`}>
            {selectedConversation ? (
              <>
                <CardHeader className="pb-3 border-b sticky top-0 bg-card z-[1]">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sm:hidden mr-1"
                      onClick={() => setSelectedConversationId(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar>
                      <AvatarFallback>{selectedConversation.other_user?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{selectedConversation.other_user?.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation.other_user?.email}
                      </p>
                    </div>
            </div>
          </CardHeader>
                <ScrollArea className="flex-1 p-3 sm:p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Start a conversation!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {messages.map((msg) => {
                        const isOwnMessage = msg.sender_id === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex px-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3 py-2 space-y-2 whitespace-pre-wrap break-words shadow-sm ${
                                isOwnMessage ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                              }`}
                            >
                              {/* Display Attachments */}
                              {(() => {
                                try {
                                  const attachments = (msg as any).attachments;
                                  if (!attachments) return null;
                                  
                                  // Handle if attachments is already an array
                                  let attachmentsArray = [];
                                  if (typeof attachments === 'string') {
                                    if (attachments.trim() === '') return null;
                                    attachmentsArray = JSON.parse(attachments);
                                  } else if (Array.isArray(attachments)) {
                                    attachmentsArray = attachments;
                                  }
                                  
                                  if (!Array.isArray(attachmentsArray) || attachmentsArray.length === 0) return null;
                                  
                                  return (
                                    <div className="space-y-1">
                                      {attachmentsArray.map((att: any, idx: number) => (
                                    <div key={idx} className="rounded overflow-hidden">
                                      {att.type === 'image' && (
                                        <a
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={att.name}
                                          className="block"
                                        >
                                          <img 
                                            src={att.url} 
                                            alt={att.name}
                                            className="max-w-full rounded cursor-pointer hover:opacity-90 transition-opacity"
                                            style={{ maxHeight: '200px' }}
                                          />
                                        </a>
                                      )}
                                      {att.type === 'video' && (
                                        <a
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={att.name}
                                          className="block"
                                        >
                                          <video 
                                            src={att.url} 
                                            controls
                                            className="max-w-full rounded cursor-pointer"
                                            style={{ maxHeight: '200px' }}
                                          />
                                        </a>
                                      )}
                                      {att.type === 'file' && (
                                        <a 
                                          href={att.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          download={att.name}
                                          className="flex items-center gap-2 text-xs underline hover:opacity-80"
                                        >
                                          <File className="h-4 w-4" />
                                          {att.name} ({formatFileSize(att.size)})
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                    </div>
                                  );
                                } catch (error) {
                                  console.error('Error parsing attachments:', error);
                                  return null;
                                }
                              })()}
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <div className="flex items-center gap-1.5 mt-1 justify-end">
                                <p
                                  className={`text-xs ${
                                    isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                  }`}
                                >
                                  {format(new Date(msg.created_at), 'HH:mm')}
                                </p>
                                {isOwnMessage && (
                                  <span className={`${
                                    msg.is_read 
                                      ? 'text-blue-400' 
                                      : 'text-primary-foreground/40'
                                  }`}>
                                    {msg.is_read ? (
                                      <CheckCheck className="h-4 w-4 font-bold" strokeWidth={2.5} />
                                    ) : (
                                      <Check className="h-4 w-4" strokeWidth={1.5} />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
            </div>
                  )}
                </ScrollArea>
                <div className="p-3 sm:p-4 border-t space-y-3">
                  {/* Selected Files Preview */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
                      {selectedFiles.map((file, index) => {
                        const FileIcon = getFileIcon(file);
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-background border rounded-lg p-2 text-sm"
                          >
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-3 w-3" />
              </Button>
            </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      placeholder="Type a message"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={uploading}
                    />
                    <Button 
                      type="submit" 
                      disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploading}
                    >
                      {uploading ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div>
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                  <p className="text-muted-foreground">
                    Choose a conversation from the list to start chatting
                  </p>
                </div>
              </div>
            )}
        </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone and will remove all messages in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
