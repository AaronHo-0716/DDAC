"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, MessageCircle, Send, X } from "lucide-react";
import { HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { ConversationType, type ChatMessage, type Conversation, UserRole } from "@/app/types";
import { useAuth } from "@/app/lib/context/AuthContext";
import { messagesService, supportService } from "@/app/lib/api/messages";
import { getAccessToken } from "@/app/lib/api/client";
import { uploadsService } from "@/app/lib/api/uploads";
import { useChatWidget } from "../../lib/context/ChatWidgetContext";

interface ChatHubMessagePayload {
  convId?: string;
  message?: ChatMessage;
}

const CHAT_HUB_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5073";
const CHAT_HUB_URL = `${CHAT_HUB_BASE_URL.replace(/\/+$/, "")}/api/chat-hub`;
const MAX_CHAT_IMAGE_SIZE_MB = 10;

// [Helpers normalizeMessageType, validateImageFile, formatTime, formatLastSeen, getConversationDisplay remain identical]
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

function validateImageFile(file: File): string | null {
  if (!file.type || !file.type.startsWith("image/")) return "Only image files are allowed.";
  const maxBytes = MAX_CHAT_IMAGE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) return `Image must be ${MAX_CHAT_IMAGE_SIZE_MB}MB or smaller.`;
  return null;
}

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
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const connectionRef = useRef<HubConnection | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const totalUnreadBadge = useMemo(() => {
    return conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
  }, [conversations]);

  const activeConversationDisplay = useMemo(() => {
    if (!activeConversation) return { title: "Chats", subtitle: undefined };
    return getConversationDisplay(activeConversation, user?.id ?? "");
  }, [activeConversation, user?.id]);

  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  useEffect(() => {
    return () => { if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl); };
  }, [selectedImagePreviewUrl]);

  const resetSelectedImage = useCallback(() => {
    if (selectedImagePreviewUrl) URL.revokeObjectURL(selectedImagePreviewUrl);
    setSelectedImage(null);
    setSelectedImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, [selectedImagePreviewUrl]);

  const scrollToBottom = useCallback((behavior: "smooth" | "auto" = "smooth") => {
    requestAnimationFrame(() => { messagesEndRef.current?.scrollIntoView({ behavior, block: "end" }); });
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      await Promise.all([messagesService.getUnreadCount(), supportService.getUnreadCount()]);
      // State is driven by the useMemo totalUnreadBadge, no manual setUnreadCount needed here
    } catch { /* silent */ }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConversationsLoading(true);
    try {
      const [jobList, supportList] = await Promise.all([messagesService.getConversations(), supportService.getConversations()]);
      const unique = Array.from(new Map([...jobList, ...supportList].map((c) => [c.id, c])).values());
      setConversations(unique.sort((a, b) => {
        const timeA = a.lastMessageAtUtc ? new Date(a.lastMessageAtUtc).getTime() : 0;
        const timeB = b.lastMessageAtUtc ? new Date(b.lastMessageAtUtc).getTime() : 0;
        return timeB - timeA;
      }));
    } catch { setConversations([]); }
    finally { setConversationsLoading(false); }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const conv = conversationsRef.current.find(c => c.id === conversationId);
      const isSupport = conv?.type === ConversationType.AdminSupport;
      const response = isSupport ? await supportService.getMessages(conversationId) : await messagesService.getMessages(conversationId);
      setMessages([...response].sort((a, b) => +new Date(a.createdAtUtc) - +new Date(b.createdAtUtc)));
      
      if (isSupport) await supportService.markAsRead(conversationId);
      else await messagesService.markAsRead(conversationId);
      
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
    } catch { setMessages([]); }
    finally { setMessagesLoading(false); }
  }, []);

  const handleImageSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { setMessagesError(error); return; }
    setSelectedImage(file);
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
    setMessagesError(null);
  }, []);

  // =============================================================================
  // SIGNALR REAL-TIME (LOGIC FIXES APPLIED)
  // =============================================================================
  useEffect(() => {
    if (!user) return;

    const connection = new HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, { accessTokenFactory: () => getAccessToken() ?? "", withCredentials: true, skipNegotiation: true, transport: HttpTransportType.WebSockets })
      .withAutomaticReconnect()
      .build();

    connection.on("ReceiveMessage", (payload: ChatHubMessagePayload) => {
      const conversationId = payload.convId;
      const incoming = payload.message;
      if (!conversationId || !incoming) return;

      const normalized: ChatMessage = { ...incoming, type: normalizeMessageType(incoming.type) };

      if (activeConversationIdRef.current === conversationId) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          if (map.has(normalized.id)) return prev;
          map.set(normalized.id, normalized);
          return Array.from(map.values()).sort((a, b) => +new Date(a.createdAtUtc) - +new Date(b.createdAtUtc));
        });
        const convType = conversationsRef.current.find(c => c.id === conversationId)?.type;
        if (convType === ConversationType.AdminSupport) supportService.markAsRead(conversationId);
        else messagesService.markAsRead(conversationId);
      }

      setConversations((prev) => {
        const index = prev.findIndex(c => c.id === conversationId);
        if (index === -1) { loadConversations(); return prev; }

        const updated = [...prev];
        const target = { ...updated[index] };

        if (target.lastMessage?.id === normalized.id) return prev; // Avoid double processing

        target.lastMessage = normalized;
        target.lastMessageAtUtc = normalized.createdAtUtc;

        // FIX: Case-insensitive role and type checks for unread calculations
        const isAdmin = user.role.toLowerCase() === "admin";
        const isParticipant = target.participants.some(p => p.userId === user.id);
        const isUnassignedSupport = target.type === ConversationType.AdminSupport && 
                                     !target.participants.some(p => p.role.toLowerCase() === "admin");

        const shouldMarkUnread = (isParticipant && incoming.senderId !== user.id) || (isAdmin && isUnassignedSupport);

        if (shouldMarkUnread && activeConversationIdRef.current !== conversationId) {
            target.unreadCount = (target.unreadCount || 0) + 1;
        }

        updated.splice(index, 1);
        return [target, ...updated];
      });
    });

    connection.on("SupportChatTaken", (payload: { conversationId: string, assignedAdminId: string }) => {
      if (payload.assignedAdminId === user.id) return;
      setConversations(prev => prev.map(c => c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c));
    });

      connection.on("MessageMarkRead", (id: string) => {
      setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    });

    connection.start().catch(console.error);
    connectionRef.current = connection;
    return () => { if (connection.state === HubConnectionState.Connected) connection.stop(); };
  }, [user, loadConversations]);

  useEffect(() => { if (isOpen && user) loadConversations(); }, [isOpen, user, loadConversations]);
  useEffect(() => { if (isOpen && activeConversationId && user) loadMessages(activeConversationId); }, [isOpen, activeConversationId, user, loadMessages]);
  useEffect(() => { if (messages.length > 0) scrollToBottom("smooth"); }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    if (!activeConversationId || !user || sending || uploadingImage) return;
    const hasText = draft.trim().length > 0;
    const hasImage = !!selectedImage;
    if (!hasText && !hasImage) return;

    const value = draft.trim();
    const isSupport = activeConversation?.type === ConversationType.AdminSupport;

    setSending(true);
    try {
      if (hasImage && selectedImage) {
        setUploadingImage(true);
        if (isSupport) await uploadsService.uploadSupportChatAttachmentImage(selectedImage, activeConversationId);
        else await uploadsService.uploadJobChatAttachmentImage(selectedImage, activeConversationId);
        resetSelectedImage();
      }
      if (hasText) {
        if (isSupport) await supportService.sendMessage(activeConversationId, { content: value, messageType: "text" });
        else await messagesService.sendMessage(activeConversationId, { content: value, messageType: "text" });
        setDraft("");
      }
    } catch { setMessagesError("Unable to send message."); }
    finally { setSending(false); setUploadingImage(false); }
  };

  useEffect(() => {
    if (!isOpen || !pendingJobChat || !user) return;
    const initChat = async () => {
      setCreatingConversation(true);
      try {
        const c = await messagesService.createJobConversation({ jobId: pendingJobChat.jobId, otherUserId: pendingJobChat.otherUserId });
        setActiveConversationId(c.id);
        await loadConversations();
      } finally { setCreatingConversation(false); clearPendingJobChat(); }
    };
    void initChat();
  }, [isOpen, pendingJobChat, user, setActiveConversationId, loadConversations, clearPendingJobChat]);

  if (!user) return null;

  return (
    <>
      <button onClick={open} className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#0B74FF] text-white shadow-lg flex items-center justify-center hover:bg-[#065ed1] transition-colors">
        <MessageCircle className="w-5 h-5" />
        {totalUnreadBadge > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{totalUnreadBadge > 99 ? "99+" : totalUnreadBadge}</span>}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 h-[30rem] bg-white border border-[#E5E7EB] rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeConversationId ? (
                <button onClick={() => setActiveConversationId(null)} className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
              ) : (
                <MessageCircle className="w-4 h-4 text-[#111827]" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111827] truncate">{activeConversationDisplay.title}</p>
                {activeConversationDisplay.subtitle && <p className="text-[11px] text-[#6B7280] truncate">{activeConversationDisplay.subtitle}</p>}
              </div>
            </div>
            <button onClick={close} className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280] flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>

          {!activeConversationId ? (
            <div className="flex-1 overflow-y-auto">
              {conversationsLoading ? <div className="p-4 text-sm text-[#6B7280]">Loading chats...</div> : conversations.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-6"><p className="text-sm text-[#9CA3AF]">No chats yet.</p></div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {conversations.map((conversation) => {
                    const display = getConversationDisplay(conversation, user.id);
                    return (
                      <button key={conversation.id} onClick={() => setActiveConversationId(conversation.id)} className="w-full text-left px-4 py-3 hover:bg-[#F7F8FA] transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#111827] truncate">{display.title}</p>
                            {display.subtitle && <p className="text-[11px] text-[#4B5563] truncate mt-0.5 font-medium">{display.subtitle}</p>}
                            <p className="text-xs text-[#6B7280] truncate mt-0.5">{conversation.lastMessage?.type === "image" ? "[Image]" : conversation.lastMessage?.content ?? "No messages yet"}</p>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="text-[10px] text-[#9CA3AF]">{formatLastSeen(conversation.lastMessageAtUtc)}</span>
                            {conversation.unreadCount > 0 && <span className="mt-1 min-w-5 h-5 px-1 rounded-full bg-[#0B74FF] text-white text-[10px] font-bold flex items-center justify-center">{conversation.unreadCount}</span>}
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
                <div className="space-y-2">
                  {messages.map((message) => {
                    const mine = message.senderId === user.id;
                    const isImageMessage = message.type === "image";
                    return (
                      <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${mine ? "bg-[#0B74FF] text-white rounded-br-md" : "bg-white text-[#111827] rounded-bl-md"}`}>
                          {isImageMessage ? <img src={message.content} alt="Chat attachment" className="rounded-lg max-w-[220px] max-h-[220px] object-cover" /> : <p className="text-sm leading-snug">{message.content}</p>}
                          <p className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-[#9CA3AF]"}`}>{formatTime(message.createdAtUtc)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} className="h-0 w-0" aria-hidden="true" />
                </div>
              </div>
              <div className="border-t border-[#E5E7EB] p-3 bg-white">
                {selectedImagePreviewUrl && (
                  <div className="mb-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-medium text-[#374151] truncate">{selectedImage?.name}</p>
                      <button onClick={resetSelectedImage} disabled={uploadingImage} className="text-[#6B7280] hover:text-[#111827] disabled:opacity-50" type="button"><X className="w-4 h-4" /></button>
                    </div>
                    <img src={selectedImagePreviewUrl} alt="Selected image preview" className="rounded-md max-h-28 object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelection} />
                  <button type="button" onClick={() => imageInputRef.current?.click()} disabled={sending || uploadingImage} className="w-9 h-9 rounded-lg border border-[#E5E7EB] text-[#4B5563] flex items-center justify-center hover:bg-[#F7F8FA] disabled:opacity-50"><ImagePlus className="w-4 h-4" /></button>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={selectedImage ? "Add a caption (optional)" : "Type a message"} className="flex-1 border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF]" onKeyDown={(e) => e.key === "Enter" && !sending && !uploadingImage && handleSend()} />
                  <button onClick={() => void handleSend()} disabled={sending || uploadingImage || (draft.trim() === "" && !selectedImage)} className="w-9 h-9 rounded-lg bg-[#0B74FF] text-white flex items-center justify-center hover:bg-[#065ed1] disabled:opacity-50"><Send className="w-4 h-4" /></button>
                </div>
                {messagesError && <p className="mt-2 text-xs text-red-600">{messagesError}</p>}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}