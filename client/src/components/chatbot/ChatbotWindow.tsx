import { AnimatePresence, motion } from 'framer-motion';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ChatbotMessages from './ChatbotMessages';
import type { ChatbotSize, Message } from './types';

interface ChatbotWindowProps {
  isOpen: boolean;
  size: ChatbotSize;
  inputValue: string;
  isLoading: boolean;
  messages: Message[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  chatRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  subtitle: string;
  placeholder: string;
  clearLabel: string;
  closeLabel: string;
  resetSizeTitle: string;
  onClose: () => void;
  onClear: () => void;
  onResetSize: () => void;
  onInputChange: (value: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onStartResize: (e: React.MouseEvent, direction: string) => void;
}

export default function ChatbotWindow({
  isOpen,
  size,
  inputValue,
  isLoading,
  messages,
  inputRef,
  chatRef,
  messagesEndRef,
  title,
  subtitle,
  placeholder,
  clearLabel,
  closeLabel,
  resetSizeTitle,
  onClose,
  onClear,
  onResetSize,
  onInputChange,
  onInputKeyDown,
  onSend,
  onStartResize
}: ChatbotWindowProps) {
  return (
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
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group" onMouseDown={(e) => onStartResize(e, 'nw')}>
            <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="absolute top-0 left-4 right-0 h-2 cursor-n-resize z-10" onMouseDown={(e) => onStartResize(e, 'n')} />
          <div className="absolute top-4 left-0 bottom-0 w-2 cursor-w-resize z-10" onMouseDown={(e) => onStartResize(e, 'w')} />

          <div className="bg-primary-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{title}</h3>
                <p className="text-white/70 text-xs">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={onResetSize} className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors" title={resetSizeTitle}>
                ↺
              </button>
              <button onClick={onClear} className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors" title={clearLabel}>
                {clearLabel}
              </button>
              <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors" aria-label={closeLabel}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <ChatbotMessages messages={messages} isLoading={isLoading} messagesEndRef={messagesEndRef} />

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-full text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              />
              <button
                onClick={onSend}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={placeholder}
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
