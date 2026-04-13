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
  createdAtUtc?: string | null;
  lastMessageAtUtc?: string | null;
  unreadCount?: number | null;
  lastMessage?: RawMessageDto | null;
  participants?: RawConversationParticipantDto[] | null;
}

interface RawMessageDto {
  id?: string | null;
  senderId?: string | null;
  messageType?: string | null;
  bodyText?: string | null;
  createdAtUtc?: string | null;
  isDeleted?: boolean | null;
  clientMessageId?: string | null;
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
  const lastMessageAt = row.lastMessageAtUtc ?? row.lastMessage?.createdAtUtc ?? undefined;

  return {
    id: row.id ?? "",
    type: normalizeConversationType(row.type),
    status: normalizeConversationStatus(row.status),
    relatedJobId: undefined,
    relatedBidId: undefined,
    lastMessagePreview: row.lastMessage?.bodyText ?? undefined,
    lastMessageAt,
    unreadCount: typeof row.unreadCount === "number" ? row.unreadCount : 0,
    participants: Array.isArray(row.participants)
      ? row.participants.map(normalizeParticipant)
      : [],
  };
}

function normalizeConversationList(raw: RawConversationDto[]): ConversationListResponse {
  const conversations = Array.isArray(raw)
    ? raw.map(normalizeConversation)
    : [];

  return {
    conversations,
    page: 1,
    pageSize: conversations.length,
    totalCount: conversations.length,
  };
}

function normalizeMessage(row: RawMessageDto, conversationId: string): ChatMessage {
  return {
    id: row.id ?? "",
    conversationId,
    senderUserId: row.senderId ?? "",
    senderName: undefined,
    messageType: normalizeMessageType(row.messageType),
    bodyText: row.bodyText ?? "",
    createdAt: row.createdAtUtc ?? new Date(0).toISOString(),
    isDeleted: !!row.isDeleted,
  };
}

function normalizeMessageList(raw: RawMessageDto[], conversationId: string): MessageListResponse {
  const messages = Array.isArray(raw)
    ? raw.map((message) => normalizeMessage(message, conversationId))
    : [];

  return {
    messages,
    page: 1,
    pageSize: messages.length,
    totalCount: messages.length,
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

  async createOrOpenSupportConversation(targetUserId?: string): Promise<ConversationSummary> {
    const response = await apiClient.post<RawConversationDto>(
      "/messages/conversations/support",
      { targetUserId: targetUserId ?? null }
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

    const response = await apiClient.get<RawConversationDto[]>(path);
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

    const response = await apiClient.get<RawMessageDto[]>(path);
    return normalizeMessageList(response, conversationId);
  },

  async sendMessage(
    conversationId: string,
    data: SendMessageRequest
  ): Promise<ChatMessage> {
    const response = await apiClient.post<RawMessageDto>(
      `/messages/conversations/${conversationId}/messages`,
      data
    );
    return normalizeMessage(response, conversationId);
  },

  async markConversationRead(conversationId: string, lastReadMessageId?: string): Promise<void> {
    void lastReadMessageId;
    await apiClient.patch(`/messages/conversations/${conversationId}/read`, {
      acknowledged: true,
    });
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const unreadCount = await apiClient.get<number>("/messages/unread-count");
    return { unreadCount: typeof unreadCount === "number" ? unreadCount : 0 };
  },
};
