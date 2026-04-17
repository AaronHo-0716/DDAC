"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import {
  ConversationType,
  type ChatMessage,
  type Conversation
} from "@/app/types";
import { useAuth } from "@/app/lib/context/AuthContext";
import { messagesService } from "@/app/lib/api/messages";
import { useChatWidget } from "../../lib/context/ChatWidgetContext";

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastSeen(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Updated to match camelCase Enums
function getConversationTitle(conversation: Conversation, currentUserId: string) {
  const others = conversation.participants.filter((p) => p.userId !== currentUserId);
  if (others.length > 0) {
    return others.map((p) => p.name).join(", ");
  }

  if (conversation.type.toLowerCase() === ConversationType.AdminSupport) {
    return "Admin Support";
  }

  return "Job Chat";
}

export default function ChatWidget() {
  const { user } = useAuth();
  const {
    isOpen,
    open,
    close,
    activeConversationId,
    setActiveConversationId,
    pendingJobChat,
    clearPendingJobChat,
  } = useChatWidget();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      // Updated to match new totalUnread DTO key
      const count = await messagesService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }

    setConversationsLoading(true);
    setConversationsError(null);

    try {
      // Backend now returns a direct array
      const response = await messagesService.getConversations();
      setConversations(response);
    } catch (err) {
      setConversationsError(err instanceof Error ? err.message : "Unable to load chats right now.");
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      // Backend now returns a direct array
      const response = await messagesService.getMessages(conversationId);

      const sorted = [...response].sort(
        (a, b) => +new Date(a.createdAtUtc) - +new Date(b.createdAtUtc)
      );
      setMessages(sorted);

      await messagesService.markAsRead(conversationId);
      await refreshUnread();
      await loadConversations();
      window.dispatchEvent(new Event("nh_messages_updated"));
    } catch (err) {
      setMessagesError(err instanceof Error ? err.message : "Unable to load messages.");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [loadConversations, refreshUnread]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setMessages([]);
      setUnreadCount(0);
      return;
    }

    void refreshUnread();

    const listener = () => {
      void refreshUnread();
      if (isOpen) void loadConversations();
    };

    window.addEventListener("nh_messages_updated", listener);
    return () => window.removeEventListener("nh_messages_updated", listener);
  }, [user, refreshUnread, isOpen, loadConversations]);

  useEffect(() => {
    if (!isOpen || !user) return;
    void loadConversations();
  }, [isOpen, user, loadConversations]);

  useEffect(() => {
    if (!isOpen || !pendingJobChat || !user) return;

    let cancelled = false;

    const openConversationFromBid = async () => {
      setCreatingConversation(true);
      setConversationsError(null);
      try {
        const conversation = await messagesService.createJobConversation({
          jobId: pendingJobChat.jobId,
          bidId: pendingJobChat.bidId,
        });

        if (!cancelled) {
          setActiveConversationId(conversation.id);
          await loadConversations();
        }
      } catch (err) {
        if (!cancelled) {
          setConversationsError(err instanceof Error ? err.message : "Unable to open chat.");
        }
      } finally {
        if (!cancelled) {
          setCreatingConversation(false);
          clearPendingJobChat();
        }
      }
    };

    void openConversationFromBid();
    return () => { cancelled = true; };
  }, [isOpen, pendingJobChat, user, setActiveConversationId, loadConversations, clearPendingJobChat]);

  useEffect(() => {
    if (!isOpen || !activeConversationId || !user) return;
    void loadMessages(activeConversationId);
  }, [isOpen, activeConversationId, user, loadMessages]);

  useEffect(() => {
    if (!isOpen || !user) return;

    const intervalId = window.setInterval(() => {
      void refreshUnread();
      void loadConversations();
      if (activeConversationId) void loadMessages(activeConversationId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isOpen, user, activeConversationId, refreshUnread, loadConversations, loadMessages]);

  const handleSend = async () => {
    if (!activeConversationId || !user || sending) return;
    const value = draft.trim();
    if (!value) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderId: user.id,
      type: "text",
      content: value,
      createdAtUtc: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");
    setMessagesError(null);
    setSending(true);

    try {
      const sent = await messagesService.sendMessage(activeConversationId, {
        content: value,
        messageType: "text",
      });

      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? sent : msg)));
      await loadConversations();
      window.dispatchEvent(new Event("nh_messages_updated"));
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setMessagesError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={open}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#0B74FF] text-white shadow-lg hover:bg-[#065ed1] transition-colors flex items-center justify-center"
      >
        <MessageCircle className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 h-[30rem] bg-white border border-[#E5E7EB] rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeConversationId ? (
                <button
                  onClick={() => setActiveConversationId(null)}
                  className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] flex items-center justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <MessageCircle className="w-4 h-4 text-[#111827]" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111827] truncate">
                  {activeConversation ? getConversationTitle(activeConversation, user.id) : "Chats"}
                </p>
              </div>
            </div>
            <button onClick={close} className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!activeConversationId ? (
            <div className="flex-1 overflow-y-auto">
              {conversationsLoading ? (
                <div className="p-4 text-sm text-[#6B7280]">Loading chats...</div>
              ) : conversations.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-6">
                  <p className="text-sm text-[#9CA3AF]">No chats yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setActiveConversationId(conversation.id)}
                      className="w-full text-left px-4 py-3 hover:bg-[#F7F8FA] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">
                            {getConversationTitle(conversation, user.id)}
                          </p>
                          <p className="text-xs text-[#6B7280] truncate mt-0.5">
                            {conversation.lastMessage?.content ?? "No messages yet"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[10px] text-[#9CA3AF]">
                            {formatLastSeen(conversation.lastMessageAtUtc)}
                          </span>
                          {conversation.unreadCount > 0 && (
                            <span className="mt-1 min-w-5 h-5 px-1 rounded-full bg-[#0B74FF] text-white text-[10px] font-bold flex items-center justify-center">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#F7F8FA]">
                {messagesLoading && messages.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Loading messages...</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((message) => {
                      const mine = message.senderId === user.id;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${mine ? "bg-[#0B74FF] text-white rounded-br-md" : "bg-white text-[#111827] rounded-bl-md"}`}>
                            <p className="text-sm leading-snug">{message.content}</p>
                            <p className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-[#9CA3AF]"}`}>
                              {formatTime(message.createdAtUtc)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="border-t border-[#E5E7EB] p-3 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message"
                    className="flex-1 border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                    onKeyDown={(e) => e.key === "Enter" && !sending && handleSend()}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || draft.trim() === ""}
                    className="w-9 h-9 rounded-lg bg-[#0B74FF] text-white flex items-center justify-center hover:bg-[#065ed1] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}