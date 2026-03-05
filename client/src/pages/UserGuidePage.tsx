/**
 * UserGuidePage Component
 * Displays the complete user documentation from USER_GUIDE.md
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpenIcon, 
  DocumentTextIcon, 
  BriefcaseIcon, 
  SparklesIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ComputerDesktopIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon,
  QuestionMarkCircleIcon,
  BookmarkIcon,
  PhoneIcon,
  UserGroupIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import userGuideContentFR from '@root/USER_GUIDE.md?raw';
import userGuideContentEN from '@root/USER_GUIDE_EN.md?raw';
import Breadcrumbs from '../components/Breadcrumbs';

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const UserGuidePage = (): JSX.Element => {
  const { t, i18n } = useTranslation();
  const [activeSection, setActiveSection] = useState<string>('introduction');
  const [sectionContent, setSectionContent] = useState<string>('');
  
  // Select guide content based on current language
  const isEnglish = i18n.language === 'en' || i18n.language?.startsWith('en-');
  const userGuideContent = isEnglish ? userGuideContentEN : userGuideContentFR;

  // Section titles based on language
  const sections: Section[] = isEnglish ? [
    { id: 'introduction', title: 'Introduction', icon: BookOpenIcon },
    { id: 'quick-start', title: 'Quick Start', icon: SparklesIcon },
    { id: 'user-profile', title: 'User Profile', icon: UserCircleIcon },
    { id: 'resume-management', title: 'Resume Management', icon: DocumentTextIcon },
    { id: 'missions', title: 'Missions', icon: BriefcaseIcon },
    { id: 'profile-matching', title: 'Profile Matching', icon: UserGroupIcon },
    { id: 'selection-pipeline', title: 'Selection Pipeline', icon: FunnelIcon },
    { id: 'resume-adaptations', title: 'Adaptations', icon: SparklesIcon },
    { id: 'clients-prospects', title: 'Clients & Prospects', icon: BuildingOfficeIcon },
    { id: 'email-cv-sending', title: 'Email CV Sending', icon: EnvelopeIcon },
    { id: 'market-radar', title: 'Market Radar', icon: ChartBarIcon },
    { id: 'ai-assistant', title: 'AI Assistant', icon: ChatBubbleLeftRightIcon },
    { id: 'administration', title: 'Administration', icon: Cog6ToothIcon },
    { id: 'gdpr-compliance', title: 'GDPR Compliance', icon: ShieldCheckIcon },
    { id: 'interface-and-navigation', title: 'Interface', icon: ComputerDesktopIcon },
    { id: 'best-practices', title: 'Best Practices', icon: LightBulbIcon },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: WrenchScrewdriverIcon },
    { id: 'faq', title: 'FAQ', icon: QuestionMarkCircleIcon },
    { id: 'roadmap', title: 'Roadmap', icon: RocketLaunchIcon },
    { id: 'glossary', title: 'Glossary', icon: BookmarkIcon },
    { id: 'support', title: 'Support', icon: PhoneIcon },
  ] : [
    { id: 'introduction', title: 'Introduction', icon: BookOpenIcon },
    { id: 'demarrage-rapide', title: 'Démarrage Rapide', icon: SparklesIcon },
    { id: 'profil-utilisateur', title: 'Profil Utilisateur', icon: UserCircleIcon },
    { id: 'gestion-des-cv', title: 'Gestion des CV', icon: DocumentTextIcon },
    { id: 'missions', title: 'Missions', icon: BriefcaseIcon },
    { id: 'matching-profils', title: 'Matching Profils', icon: UserGroupIcon },
    { id: 'pipeline-de-selection', title: 'Pipeline de Sélection', icon: FunnelIcon },
    { id: 'adaptations-de-cv', title: 'Adaptations', icon: SparklesIcon },
    { id: 'clients-prospects', title: 'Clients & Prospects', icon: BuildingOfficeIcon },
    { id: 'envoi-de-cv-par-email', title: 'Envoi de CV par Email', icon: EnvelopeIcon },
    { id: 'radar-marche', title: 'Radar Marché', icon: ChartBarIcon },
    { id: 'assistant-ia', title: 'Assistant IA', icon: ChatBubbleLeftRightIcon },
    { id: 'administration', title: 'Administration', icon: Cog6ToothIcon },
    { id: 'conformite-rgpd', title: 'Conformité RGPD', icon: ShieldCheckIcon },
    { id: 'interface-et-navigation', title: 'Interface', icon: ComputerDesktopIcon },
    { id: 'bonnes-pratiques', title: 'Bonnes Pratiques', icon: LightBulbIcon },
    { id: 'depannage', title: 'Dépannage', icon: WrenchScrewdriverIcon },
    { id: 'faq', title: 'FAQ', icon: QuestionMarkCircleIcon },
    { id: 'prochaines-etapes', title: 'Prochaines Étapes', icon: RocketLaunchIcon },
    { id: 'glossaire', title: 'Glossaire', icon: BookmarkIcon },
    { id: 'support', title: 'Support', icon: PhoneIcon },
  ];

  // Extract section content from the full markdown
  const extractSectionContent = (sectionId: string): string => {
    // Section map for both languages
    const sectionMapEN: { [key: string]: string } = {
      'introduction': 'Introduction',
      'quick-start': 'Quick Start',
      'user-profile': 'User Profile',
      'resume-management': 'Resume Management',
      'missions': 'Missions',
      'profile-matching': 'Profile Matching',
      'selection-pipeline': 'Selection Pipeline',
      'resume-adaptations': 'Resume Adaptations',
      'clients-prospects': 'Clients & Prospects',
      'email-cv-sending': 'Email CV Sending',
      'market-radar': 'Market Radar',
      'ai-assistant': 'AI Assistant',
      'administration': 'Administration',
      'gdpr-compliance': 'GDPR Compliance',
      'interface-and-navigation': 'Interface and Navigation',
      'best-practices': 'Best Practices',
      'troubleshooting': 'Troubleshooting',
      'faq': 'FAQ',
      'roadmap': 'Roadmap',
      'glossary': 'Glossary',
      'support': 'Support',
    };

    const sectionMapFR: { [key: string]: string } = {
      'introduction': 'Introduction',
      'demarrage-rapide': 'Démarrage Rapide',
      'profil-utilisateur': 'Profil Utilisateur',
      'gestion-des-cv': 'Gestion des CV',
      'missions': 'Missions',
      'matching-profils': 'Matching Profils',
      'pipeline-de-selection': 'Pipeline de Sélection',
      'adaptations-de-cv': 'Adaptations de CV',
      'clients-prospects': 'Clients & Prospects',
      'envoi-de-cv-par-email': 'Envoi de CV par Email',
      'radar-marche': 'Radar Marché',
      'assistant-ia': 'Assistant IA',
      'administration': 'Administration',
      'conformite-rgpd': 'Conformité RGPD',
      'interface-et-navigation': 'Interface et Navigation',
      'bonnes-pratiques': 'Bonnes Pratiques',
      'depannage': 'Dépannage',
      'faq': 'FAQ',
      'prochaines-etapes': 'Prochaines Étapes',
      'glossaire': 'Glossaire',
      'support': 'Support',
    };

    const sectionMap = isEnglish ? sectionMapEN : sectionMapFR;

    const sectionTitle = sectionMap[sectionId];
    if (!sectionTitle) return '';

    // Find the section in the markdown content
    // Use \n## to match only level-2 headings (not ### which contains ##)
    const sectionRegex = new RegExp(`\\n## ${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = userGuideContent.match(sectionRegex);
    
    if (match) {
      return `## ${sectionTitle}${match[1]}`;
    }
    
    return '';
  };

  // Reset to introduction when language changes
  useEffect(() => {
    setActiveSection('introduction');
  }, [i18n.language]);

  useEffect(() => {
    const content = extractSectionContent(activeSection);
    setSectionContent(content);
  }, [activeSection, i18n.language, userGuideContent]);

  // Custom components for ReactMarkdown
  const markdownComponents: Components = {
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white border-b-2 border-blue-500 pb-3 mb-6 mt-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4 flex items-center">
        <span className="w-1 h-6 bg-blue-500 rounded mr-3"></span>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-6 mb-3">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-base font-medium text-gray-600 dark:text-gray-400 mt-4 mb-2">
        {children}
      </h5>
    ),
    p: ({ children }) => (
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="space-y-2 mb-4 ml-4">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="space-y-2 mb-4 ml-4 list-decimal list-inside">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-gray-600 dark:text-gray-400 flex items-start">
        <span className="text-blue-500 mr-2 mt-1.5">•</span>
        <span className="flex-1">{children}</span>
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900 dark:text-white">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-700 dark:text-gray-300">
        {children}
      </em>
    ),
    code: ({ className, children }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className={className}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 text-sm font-mono">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-3 my-4 rounded-r-lg">
        <div className="text-blue-800 dark:text-blue-300 italic">
          {children}
        </div>
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-100 dark:bg-gray-700">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-600">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {children}
      </td>
    ),
    a: ({ href, children }) => (
      <a 
        href={href} 
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    ),
    hr: () => (
      <hr className="my-8 border-t-2 border-gray-200 dark:border-gray-700" />
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 max-w-6xl mx-auto"
    >
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('userGuide.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('userGuide.subtitle')}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar navigation */}
        <div className="md:w-64 flex-shrink-0">
          <nav className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-6">
            <ul className="space-y-1">
              {sections.map((section) => {
                const IconComponent = section.icon;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      <IconComponent className="h-5 w-5 mr-2" />
                      {section.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:p-8">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {sectionContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UserGuidePage;
