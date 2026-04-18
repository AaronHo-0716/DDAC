import { apiClient } from "./client";
import type { ChatMessage } from "@/app/types";

function normalizeMessageType(value: unknown): ChatMessage["type"] {
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
}

function normalizeChatMessage(data: any): ChatMessage {
  return {
    id: data.id,
    senderId: data.senderId,
    type: normalizeMessageType(data.type),
    content: data.content,
    createdAtUtc: data.createdAtUtc,
  };
}

export const uploadsService = {
  async uploadJobImage(file: File, targetId: string): Promise<void> {
    const formData = new FormData();
    formData.append("File", file);
    formData.append("UploadType", "JobImage");
    formData.append("TargetId", targetId);

    await apiClient.postForm<unknown>("/uploads", formData);
  },

  async uploadJobChatAttachmentImage(file: File, conversationId: string): Promise<ChatMessage> {
    const formData = new FormData();
    formData.append("File", file);
    formData.append("UploadType", "JobConversationAtt");
    formData.append("TargetId", conversationId);

    const response = await apiClient.postForm<any>("/uploads", formData);
    return normalizeChatMessage(response);
  },

  async uploadSupportChatAttachmentImage(file: File, conversationId: string): Promise<ChatMessage> {
    const formData = new FormData();
    formData.append("File", file);
    formData.append("UploadType", "SupportConversationAtt");
    formData.append("TargetId", conversationId);

    const response = await apiClient.postForm<any>("/uploads", formData);
    return normalizeChatMessage(response);
  },
};
