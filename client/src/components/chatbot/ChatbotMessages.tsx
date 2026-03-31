import { motion } from 'framer-motion';
import { SparklesIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import ChatbotMarkdown from './ChatbotMarkdown';
import type { Message } from './types';

interface ChatbotMessagesProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatbotMessages({ messages, isLoading, messagesEndRef }: ChatbotMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`flex items-start space-x-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <div className={`p-1.5 rounded-full flex-shrink-0 ${message.role === 'user' ? 'bg-primary-100 dark:bg-primary-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
              {message.role === 'user' ? (
                <UserCircleIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              ) : (
                <SparklesIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              )}
            </div>
            <div className={`px-4 py-2 rounded-2xl ${message.role === 'user' ? 'bg-indigo-700 dark:bg-indigo-600 rounded-br-md shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'}`}>
              {message.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap font-semibold text-white">{message.content}</p>
              ) : (
                <ChatbotMarkdown content={message.content} />
              )}
            </div>
          </div>
        </motion.div>
      ))}

      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
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
  );
}
