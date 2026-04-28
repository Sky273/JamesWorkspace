/**
 * ChatbotTab Component
 * Settings for chatbot configuration
 */

import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import SettingsSwitch from './SettingsSwitch';

interface ChatbotTabProps {
  formData: {
    chatbotEnabled?: 'on' | 'off';
    [key: string]: string | number | boolean | undefined | Record<string, Record<string, Record<string, string | number>>>;
  };
  onInputChange: (field: string, value: string | number | boolean) => void;
  t: (key: string) => string;
}

export const ChatbotTab = ({ formData, onInputChange, t }: ChatbotTabProps): JSX.Element => {
  const isEnabled = formData.chatbotEnabled === 'on';
  
  const toggleChatbot = (checked: boolean) => {
    onInputChange('chatbotEnabled', checked ? 'on' : 'off');
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-base font-semibold text-[var(--cv-text)]">
          {t('settings.chatbot.title')}
        </h3>
        <p className="text-sm text-[var(--cv-muted)]">
          {t('settings.chatbot.description')}
        </p>
      </div>

      {/* Enable/Disable Chatbot */}
      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="rounded-[9px] bg-[#ede9ff] p-2.5 text-[#6246ea] dark:bg-white/10 dark:text-[#c9ccff]">
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="mb-1 text-sm font-semibold text-[var(--cv-text)]">
                {t('settings.chatbot.enableTitle')}
              </h4>
              <p className="text-sm text-[var(--cv-muted)]">
                {t('settings.chatbot.enableDescription')}
              </p>
            </div>
          </div>
          
          <div className="flex-shrink-0 ml-4">
            <SettingsSwitch
              checked={isEnabled}
              onChange={toggleChatbot}
              label={t('settings.chatbot.enableTitle')}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-[#dedbe8] pt-4 dark:border-white/10">
          <div className="flex items-center text-sm">
            <span className={`
              inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
              ${isEnabled 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
              }
            `}>
              {isEnabled ? t('settings.chatbot.statusEnabled') : t('settings.chatbot.statusDisabled')}
            </span>
            <span className="ml-3 text-[var(--cv-muted)]">
              {isEnabled 
                ? t('settings.chatbot.statusEnabledInfo')
                : t('settings.chatbot.statusDisabledInfo')
              }
            </span>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-[#6246ea] dark:text-[#c9ccff]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-[var(--cv-text)]">
              {t('settings.chatbot.infoTitle')}
            </h3>
            <div className="mt-2 text-sm text-[var(--cv-muted)]">
              <ul className="list-disc list-inside space-y-1">
                <li>{t('settings.chatbot.info1')}</li>
                <li>{t('settings.chatbot.info2')}</li>
                <li>{t('settings.chatbot.info3')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
