import { create } from "zustand";
import type { ChatMessage, ChatSession } from "@/lib/chat/types";

type ChatStoreState = {
  sessions: ChatSession[];
  messages: ChatMessage[];
  activeSessionId: string;
  setAll: (payload: { sessions: ChatSession[]; messages: ChatMessage[]; activeSessionId: string }) => void;
  setSessions: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  setActiveSessionId: (id: string) => void;
};

export const useChatStore = create<ChatStoreState>((set) => ({
  sessions: [],
  messages: [],
  activeSessionId: "",
  setAll: (payload) =>
    set({
      sessions: payload.sessions,
      messages: payload.messages,
      activeSessionId: payload.activeSessionId,
    }),
  setSessions: (updater) => set((state) => ({ sessions: updater(state.sessions) })),
  setMessages: (updater) => set((state) => ({ messages: updater(state.messages) })),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
