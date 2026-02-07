/**
 * AboutModal Component
 * TypeScript version with Markdown changelog rendering
 */

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, SparklesIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import packageJson from '@root/package.json';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal = ({ isOpen, onClose }: AboutModalProps): JSX.Element => {
  const { t } = useTranslation();
  const [changelogText, setChangelogText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Lazy load CHANGELOG.md only when modal is opened
  useEffect(() => {
    if (isOpen && !changelogText) {
      setIsLoading(true);
      import('@root/CHANGELOG.md?raw')
        .then((module) => {
          setChangelogText(module.default);
          setIsLoading(false);
        })
        .catch(() => {
          setChangelogText(t('about.errorLoadingChangelog'));
          setIsLoading(false);
        });
    }
  }, [isOpen, changelogText, t]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left align-middle shadow-2xl transition-all border border-gray-200 dark:border-gray-700">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        <SparklesIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <Dialog.Title as="h3" className="text-lg font-semibold text-white">
                          {t('about.title')}
                        </Dialog.Title>
                        <p className="text-white/80 text-sm">Version v{packageJson.version}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                      onClick={onClose}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t('about.description')}
                  </p>
                </div>

                {/* Changelog */}
                <div className="px-6 py-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <DocumentTextIcon className="h-5 w-5 text-primary-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('about.changelog')}
                    </h4>
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-900/50 p-4 border border-gray-200 dark:border-gray-700">
                    <div className="changelog-markdown text-sm">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                          <span className="ml-2 text-gray-500">{t('common.loading') || 'Loading...'}</span>
                        </div>
                      ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-primary-500 rounded-full mr-2"></span>
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1.5">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="space-y-1.5 my-2 ml-1">{children}</ul>
                          ),
                          li: ({ children }) => (
                            <li className="flex items-start text-gray-600 dark:text-gray-300">
                              <span className="text-primary-500 mr-2 mt-0.5">•</span>
                              <span className="flex-1">{children}</span>
                            </li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic text-gray-500 dark:text-gray-400">{children}</em>
                          ),
                          code: ({ children }) => (
                            <code className="bg-gray-200 dark:bg-gray-700 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded text-xs font-mono">
                              {children}
                            </code>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              className="text-primary-500 hover:text-primary-600 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          hr: () => (
                            <hr className="my-4 border-gray-200 dark:border-gray-700" />
                          ),
                        }}
                      >
                        {changelogText}
                      </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    © {new Date().getFullYear()} ResumeConverter • {t('about.allRightsReserved') || 'All rights reserved'}
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AboutModal;
