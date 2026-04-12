"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface PendingJobChatTarget {
  jobId: string;
  bidId: string;
  otherUserId: string;
  otherUserName?: string;
}

interface ChatWidgetContextValue {
  isOpen: boolean;
  activeConversationId: string | null;
  pendingJobChat: PendingJobChatTarget | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveConversationId: (conversationId: string | null) => void;
  openForBidChat: (target: PendingJobChatTarget) => void;
  clearPendingJobChat: () => void;
}

const ChatWidgetContext = createContext<ChatWidgetContextValue | null>(null);

export function ChatWidgetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingJobChat, setPendingJobChat] = useState<PendingJobChatTarget | null>(null);

  const value = useMemo<ChatWidgetContextValue>(
    () => ({
      isOpen,
      activeConversationId,
      pendingJobChat,
      open: () => setIsOpen(true),
      close: () => {
        setIsOpen(false);
        setActiveConversationId(null);
      },
      toggle: () => setIsOpen((prev) => !prev),
      setActiveConversationId,
      openForBidChat: (target) => {
        setPendingJobChat(target);
        setIsOpen(true);
      },
      clearPendingJobChat: () => setPendingJobChat(null),
    }),
    [isOpen, activeConversationId, pendingJobChat]
  );

  return (
    <ChatWidgetContext.Provider value={value}>{children}</ChatWidgetContext.Provider>
  );
}

export function useChatWidget() {
  const context = useContext(ChatWidgetContext);
  if (!context) {
    throw new Error("useChatWidget must be used within <ChatWidgetProvider>");
  }
  return context;
}
