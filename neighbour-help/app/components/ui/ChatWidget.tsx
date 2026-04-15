"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import type { ChatMessage, ConversationSummary } from "@/app/types";
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

function getConversationTitle(conversation: ConversationSummary, currentUserId: string) {
  const others = conversation.participants.filter((p) => p.userId !== currentUserId);
  if (others.length > 0) {
    return others.map((p) => p.name).join(", ");
  }

  if (conversation.type === "admin_support") {
    return "Admin Support";
  }

  return "Job Chat";
}

function buildClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
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
      const response = await messagesService.getUnreadCount();
      setUnreadCount(response.unreadCount ?? 0);
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
      const response = await messagesService.getConversations({ page: 1, pageSize: 30 });
      setConversations(response.conversations ?? []);
    } catch (err) {
      if (err instanceof Error) {
        setConversationsError(err.message);
      } else {
        setConversationsError("Unable to load chats right now.");
      }
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      const response = await messagesService.getMessages(conversationId, {
        page: 1,
        pageSize: 50,
      });

      const sorted = [...(response.messages ?? [])].sort(
        (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
      );
      setMessages(sorted);

      const lastMessage = sorted[sorted.length - 1];
      await messagesService.markConversationRead(conversationId, lastMessage?.id);
      await refreshUnread();
      await loadConversations();
      window.dispatchEvent(new Event("nh_messages_updated"));
    } catch (err) {
      if (err instanceof Error) {
        setMessagesError(err.message);
      } else {
        setMessagesError("Unable to load messages.");
      }
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
      if (isOpen) {
        void loadConversations();
      }
    };

    window.addEventListener("nh_messages_updated", listener);

    return () => {
      window.removeEventListener("nh_messages_updated", listener);
    };
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
        const conversation = await messagesService.createOrOpenJobConversation({
          jobId: pendingJobChat.jobId,
          bidId: pendingJobChat.bidId,
          otherUserId: pendingJobChat.otherUserId,
        });

        if (!cancelled) {
          setActiveConversationId(conversation.id);
          await loadConversations();
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error) {
            setConversationsError(err.message);
          } else {
            setConversationsError("Unable to open chat from bid.");
          }
        }
      } finally {
        if (!cancelled) {
          setCreatingConversation(false);
          clearPendingJobChat();
        }
      }
    };

    void openConversationFromBid();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    pendingJobChat,
    user,
    setActiveConversationId,
    loadConversations,
    clearPendingJobChat,
  ]);

  useEffect(() => {
    if (!isOpen || !activeConversationId || !user) return;
    void loadMessages(activeConversationId);
  }, [isOpen, activeConversationId, user, loadMessages]);

  useEffect(() => {
    if (!isOpen || !user) return;

    const intervalId = window.setInterval(() => {
      void refreshUnread();
      void loadConversations();

      if (activeConversationId) {
        void loadMessages(activeConversationId);
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, user, activeConversationId, refreshUnread, loadConversations, loadMessages]);

  const handleSend = async () => {
    if (!activeConversationId || !user || sending) return;
    const value = draft.trim();
    if (!value) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: activeConversationId,
      senderUserId: user.id,
      senderName: user.name,
      messageType: "text",
      bodyText: value,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft("");
    setMessagesError(null);
    setSending(true);

    try {
      const sent = await messagesService.sendMessage(activeConversationId, {
        bodyText: value,
        messageType: "text",
        clientMessageId: buildClientMessageId(),
      });

      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? sent : msg))
      );
      await loadConversations();
      window.dispatchEvent(new Event("nh_messages_updated"));
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      if (err instanceof Error) {
        setMessagesError(err.message);
      } else {
        setMessagesError("Unable to send message.");
      }
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        onClick={open}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#0B74FF] text-white shadow-lg hover:bg-[#065ed1] transition-colors flex items-center justify-center"
        aria-label="Open chats"
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
                  className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] hover:text-[#111827] flex items-center justify-center"
                  aria-label="Back to chats list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <MessageCircle className="w-4 h-4 text-[#111827]" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111827] truncate">
                  {activeConversation
                    ? getConversationTitle(activeConversation, user.id)
                    : "Chats"}
                </p>
                {!activeConversation && unreadCount > 0 && (
                  <p className="text-xs text-[#6B7280]">{unreadCount} unread</p>
                )}
              </div>
            </div>

            <button
              onClick={close}
              className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] hover:text-[#111827] flex items-center justify-center"
              aria-label="Close chats"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!activeConversationId ? (
            <div className="flex-1 overflow-y-auto">
              {creatingConversation && (
                <div className="px-4 py-3 text-xs text-[#6B7280] border-b border-[#F3F4F6]">
                  Opening chat...
                </div>
              )}

              {conversationsError && (
                <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {conversationsError}
                </div>
              )}

              {conversationsLoading ? (
                <div className="p-4 text-sm text-[#6B7280]">Loading chats...</div>
              ) : conversations.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-6">
                  <p className="text-sm text-[#9CA3AF]">
                    No chats yet. Use the Message action on a bid to start one.
                  </p>
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
                            {conversation.lastMessagePreview ?? "No messages yet"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[10px] text-[#9CA3AF]">
                            {formatLastSeen(conversation.lastMessageAt)}
                          </span>
                          {conversation.unreadCount > 0 && (
                            <span className="mt-1 min-w-5 h-5 px-1 rounded-full bg-[#0B74FF] text-white text-[10px] font-bold flex items-center justify-center">
                              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
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
                {messagesError && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {messagesError}
                  </div>
                )}

                {messagesLoading ? (
                  <p className="text-sm text-[#6B7280]">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF]">No messages yet. Say hello.</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((message) => {
                      const mine = message.senderUserId === user.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                              mine
                                ? "bg-[#0B74FF] text-white rounded-br-md"
                                : "bg-white text-[#111827] rounded-bl-md"
                            }`}
                          >
                            {!mine && (
                              <p className="text-[10px] font-semibold mb-1 text-[#6B7280]">
                                {message.senderName ?? "User"}
                              </p>
                            )}
                            <p className="text-sm leading-snug">
                              {message.isDeleted ? "Message removed" : message.bodyText}
                            </p>
                            <p
                              className={`text-[10px] mt-1 ${
                                mine ? "text-blue-100" : "text-[#9CA3AF]"
                              }`}
                            >
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-[#E5E7EB] p-3 bg-white">
                {activeConversation?.status === "locked" ? (
                  <p className="text-xs text-red-600">
                    This conversation is locked by admin moderation.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type a message"
                      className="flex-1 border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <button
                      onClick={() => void handleSend()}
                      disabled={sending || draft.trim() === ""}
                      className="w-9 h-9 rounded-lg bg-[#0B74FF] text-white flex items-center justify-center hover:bg-[#065ed1] disabled:opacity-50"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
