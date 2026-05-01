import { apiClient } from "./client";
import { ConversationType } from "@/app/types";
import type {
  ChatMessage,
  ChatParticipant,
  Conversation,
  CreateJobChatRequest,
  SendMessageRequest,
  UnreadCountResponse,
} from "@/app/types";

interface RawMessage {
  id?: string;
  senderId?: string;
  type?: unknown;
  content?: string;
  createdAtUtc?: string;
}

interface RawParticipant {
  userId?: string;
  name?: string;
  role?: ChatParticipant["role"];
  avatarUrl?: string | null;
  averageRating?: number | null;
}

interface RawConversation {
  id?: string;
  type?: Conversation["type"];
  relatedJobId?: string | null;
  relatedJobTitle?: string | null;
  createdAtUtc?: string;
  lastMessageAtUtc?: string | null;
  unreadCount?: number | null;
  lastMessage?: RawMessage | null;
  participants?: RawParticipant[] | null;
}

const normalizeMessageType = (value: unknown): ChatMessage["type"] => {
  if (typeof value === "number") {
    if (value === 1) return "image";
    if (value === 2) return "system";
    return "text";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "image") return "image";
    if (normalized === "2" || normalized === "system") return "system";
    return "text";
  }

  return "text";
};

const normalizeMessage = (data: RawMessage): ChatMessage => ({
  id: data.id ?? "",
  senderId: data.senderId ?? "",
  type: normalizeMessageType(data.type),
  content: data.content ?? "",
  createdAtUtc: data.createdAtUtc ?? new Date(0).toISOString(),
});

const normalizeConversation = (data: RawConversation): Conversation => ({
  id: data.id ?? "",
  type: data.type ?? ConversationType.JobChat,
  relatedJobId: data.relatedJobId || undefined,
  relatedJobTitle: data.relatedJobTitle || undefined,
  createdAtUtc: data.createdAtUtc ?? new Date(0).toISOString(),
  lastMessageAtUtc: data.lastMessageAtUtc || undefined,
  unreadCount: data.unreadCount || 0,
  lastMessage: data.lastMessage ? normalizeMessage(data.lastMessage) : undefined,
  participants: (data.participants || []).map((p) => ({
    userId: p.userId ?? "",
    name: p.name ?? "Unknown user",
    role: p.role ?? "homeowner",
    avatarUrl: p.avatarUrl || undefined,
    averageRating: p.averageRating || undefined,
  })),
});

export const messagesService = {
  async createJobConversation(data: CreateJobChatRequest): Promise<Conversation> {
    // Added {} if your client expects config as 3rd arg, but body is 2nd
    const response = await apiClient.post<RawConversation>("/messages/conversations/job", data);
    return normalizeConversation(response);
  },

  async getConversations(): Promise<Conversation[]> {
    // Added {} as the 2nd argument (params/config)
    const response = await apiClient.get<RawConversation[]>("/messages/conversations", {});
    return response.map(normalizeConversation);
  },

  async getConversation(id: string): Promise<Conversation> {
    // Added {} as the 2nd argument
    const response = await apiClient.get<RawConversation>(`/messages/conversations/${id}`, {});
    return normalizeConversation(response);
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    // Added {} as the 2nd argument
    const response = await apiClient.get<RawMessage[]>(`/messages/conversations/${conversationId}/messages`, {});
    return response.map(normalizeMessage);
  },

  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<ChatMessage> {
    const response = await apiClient.post<RawMessage>(
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

// --- NEW SUPPORT SERVICE ---
export const supportService = {
  async createSupportConversation(): Promise<Conversation> {
    const response = await apiClient.post<RawConversation>("/support/conversation", {});
    return normalizeConversation(response);
  },

  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<RawConversation[]>("/support/conversations", {});
    return response.map(normalizeConversation);
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const response = await apiClient.get<RawMessage[]>(`/support/conversations/${conversationId}/messages`, {});
    return response.map(normalizeMessage);
  },

  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<ChatMessage> {
    const response = await apiClient.post<RawMessage>(`/support/conversations/${conversationId}/messages`, data);
    return normalizeMessage(response);
  },

  async markAsRead(conversationId: string): Promise<void> {
    await apiClient.patch(`/support/conversations/${conversationId}/read`, {});
  },
  
  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<UnreadCountResponse>("/support/unread-count", {});
    return response.totalUnread;
  }
};
