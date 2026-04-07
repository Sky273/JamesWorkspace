/**
 * Email Template Preview Component
 * Displays the rendered HTML preview of an email template
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DevicePhoneMobileIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';

interface EmailTemplatePreviewProps {
  html: string;
  subject?: string;
  loading?: boolean;
}

const EmailTemplatePreview = ({ html, subject, loading }: EmailTemplatePreviewProps): JSX.Element => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Remove scripts from HTML to prevent sandbox errors
  const sanitizedHtml = useMemo(() => {
    if (!html) return '';
    // Remove script tags and event handlers to prevent console errors
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '');
  }, [html]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-900 rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('emailTemplates.loadingPreview')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('emailTemplates.preview')}
        </span>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setViewMode('desktop')}
            aria-label={t('emailTemplates.desktopView')}
            aria-pressed={viewMode === 'desktop'}
            className={`p-1.5 rounded ${
              viewMode === 'desktop'
                ? 'bg-white dark:bg-gray-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={t('emailTemplates.desktopView')}
          >
            <ComputerDesktopIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            aria-label={t('emailTemplates.mobileView')}
            aria-pressed={viewMode === 'mobile'}
            className={`p-1.5 rounded ${
              viewMode === 'mobile'
                ? 'bg-white dark:bg-gray-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={t('emailTemplates.mobileView')}
          >
            <DevicePhoneMobileIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Subject Preview */}
      {subject && (
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
            {t('emailTemplates.subjectLabel')}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {subject}
          </span>
        </div>
      )}

      {/* HTML Preview */}
      <div 
        className={`bg-white rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all ${
          viewMode === 'mobile' ? 'max-w-[375px] mx-auto' : 'w-full'
        }`}
      >
        {html ? (
          <iframe
            srcDoc={sanitizedHtml}
            title={t('emailTemplates.previewFrame', { defaultValue: 'Email preview' })}
            className="w-full h-[500px] border-0"
            sandbox="allow-same-origin allow-popups"
          />
        ) : (
          <div className="flex items-center justify-center h-96 text-gray-400">
            {t('emailTemplates.noPreview')}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplatePreview;
