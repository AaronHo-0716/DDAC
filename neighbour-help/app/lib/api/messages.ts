import type {
  ChatMessage,
  ConversationListResponse,
  ConversationParticipant,
  ConversationStatus,
  ConversationSummary,
  ConversationType,
  CreateOrOpenJobConversationRequest,
  MessageListResponse,
  MessageType,
  SendMessageRequest,
  UnreadCountResponse,
  UserRole,
} from "@/app/types";
import { apiClient } from "./client";

interface RawConversationParticipantDto {
  userId?: string | null;
  id?: string | null;
  name?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
}

interface RawConversationDto {
  id?: string | null;
  type?: string | null;
  status?: string | null;
  relatedJobId?: string | null;
  relatedBidId?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number | null;
  participants?: RawConversationParticipantDto[] | null;
}

interface RawConversationListResponse {
  conversations?: RawConversationDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

interface RawMessageDto {
  id?: string | null;
  conversationId?: string | null;
  senderUserId?: string | null;
  senderName?: string | null;
  messageType?: string | null;
  bodyText?: string | null;
  createdAt?: string | null;
  isDeleted?: boolean | null;
}

interface RawMessageListResponse {
  messages?: RawMessageDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

const KNOWN_CONVERSATION_TYPES: ConversationType[] = ["job_chat", "admin_support"];
const KNOWN_CONVERSATION_STATUSES: ConversationStatus[] = ["active", "locked", "closed"];
const KNOWN_MESSAGE_TYPES: MessageType[] = ["text", "system", "admin_note"];
const KNOWN_ROLES: UserRole[] = ["homeowner", "handyman", "admin"];

function normalizeConversationType(value?: string | null): ConversationType {
  const normalized = (value ?? "").toLowerCase();
  if (KNOWN_CONVERSATION_TYPES.includes(normalized as ConversationType)) {
    return normalized as ConversationType;
  }
  return "job_chat";
}

function normalizeConversationStatus(value?: string | null): ConversationStatus {
  const normalized = (value ?? "").toLowerCase();
  if (KNOWN_CONVERSATION_STATUSES.includes(normalized as ConversationStatus)) {
    return normalized as ConversationStatus;
  }
  return "active";
}

function normalizeMessageType(value?: string | null): MessageType {
  const normalized = (value ?? "").toLowerCase();
  if (KNOWN_MESSAGE_TYPES.includes(normalized as MessageType)) {
    return normalized as MessageType;
  }
  return "text";
}

function normalizeRole(value?: string | null): UserRole {
  const normalized = (value ?? "").toLowerCase();
  if (KNOWN_ROLES.includes(normalized as UserRole)) {
    return normalized as UserRole;
  }
  return "homeowner";
}

function normalizeParticipant(row: RawConversationParticipantDto): ConversationParticipant {
  return {
    userId: row.userId ?? row.id ?? "",
    name: row.name ?? "Unknown user",
    role: normalizeRole(row.role),
    avatarUrl: row.avatarUrl ?? undefined,
  };
}

function normalizeConversation(row: RawConversationDto): ConversationSummary {
  return {
    id: row.id ?? "",
    type: normalizeConversationType(row.type),
    status: normalizeConversationStatus(row.status),
    relatedJobId: row.relatedJobId ?? undefined,
    relatedBidId: row.relatedBidId ?? undefined,
    lastMessagePreview: row.lastMessagePreview ?? undefined,
    lastMessageAt: row.lastMessageAt ?? undefined,
    unreadCount: typeof row.unreadCount === "number" ? row.unreadCount : 0,
    participants: Array.isArray(row.participants)
      ? row.participants.map(normalizeParticipant)
      : [],
  };
}

function normalizeConversationList(raw: RawConversationListResponse): ConversationListResponse {
  const conversations = Array.isArray(raw.conversations)
    ? raw.conversations.map(normalizeConversation)
    : [];

  return {
    conversations,
    page: typeof raw.page === "number" ? raw.page : 1,
    pageSize: typeof raw.pageSize === "number" ? raw.pageSize : conversations.length,
    totalCount: typeof raw.totalCount === "number" ? raw.totalCount : conversations.length,
  };
}

function normalizeMessage(row: RawMessageDto): ChatMessage {
  return {
    id: row.id ?? "",
    conversationId: row.conversationId ?? "",
    senderUserId: row.senderUserId ?? "",
    senderName: row.senderName ?? undefined,
    messageType: normalizeMessageType(row.messageType),
    bodyText: row.bodyText ?? "",
    createdAt: row.createdAt ?? new Date(0).toISOString(),
    isDeleted: !!row.isDeleted,
  };
}

function normalizeMessageList(raw: RawMessageListResponse): MessageListResponse {
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(normalizeMessage)
    : [];

  return {
    messages,
    page: typeof raw.page === "number" ? raw.page : 1,
    pageSize: typeof raw.pageSize === "number" ? raw.pageSize : messages.length,
    totalCount: typeof raw.totalCount === "number" ? raw.totalCount : messages.length,
  };
}

export const messagesService = {
  async createOrOpenJobConversation(
    data: CreateOrOpenJobConversationRequest
  ): Promise<ConversationSummary> {
    const response = await apiClient.post<RawConversationDto>(
      "/messages/conversations/job",
      data
    );
    return normalizeConversation(response);
  },

  async getConversations(params?: {
    page?: number;
    pageSize?: number;
    type?: ConversationType;
  }): Promise<ConversationListResponse> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.type) search.set("type", params.type);

    const suffix = search.toString();
    const path = suffix
      ? `/messages/conversations?${suffix}`
      : "/messages/conversations";

    const response = await apiClient.get<RawConversationListResponse>(path);
    return normalizeConversationList(response);
  },

  async getConversation(conversationId: string): Promise<ConversationSummary> {
    const response = await apiClient.get<RawConversationDto>(
      `/messages/conversations/${conversationId}`
    );
    return normalizeConversation(response);
  },

  async getMessages(
    conversationId: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<MessageListResponse> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));

    const suffix = search.toString();
    const path = suffix
      ? `/messages/conversations/${conversationId}/messages?${suffix}`
      : `/messages/conversations/${conversationId}/messages`;

    const response = await apiClient.get<RawMessageListResponse>(path);
    return normalizeMessageList(response);
  },

  async sendMessage(
    conversationId: string,
    data: SendMessageRequest
  ): Promise<ChatMessage> {
    const response = await apiClient.post<RawMessageDto>(
      `/messages/conversations/${conversationId}/messages`,
      data
    );
    return normalizeMessage(response);
  },

  async markConversationRead(conversationId: string, lastReadMessageId?: string): Promise<void> {
    await apiClient.patch(`/messages/conversations/${conversationId}/read`, {
      lastReadMessageId,
    });
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient.get<UnreadCountResponse>("/messages/unread-count");
  },
};
