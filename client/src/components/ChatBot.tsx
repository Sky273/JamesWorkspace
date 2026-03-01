/**
 * ChatBot Component
 * AI-powered assistant chatbot that connects to n8n webhook
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useChatbot } from '../context/ChatbotContext';
import { createLogger } from '../utils/logger.frontend';

const log = createLogger('ChatBot');

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Default and min/max sizes for the chat window
const DEFAULT_WIDTH = 384; // 24rem = 384px
const DEFAULT_HEIGHT = 500;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;

// LocalStorage key for saving size
const STORAGE_KEY = 'chatbot-size';

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
  
  // Resizing state
  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          width: Math.min(Math.max(parsed.width || DEFAULT_WIDTH, MIN_WIDTH), MAX_WIDTH),
          height: Math.min(Math.max(parsed.height || DEFAULT_HEIGHT, MIN_HEIGHT), MAX_HEIGHT)
        };
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [showHelpTooltip, setShowHelpTooltip] = useState<boolean>(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Periodic tooltip animation - show "Need help?" every 30 seconds when chat is closed
  useEffect(() => {
    if (isOpen) {
      setShowHelpTooltip(false);
      return;
    }

    // Show tooltip after 10 seconds initially, then every 30 seconds
    const initialTimeout = setTimeout(() => {
      setShowHelpTooltip(true);
      // Hide after 4 seconds
      setTimeout(() => setShowHelpTooltip(false), 4000);
    }, 10000);

    const interval = setInterval(() => {
      setShowHelpTooltip(true);
      // Hide after 4 seconds
      setTimeout(() => setShowHelpTooltip(false), 4000);
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isOpen]);

  // Save size to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [size]);

  // Handle resize mouse move
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

  // Handle resize mouse up
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection('');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add/remove event listeners for resizing
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

  // Start resizing
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
    
    // Set cursor style
    if (direction === 'nw') document.body.style.cursor = 'nw-resize';
    else if (direction === 'n') document.body.style.cursor = 'n-resize';
    else if (direction === 'w') document.body.style.cursor = 'w-resize';
    
    document.body.style.userSelect = 'none';
  };

  // Reset size to default
  const resetSize = () => {
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  };

  // Fetch chatbot status on mount
  useEffect(() => {
    const checkChatbotStatus = async () => {
      try {
        const response = await authGet('/api/settings');
        if (response.ok) {
          const data = await response.json();
          // chatbotEnabled is 'on' or 'off' string from Airtable
          setChatbotEnabled(data.chatbotEnabled === 'on');
        }
      } catch (error) {
        log.warn('Failed to fetch chatbot settings', { error: error instanceof Error ? error.message : 'Unknown' });
        setChatbotEnabled(true); // Default to enabled on error
      }
    };
    checkChatbotStatus();
  }, [authGet, setChatbotEnabled]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Add welcome message when chat is first opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: t('chatbot.welcomeMessage'),
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, t]);

  const generateMessageId = (): string => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await authPost('/api/chatbot/message', {
        message: userMessage.content,
        userId: user?.id,
        userName: user?.name || user?.Name,
        conversationHistory: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Check if response is ok before parsing
      if (!response.ok) {
        log.error('Chatbot API error', { status: response.status, statusText: response.statusText });
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: data.response || t('chatbot.errorMessage'),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      log.error('Chatbot error', { error: error instanceof Error ? error.message : 'Unknown' });
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: t('chatbot.errorMessage'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  // Don't render anything if chatbot is disabled
  if (!chatbotEnabled) {
    return null;
  }

  return (
    <>
      {/* Chat Button with Help Tooltip */}
      <div className={`fixed bottom-8 right-8 z-50 ${isOpen ? 'hidden' : 'block'}`}>
        {/* Help Tooltip */}
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
                {/* Arrow pointing down */}
                <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-gray-900 dark:border-t-gray-700" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Button */}
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

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatRef}
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-8 right-8 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
            style={{ width: size.width, height: size.height }}
          >
            {/* Resize handles */}
            {/* Top-left corner */}
            <div
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group"
              onMouseDown={(e) => startResize(e, 'nw')}
            >
              <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {/* Top edge */}
            <div
              className="absolute top-0 left-4 right-0 h-2 cursor-n-resize z-10"
              onMouseDown={(e) => startResize(e, 'n')}
            />
            {/* Left edge */}
            <div
              className="absolute top-4 left-0 bottom-0 w-2 cursor-w-resize z-10"
              onMouseDown={(e) => startResize(e, 'w')}
            />
            {/* Header */}
            <div className="bg-primary-500 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{t('chatbot.title')}</h3>
                  <p className="text-white/70 text-xs">{t('chatbot.subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={resetSize}
                  className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                  title={t('chatbot.resetSize') || 'Reset size'}
                >
                  ⊡
                </button>
                <button
                  onClick={clearChat}
                  className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                  title={t('chatbot.clearChat')}
                >
                  {t('chatbot.clear')}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                  aria-label={t('chatbot.closeChat')}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start space-x-2 max-w-[80%] ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-full flex-shrink-0 ${
                        message.role === 'user'
                          ? 'bg-primary-100 dark:bg-primary-900'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <UserCircleIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      ) : (
                        <SparklesIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      )}
                    </div>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary-600 dark:bg-primary-500 text-white rounded-br-md shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap font-medium">{message.content}</p>
                      ) : (
                        <div className="text-sm chatbot-markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">{children}</p>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-primary-600 dark:text-primary-400">{children}</strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic">{children}</em>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-none space-y-1 my-2">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                              ),
                              li: ({ children }) => (
                                <li className="flex items-start">
                                  <span className="text-primary-500 mr-2">•</span>
                                  <span className="flex-1">{children}</span>
                                </li>
                              ),
                              code: ({ className, children }) => {
                                const isInline = !className;
                                if (isInline) {
                                  return (
                                    <code className="bg-gray-200 dark:bg-gray-600 text-primary-600 dark:text-primary-300 px-1.5 py-0.5 rounded text-xs font-mono">
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <code className="block bg-gray-800 text-gray-100 p-2 rounded text-xs font-mono my-2 overflow-x-auto">
                                    {children}
                                  </code>
                                );
                              },
                              pre: ({ children }) => (
                                <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs font-mono my-2 overflow-x-auto">
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-primary-500 pl-3 my-2 italic text-gray-600 dark:text-gray-300">
                                  {children}
                                </blockquote>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  className="text-primary-500 hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-base font-bold mb-2 text-primary-600 dark:text-primary-400">{children}</h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-sm font-bold mb-2 text-primary-600 dark:text-primary-400">{children}</h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-semibold mb-1 text-primary-600 dark:text-primary-400">{children}</h3>
                              ),
                              hr: () => (
                                <hr className="my-2 border-gray-300 dark:border-gray-600" />
                              ),
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-2">
                                  <table className="min-w-full text-xs border-collapse">
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-200 dark:bg-gray-600 font-semibold text-left">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                  {children}
                                </td>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                      <SparklesIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('chatbot.placeholder')}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-full text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t('chatbot.send')}
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;
