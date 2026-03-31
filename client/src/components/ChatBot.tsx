/**
 * ChatBot Component
 * AI-powered assistant chatbot that connects to n8n webhook
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useChatbot } from '../context/ChatbotContext';
import { createLogger } from '../utils/logger.frontend';
import ChatbotWindow from './chatbot/ChatbotWindow';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, MAX_HEIGHT, MAX_WIDTH, MIN_HEIGHT, MIN_WIDTH, STORAGE_KEY } from './chatbot/constants';
import type { ChatbotSize, Message } from './chatbot/types';

const log = createLogger('ChatBot');

const ChatBot = (): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { authPost, authGet } = useAuthFetch();
  const { chatbotEnabled, setChatbotEnabled } = useChatbot();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChatbotSize>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          width: Math.min(Math.max(parsed.width || DEFAULT_WIDTH, MIN_WIDTH), MAX_WIDTH),
          height: Math.min(Math.max(parsed.height || DEFAULT_HEIGHT, MIN_HEIGHT), MAX_HEIGHT)
        };
      }
    } catch {
      // Ignore localStorage errors
    }
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [showHelpTooltip, setShowHelpTooltip] = useState<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setShowHelpTooltip(false);
      return;
    }

    const timeoutIds: NodeJS.Timeout[] = [];
    const initialTimeout = setTimeout(() => {
      setShowHelpTooltip(true);
      const hideTimeout = setTimeout(() => setShowHelpTooltip(false), 4000);
      timeoutIds.push(hideTimeout);
    }, 10000);

    const interval = setInterval(() => {
      setShowHelpTooltip(true);
      const hideTimeout = setTimeout(() => setShowHelpTooltip(false), 4000);
      timeoutIds.push(hideTimeout);
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
    } catch {
      // Ignore localStorage errors
    }
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = startPosRef.current.x - e.clientX;
    const deltaY = startPosRef.current.y - e.clientY;

    let newWidth = startPosRef.current.width;
    let newHeight = startPosRef.current.height;

    if (resizeDirection.includes('w')) {
      newWidth = Math.min(Math.max(startPosRef.current.width + deltaX, MIN_WIDTH), MAX_WIDTH);
    }
    if (resizeDirection.includes('n')) {
      newHeight = Math.min(Math.max(startPosRef.current.height + deltaY, MIN_HEIGHT), MAX_HEIGHT);
    }

    setSize({ width: newWidth, height: newHeight });
  }, [isResizing, resizeDirection]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection('');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const startResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };

    if (direction === 'nw') document.body.style.cursor = 'nw-resize';
    else if (direction === 'n') document.body.style.cursor = 'n-resize';
    else if (direction === 'w') document.body.style.cursor = 'w-resize';

    document.body.style.userSelect = 'none';
  };

  const resetSize = () => {
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  };

  useEffect(() => {
    const checkChatbotStatus = async () => {
      try {
        const response = await authGet('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setChatbotEnabled(data.chatbotEnabled === 'on');
        }
      } catch (error) {
        log.warn('Failed to fetch chatbot settings', { error: error instanceof Error ? error.message : 'Unknown' });
        setChatbotEnabled(true);
      }
    };
    checkChatbotStatus();
  }, [authGet, setChatbotEnabled]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: t('chatbot.welcomeMessage'),
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, messages.length, t]);

  const generateMessageId = (): string => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await authPost('/api/chatbot/message', {
        message: userMessage.content,
        userId: user?.id,
        userName: user?.name,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
      });

      if (!response.ok) {
        log.error('Chatbot API error', { status: response.status, statusText: response.statusText });
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: data.response || t('chatbot.errorMessage'),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      log.error('Chatbot error', { error: error instanceof Error ? error.message : 'Unknown' });
      setMessages(prev => [
        ...prev,
        {
          id: generateMessageId(),
          role: 'assistant',
          content: t('chatbot.errorMessage'),
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!chatbotEnabled) {
    return null;
  }

  return (
    <>
      <div className={`fixed bottom-8 right-8 z-50 ${isOpen ? 'hidden' : 'block'}`}>
        <AnimatePresence>
          {showHelpTooltip && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute bottom-full right-0 mb-3 whitespace-nowrap"
            >
              <div className="bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg relative">
                <span className="font-medium">{t('chatbot.needHelp')}</span>
                <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-gray-900 dark:border-t-gray-700" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          initial={{ scale: 0 }}
          animate={{
            scale: 1,
            boxShadow: showHelpTooltip
              ? ['0 0 0 0 rgba(99, 102, 241, 0.4)', '0 0 0 12px rgba(99, 102, 241, 0)', '0 0 0 0 rgba(99, 102, 241, 0.4)']
              : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}
          transition={showHelpTooltip ? { duration: 1.5, repeat: Infinity } : {}}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setShowHelpTooltip(false);
            setIsOpen(true);
          }}
          className="p-4 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg transition-colors"
          aria-label={t('chatbot.openChat')}
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </motion.button>
      </div>

      <ChatbotWindow
        isOpen={isOpen}
        size={size}
        inputValue={inputValue}
        isLoading={isLoading}
        messages={messages}
        inputRef={inputRef}
        chatRef={chatRef}
        messagesEndRef={messagesEndRef}
        title={t('chatbot.title')}
        subtitle={t('chatbot.subtitle')}
        placeholder={t('chatbot.placeholder')}
        clearLabel={t('chatbot.clear')}
        closeLabel={t('chatbot.closeChat')}
        resetSizeTitle={t('chatbot.resetSize') || 'Reset size'}
        onClose={() => setIsOpen(false)}
        onClear={clearChat}
        onResetSize={resetSize}
        onInputChange={setInputValue}
        onInputKeyDown={handleKeyPress}
        onSend={sendMessage}
        onStartResize={startResize}
      />
    </>
  );
};

export default ChatBot;
