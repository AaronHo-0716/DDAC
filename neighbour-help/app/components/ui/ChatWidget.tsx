"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Send, X } from "lucide-react";
import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { ConversationType, type ChatMessage, type Conversation } from "@/app/types";
import { useAuth } from "@/app/lib/context/AuthContext";
import { messagesService, supportService } from "@/app/lib/api/messages"; // Imported both services
import { getAccessToken } from "@/app/lib/api/client";
import { useChatWidget } from "../../lib/context/ChatWidgetContext";

interface ChatHubMessagePayload {
  convId?: string;
  message?: ChatMessage;
}

const CHAT_HUB_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "http://localhost:5073";
const CHAT_HUB_URL = `${CHAT_HUB_BASE_URL.replace(/\/+$/, "")}/api/chat-hub`;

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getConversationDisplay(conversation: Conversation, currentUserId: string) {
  const others = conversation.participants.filter((p) => p.userId !== currentUserId);
  const otherUserName = others.length > 0 ? others.map((p) => p.name).join(", ") : "Unknown user";
  if (conversation.type === ConversationType.JobChat) {
    return { title: otherUserName, subtitle: conversation.relatedJobTitle ? `Job: ${conversation.relatedJobTitle}` : "Job Chat" };
  }
  if (conversation.type === ConversationType.AdminSupport) {
    return { title: "Admin Support", subtitle: otherUserName };
  }
  return { title: otherUserName, subtitle: undefined };
}

export default function ChatWidget() {
  const { user } = useAuth();
  const { isOpen, open, close, activeConversationId, setActiveConversationId, pendingJobChat, clearPendingJobChat } = useChatWidget();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const connectionRef = useRef<HubConnection | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const activeConversationDisplay = useMemo(() => {
    if (!activeConversation) return { title: "Chats", subtitle: undefined };
    return getConversationDisplay(activeConversation, user?.id ?? "");
  }, [activeConversation, user?.id]);

  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((behavior: "smooth" | "auto" = "smooth") => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      scrollToBottom("smooth");
    }
  }, [messages, activeConversationId, scrollToBottom]);

  useEffect(() => {
    if (activeConversationId && isOpen) {
      scrollToBottom("auto"); 
    }
  }, [activeConversationId, isOpen, scrollToBottom]);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const [jobUnread, supportUnread] = await Promise.all([
        messagesService.getUnreadCount(),
        supportService.getUnreadCount()
      ]);
      setUnreadCount(jobUnread + supportUnread);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConversationsLoading(true);
    try {
      const [jobList, supportList] = await Promise.all([
        messagesService.getConversations(),
        supportService.getConversations()
      ]);
      
      const rawCombined = [...jobList, ...supportList];
      const unique = Array.from(new Map(rawCombined.map((c) => [c.id, c])).values());

      setConversations(unique.sort((a, b) => {
        const timeA = a.lastMessageAtUtc ? new Date(a.lastMessageAtUtc).getTime() : 0;
        const timeB = b.lastMessageAtUtc ? new Date(b.lastMessageAtUtc).getTime() : 0;
        return timeB - timeA;
      }));
    } catch {
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const conv = conversationsRef.current.find(c => c.id === conversationId);
      const isSupport = conv?.type === ConversationType.AdminSupport;

      const response = isSupport 
        ? await supportService.getMessages(conversationId)
        : await messagesService.getMessages(conversationId);

      setMessages([...response].sort((a, b) => +new Date(a.createdAtUtc) - +new Date(b.createdAtUtc)));

      if (isSupport) await supportService.markAsRead(conversationId);
      else await messagesService.markAsRead(conversationId);

      refreshUnread();
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    if (!user) return;

    const connection = new HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, { accessTokenFactory: () => getAccessToken() ?? "", withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("ReceiveMessage", (payload: ChatHubMessagePayload) => {
      const conversationId = payload.convId;
      const incoming = payload.message;
      if (!conversationId || !incoming) return;

      if (activeConversationIdRef.current === conversationId) {
        setMessages((prev) => {
          const messageMap = new Map(prev.map((m) => [m.id, m]));
          messageMap.set(incoming.id, incoming);
          
          return Array.from(messageMap.values()).sort(
            (a, b) => +new Date(a.createdAtUtc) - +new Date(b.createdAtUtc)
          );
        });

        const isSupport = conversationsRef.current.find(c => c.id === conversationId)?.type === ConversationType.AdminSupport;
        if (isSupport) supportService.markAsRead(conversationId).then(refreshUnread);
        else messagesService.markAsRead(conversationId).then(refreshUnread);
      }
      loadConversations();
      refreshUnread();
    });

    connection.on("NotificationMarkedRead", () => {
      loadConversations();
      refreshUnread();
    });

    connection.start().catch(console.error);
    connectionRef.current = connection;

    return () => { connection.stop(); };
  }, [user, loadConversations, refreshUnread]);

  useEffect(() => { if (user) refreshUnread(); }, [user, refreshUnread]);
  useEffect(() => { if (isOpen && user) loadConversations(); }, [isOpen, user, loadConversations]);
  useEffect(() => { if (isOpen && activeConversationId && user) loadMessages(activeConversationId); }, [isOpen, activeConversationId, user, loadMessages]);

  const handleSend = async () => {
    if (!activeConversationId || !user || sending || !draft.trim()) return;
    const value = draft.trim();
    const isSupport = activeConversation?.type === ConversationType.AdminSupport;

    setSending(true);
    try {
      const sent = isSupport
        ? await supportService.sendMessage(activeConversationId, { content: value, messageType: "text" })
        : await messagesService.sendMessage(activeConversationId, { content: value, messageType: "text" });

      setMessages((prev) => {
        const messageMap = new Map(prev.map((m) => [m.id, m]));
        messageMap.set(sent.id, sent);
        return Array.from(messageMap.values()).sort(
          (a, b) => +new Date(a.createdAtUtc) - +new Date(b.createdAtUtc)
        );
      });

      setDraft("");
      // Scroll immediately after sending for better UX
      scrollToBottom("smooth"); 
    } catch {
      setMessagesError("Unable to send message.");
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
                  {activeConversationDisplay.title}
                </p>
                {activeConversationDisplay.subtitle && (
                  <p className="text-[11px] text-[#6B7280] truncate">
                    {activeConversationDisplay.subtitle}
                  </p>
                )}
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
                  {conversations.map((conversation) => {
                    const display = getConversationDisplay(conversation, user.id);

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => setActiveConversationId(conversation.id)}
                        className="w-full text-left px-4 py-3 hover:bg-[#F7F8FA] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111827] truncate">
                              {display.title}
                            </p>
                            {display.subtitle && (
                              <p className="text-[11px] text-[#4B5563] truncate mt-0.5 font-medium">
                                {display.subtitle}
                              </p>
                            )}
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
                    );
                  })}
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
                    <div ref={messagesEndRef} className="h-0 w-0" aria-hidden="true" />
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