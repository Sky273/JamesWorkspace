import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowPathIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
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
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/12 !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-all hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&_svg]:!text-white [&_svg]:[stroke:white]"
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
          className="fixed bottom-8 right-8 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] dark:border-slate-700/80 dark:bg-[#1f2430] dark:shadow-[0_24px_80px_-28px_rgba(0,0,0,0.9)]"
          style={{ width: size.width, height: size.height }}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={subtitleId}
        >
          <div className="absolute left-0 top-0 z-10 h-4 w-4 cursor-nw-resize group" aria-hidden="true" onMouseDown={(e) => onStartResize(e, 'nw')}>
            <div className="absolute left-1 top-1 h-2 w-2 rounded-full bg-white/60 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="absolute left-4 right-0 top-0 z-10 h-2 cursor-n-resize" aria-hidden="true" onMouseDown={(e) => onStartResize(e, 'n')} />
          <div className="absolute bottom-0 left-0 top-4 z-10 w-2 cursor-w-resize" aria-hidden="true" onMouseDown={(e) => onStartResize(e, 'w')} />

          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(135deg,#745cff_0%,#5b45f1_52%,#3f35c9_100%)] px-4 py-4 !text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] !text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                Assistant IA
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <HeaderActionButton onClick={onResetSize} title={resetSizeTitle}>
                  <ArrowPathIcon className="h-5 w-5 !text-white stroke-[2.3] [stroke:white]" aria-hidden="true" />
                </HeaderActionButton>
                <HeaderActionButton onClick={onClear} title={clearLabel}>
                  <TrashIcon className="h-5 w-5 !text-white stroke-[2.2] [stroke:white]" aria-hidden="true" />
                </HeaderActionButton>
                <HeaderActionButton onClick={onClose} title={closeLabel} ariaLabel={closeLabel}>
                  <XMarkIcon className="h-5 w-5 !text-white stroke-[2.4] [stroke:white]" aria-hidden="true" />
                </HeaderActionButton>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <SparklesIcon className="h-6 w-6 !text-white stroke-[2.2] [stroke:white]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id={titleId} className="text-[1.55rem] font-semibold leading-8 tracking-normal !text-white">
                      {title}
                    </h3>
                    <p id={subtitleId} className="mt-1 text-sm leading-5 !text-violet-50 [text-shadow:0_1px_1px_rgba(0,0,0,0.18)]">
                      {subtitle}
                    </p>
                  </div>
                  <span className="mt-1 flex-shrink-0 rounded-full border border-white/18 bg-white/12 px-2.5 py-1 text-[10px] font-semibold !text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                    En ligne
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ChatbotMessages messages={messages} isLoading={isLoading} messagesEndRef={messagesEndRef} />

          <div className="border-t border-slate-200/90 bg-white/95 p-4 dark:border-slate-700/80 dark:bg-[#202631]">
            <div className="flex items-center gap-2">
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
                className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-inner transition-colors focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50 dark:border-slate-700 dark:bg-[#2a303b] dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-primary-400 dark:focus:bg-[#2d3440]"
              />
              <button
                type="button"
                onClick={onSend}
                disabled={!inputValue.trim() || isLoading}
                className="flex min-h-12 w-14 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500 text-white shadow-[0_14px_28px_-16px_rgba(99,102,241,0.9)] transition-all hover:-translate-y-0.5 hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0 dark:disabled:border-slate-700 dark:disabled:bg-[#252b36] dark:disabled:text-slate-500"
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
