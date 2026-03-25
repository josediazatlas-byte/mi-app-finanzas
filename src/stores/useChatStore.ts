import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (m) => set((s) => ({ messages: [...s.messages.slice(-49), m] })),
      clearHistory: () => set({ messages: [] }),
    }),
    { name: 'chat-store' }
  )
);
