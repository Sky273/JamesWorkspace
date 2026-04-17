import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PaperAirplaneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
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

interface HeaderActionButtonProps {
  onClick: () => void;
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

function HeaderActionButton({ onClick, title, ariaLabel, children }: HeaderActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/16 bg-black/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-colors hover:bg-black/28"
      type="button"
    >
      {children}
    </button>
  );
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
  const titleId = useId();
  const subtitleId = useId();
  const inputLabelId = useId();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={chatRef}
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-8 right-8 z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          style={{ width: size.width, height: size.height }}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={subtitleId}
        >
          <div className="absolute top-0 left-0 z-10 h-4 w-4 cursor-nw-resize group" aria-hidden="true" onMouseDown={(e) => onStartResize(e, 'nw')}>
            <div className="absolute top-1 left-1 h-2 w-2 rounded-full bg-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="absolute top-0 left-4 right-0 z-10 h-2 cursor-n-resize" aria-hidden="true" onMouseDown={(e) => onStartResize(e, 'n')} />
          <div className="absolute top-4 left-0 bottom-0 z-10 w-2 cursor-w-resize" aria-hidden="true" onMouseDown={(e) => onStartResize(e, 'w')} />

          <div className="border-b border-white/10 bg-[linear-gradient(135deg,#6a5cff_0%,#5647ef_52%,#3f35c9_100%)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                Assistant IA
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <HeaderActionButton onClick={onResetSize} title={resetSizeTitle}>
                  <span className="text-lg font-semibold leading-none text-white" aria-hidden="true">↺</span>
                </HeaderActionButton>
                <HeaderActionButton onClick={onClear} title={clearLabel}>
                  <span className="text-base font-semibold leading-none text-white" aria-hidden="true">⌫</span>
                </HeaderActionButton>
                <HeaderActionButton onClick={onClose} title={closeLabel} ariaLabel={closeLabel}>
                  <span className="text-xl font-semibold leading-none text-white" aria-hidden="true">×</span>
                </HeaderActionButton>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/18 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                <SparklesIcon className="h-6 w-6 stroke-[2.2] text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id={titleId} className="text-[1.65rem] font-semibold leading-8 tracking-[-0.03em] text-white">
                      {title}
                    </h3>
                    <p id={subtitleId} className="mt-1 text-sm leading-5 text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.18)]">
                      {subtitle}
                    </p>
                  </div>
                  <span className="mt-1 flex-shrink-0 rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white">
                    En ligne
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ChatbotMessages messages={messages} isLoading={isLoading} messagesEndRef={messagesEndRef} />

          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <label id={inputLabelId} htmlFor="chatbot-message-input" className="sr-only">
                {placeholder}
              </label>
              <input
                id="chatbot-message-input"
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                aria-labelledby={inputLabelId}
                className="flex-1 rounded-full border-0 bg-gray-100 px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!inputValue.trim() || isLoading}
                className="rounded-full bg-primary-500 p-2 text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Envoyer le message"
              >
                <PaperAirplaneIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
