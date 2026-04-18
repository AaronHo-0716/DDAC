import { apiClient } from "./client";
import type {
  ChatMessage,
  Conversation,
  CreateJobChatRequest,
  SendMessageRequest,
  UnreadCountResponse,
} from "@/app/types";

const normalizeMessage = (data: any): ChatMessage => ({
  id: data.id,
  senderId: data.senderId,
  type: data.type,
  content: data.content,
  createdAtUtc: data.createdAtUtc,
});

const normalizeConversation = (data: any): Conversation => ({
  id: data.id,
  type: data.type,
  relatedJobId: data.relatedJobId || undefined,
  relatedJobTitle: data.relatedJobTitle || undefined,
  createdAtUtc: data.createdAtUtc,
  lastMessageAtUtc: data.lastMessageAtUtc || undefined,
  unreadCount: data.unreadCount || 0,
  lastMessage: data.lastMessage ? normalizeMessage(data.lastMessage) : undefined,
  participants: (data.participants || []).map((p: any) => ({
    userId: p.userId,
    name: p.name,
    role: p.role,
    avatarUrl: p.avatarUrl || undefined,
    averageRating: p.averageRating || undefined,
  })),
});

export const messagesService = {
  async createJobConversation(data: CreateJobChatRequest): Promise<Conversation> {
    // Added {} if your client expects config as 3rd arg, but body is 2nd
    const response = await apiClient.post<any>("/messages/conversations/job", data);
    return normalizeConversation(response);
  },

  async createSupportConversation(): Promise<Conversation> {
    // Ensuring the body {} is passed as the 2nd argument
    const response = await apiClient.post<any>("/messages/conversations/support", {});
    return normalizeConversation(response);
  },

  async getConversations(): Promise<Conversation[]> {
    // Added {} as the 2nd argument (params/config)
    const response = await apiClient.get<any[]>("/messages/conversations", {});
    return response.map(normalizeConversation);
  },

  async getConversation(id: string): Promise<Conversation> {
    // Added {} as the 2nd argument
    const response = await apiClient.get<any>(`/messages/conversations/${id}`, {});
    return normalizeConversation(response);
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    // Added {} as the 2nd argument
    const response = await apiClient.get<any[]>(`/messages/conversations/${conversationId}/messages`, {});
    return response.map(normalizeMessage);
  },

  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<ChatMessage> {
    const response = await apiClient.post<any>(
      `/messages/conversations/${conversationId}/messages`, 
      data
    );
    return normalizeMessage(response);
  },

  async markAsRead(conversationId: string): Promise<void> {
    // Added {} as the 2nd argument (the body for the PATCH request)
    await apiClient.patch(`/messages/conversations/${conversationId}/read`, {});
  },

  async getUnreadCount(): Promise<number> {
    // Added {} as the 2nd argument
    const response = await apiClient.get<UnreadCountResponse>("/messages/unread-count", {});
    return response.totalUnread;
  }
};