"use client";

import { createContext, useContext, ReactNode } from 'react';

interface ChatBotContextType {
  isEnabled: boolean;
  disableChatBot: () => void;
  enableChatBot: () => void;
}

const ChatBotContext = createContext<ChatBotContextType | undefined>(undefined);

export function ChatBotProvider({ children }: { children: ReactNode }) {
  // ChatBot is enabled by default for all pages
  // Child pages can disable it if needed
  return (
    <ChatBotContext.Provider value={{
      isEnabled: true,
      disableChatBot: () => {},
      enableChatBot: () => {},
    }}>
      {children}
    </ChatBotContext.Provider>
  );
}

export function useChatBot() {
  const context = useContext(ChatBotContext);
  if (context === undefined) {
    throw new Error('useChatBot must be used within ChatBotProvider');
  }
  return context;
}
