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
    <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:bg-[#1f2430] dark:scrollbar-thumb-slate-600">
      {messages.map((message) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`flex max-w-[82%] items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border shadow-sm ${message.role === 'user' ? 'border-primary-200 bg-white text-primary-600 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-300' : 'border-violet-100 bg-white text-primary-600 dark:border-slate-700 dark:bg-[#2a303b] dark:text-primary-300'}`}>
              {message.role === 'user' ? (
                <UserCircleIcon className="h-5 w-5" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
            </div>
            <div className={`rounded-2xl px-4 py-3 shadow-sm ring-1 ${message.role === 'user' ? 'rounded-br-md bg-primary-600 !text-white ring-primary-500/20 shadow-primary-900/20 dark:bg-primary-500' : 'rounded-bl-md bg-white text-slate-700 ring-slate-200/80 dark:bg-[#2a303b] dark:text-slate-100 dark:ring-slate-700/80'}`}>
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap text-sm font-semibold leading-6 !text-white">{message.content}</p>
              ) : (
                <ChatbotMarkdown content={message.content} />
              )}
            </div>
          </div>
        </motion.div>
      ))}

      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 bg-white text-primary-600 shadow-sm dark:border-slate-700 dark:bg-[#2a303b] dark:text-primary-300">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/80 dark:bg-[#2a303b] dark:ring-slate-700/80">
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
