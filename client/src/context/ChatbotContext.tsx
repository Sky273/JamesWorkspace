/* eslint-disable react-refresh/only-export-components */
/**
 * ChatbotContext - Manages chatbot enabled state globally
 * Allows dynamic updates without page refresh
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ChatbotContextType {
  chatbotEnabled: boolean;
  setChatbotEnabled: (enabled: boolean) => void;
  refreshChatbotStatus: () => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

interface ChatbotProviderProps {
  children: ReactNode;
}

export const ChatbotProvider = ({ children }: ChatbotProviderProps): JSX.Element => {
  const [chatbotEnabled, setChatbotEnabled] = useState<boolean>(true);
  const [, setRefreshKey] = useState<number>(0);

  const refreshChatbotStatus = useCallback(() => {
    // Increment key to trigger re-fetch in ChatBot component
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <ChatbotContext.Provider value={{ chatbotEnabled, setChatbotEnabled, refreshChatbotStatus }}>
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = (): ChatbotContextType => {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};

export default ChatbotContext;
