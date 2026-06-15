import { create } from 'zustand';
import { InputMode } from '../../../shared/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'companion';
  content: string;
  input_mode: InputMode;
  timestamp: Date;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setLoading: (value: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,

  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    set({ messages: [...get().messages, newMessage] });
  },

  setLoading: (value) => set({ isLoading: value }),

  clearMessages: () => set({ messages: [] }),
}));
