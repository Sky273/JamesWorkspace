import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import PageHeader from '../components/page/PageHeader';
import { extractGuideSectionContent, getUserGuideSections } from './userGuide.config';
import { loadUserGuideContent } from './userGuideContentLoader';
import { userGuideMarkdownComponents } from './userGuideMarkdownComponents';

const UserGuidePage = (): JSX.Element => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en' || i18n.language?.startsWith('en-');
  const sections = getUserGuideSections(isEnglish);
  const [activeSection, setActiveSection] = useState<string>('introduction');
  const [userGuideContent, setUserGuideContent] = useState<string>('');
  const [sectionContent, setSectionContent] = useState<string>('');
  const [isLoadingGuide, setIsLoadingGuide] = useState<boolean>(true);

  useEffect(() => {
    setActiveSection('introduction');
  }, [i18n.language]);

  useEffect(() => {
    let isCancelled = false;
    setIsLoadingGuide(true);

    void loadUserGuideContent(isEnglish)
      .then((content) => {
        if (!isCancelled) {
          setUserGuideContent(content);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingGuide(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isEnglish]);

  useEffect(() => {
    setSectionContent(
      extractGuideSectionContent({
        isEnglish,
        sectionId: activeSection,
        content: userGuideContent,
      })
    );
  }, [activeSection, isEnglish, userGuideContent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="user-guide-shell cv-surface app-page-shell max-w-6xl"
    >
      <PageHeader title={t('userGuide.title')} subtitle={t('userGuide.subtitle')} />

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-72 flex-shrink-0">
          <nav className="section-shell sticky top-6 rounded-[2rem] p-4">
            <ul className="space-y-1">
              {sections.map((section) => {
                const IconComponent = section.icon;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeSection === section.id
                          ? 'user-guide-nav-item--active bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" />
                      {section.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex-1">
          <div className="user-guide-content section-shell rounded-[2rem] p-6 md:p-8">
            {isLoadingGuide ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={userGuideMarkdownComponents}>
                {sectionContent}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UserGuidePage;
