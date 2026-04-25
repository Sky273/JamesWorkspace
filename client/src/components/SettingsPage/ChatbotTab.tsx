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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('settings.chatbot.title')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {t('settings.chatbot.description')}
        </p>
      </div>

      {/* Enable/Disable Chatbot */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                {t('settings.chatbot.enableTitle')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center text-sm">
            <span className={`
              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${isEnabled 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
              }
            `}>
              {isEnabled ? t('settings.chatbot.statusEnabled') : t('settings.chatbot.statusDisabled')}
            </span>
            <span className="ml-3 text-gray-500 dark:text-gray-400">
              {isEnabled 
                ? t('settings.chatbot.statusEnabledInfo')
                : t('settings.chatbot.statusDisabledInfo')
              }
            </span>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {t('settings.chatbot.infoTitle')}
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
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
