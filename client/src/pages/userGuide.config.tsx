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
  FunnelIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';


export interface UserGuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ENGLISH_SECTION_TITLES: Record<string, string> = {
  introduction: 'Introduction',
  'quick-start': 'Quick Start',
  'user-profile': 'User Profile',
  'resume-management': 'Resume Management',
  missions: 'Missions',
  'profile-matching': 'Profile Matching',
  'selection-pipeline': 'Selection Pipeline',
  'resume-adaptations': 'Resume Adaptations',
  'clients-prospects': 'Clients & Prospects',
  deals: 'Deals',
  'email-cv-sending': 'Email CV Sending',
  'market-radar': 'Market Radar',
  'ai-assistant': 'AI Assistant',
  administration: 'Administration',
  'database-backup': 'Database Backup',
  'gdpr-compliance': 'GDPR Compliance',
  'interface-and-navigation': 'Interface and Navigation',
  'best-practices': 'Best Practices',
  troubleshooting: 'Troubleshooting',
  faq: 'FAQ',
  roadmap: 'Roadmap',
  glossary: 'Glossary',
  support: 'Support',
};

const FRENCH_SECTION_TITLES: Record<string, string> = {
  introduction: 'Introduction',
  'demarrage-rapide': 'Démarrage Rapide',
  'profil-utilisateur': 'Profil Utilisateur',
  'gestion-des-cv': 'Gestion des CV',
  missions: 'Missions',
  'matching-profils': 'Matching Profils',
  'pipeline-de-selection': 'Pipeline de Sélection',
  'adaptations-de-cv': 'Adaptations de CV',
  'clients-prospects': 'Clients & Prospects',
  affaires: 'Affaires',
  'envoi-de-cv-par-email': 'Envoi de CV par Email',
  'radar-marche': 'Radar Marché',
  'assistant-ia': 'Assistant IA',
  administration: 'Administration',
  'sauvegarde-de-la-base-de-donnees': 'Sauvegarde de la Base de Données',
  'conformite-rgpd': 'Conformité RGPD',
  'interface-et-navigation': 'Interface et Navigation',
  'bonnes-pratiques': 'Bonnes Pratiques',
  depannage: 'Dépannage',
  faq: 'FAQ',
  'prochaines-etapes': 'Prochaines Étapes',
  glossaire: 'Glossaire',
  support: 'Support',
};

const ENGLISH_SECTIONS: UserGuideSection[] = [
  { id: 'introduction', title: 'Introduction', icon: BookOpenIcon },
  { id: 'quick-start', title: 'Quick Start', icon: SparklesIcon },
  { id: 'user-profile', title: 'User Profile', icon: UserCircleIcon },
  { id: 'resume-management', title: 'Resume Management', icon: DocumentTextIcon },
  { id: 'missions', title: 'Missions', icon: BriefcaseIcon },
  { id: 'profile-matching', title: 'Profile Matching', icon: UserGroupIcon },
  { id: 'selection-pipeline', title: 'Selection Pipeline', icon: FunnelIcon },
  { id: 'resume-adaptations', title: 'Adaptations', icon: SparklesIcon },
  { id: 'clients-prospects', title: 'Clients & Prospects', icon: BuildingOfficeIcon },
  { id: 'deals', title: 'Deals', icon: BriefcaseIcon },
  { id: 'email-cv-sending', title: 'Email CV Sending', icon: EnvelopeIcon },
  { id: 'market-radar', title: 'Market Radar', icon: ChartBarIcon },
  { id: 'ai-assistant', title: 'AI Assistant', icon: ChatBubbleLeftRightIcon },
  { id: 'administration', title: 'Administration', icon: Cog6ToothIcon },
  { id: 'database-backup', title: 'Database Backup', icon: ServerIcon },
  { id: 'gdpr-compliance', title: 'GDPR Compliance', icon: ShieldCheckIcon },
  { id: 'interface-and-navigation', title: 'Interface', icon: ComputerDesktopIcon },
  { id: 'best-practices', title: 'Best Practices', icon: LightBulbIcon },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: WrenchScrewdriverIcon },
  { id: 'faq', title: 'FAQ', icon: QuestionMarkCircleIcon },
  { id: 'roadmap', title: 'Roadmap', icon: RocketLaunchIcon },
  { id: 'glossary', title: 'Glossary', icon: BookmarkIcon },
  { id: 'support', title: 'Support', icon: PhoneIcon },
];

const FRENCH_SECTIONS: UserGuideSection[] = [
  { id: 'introduction', title: 'Introduction', icon: BookOpenIcon },
  { id: 'demarrage-rapide', title: 'Démarrage Rapide', icon: SparklesIcon },
  { id: 'profil-utilisateur', title: 'Profil Utilisateur', icon: UserCircleIcon },
  { id: 'gestion-des-cv', title: 'Gestion des CV', icon: DocumentTextIcon },
  { id: 'missions', title: 'Missions', icon: BriefcaseIcon },
  { id: 'matching-profils', title: 'Matching Profils', icon: UserGroupIcon },
  { id: 'pipeline-de-selection', title: 'Pipeline de Sélection', icon: FunnelIcon },
  { id: 'adaptations-de-cv', title: 'Adaptations', icon: SparklesIcon },
  { id: 'clients-prospects', title: 'Clients & Prospects', icon: BuildingOfficeIcon },
  { id: 'affaires', title: 'Affaires', icon: BriefcaseIcon },
  { id: 'envoi-de-cv-par-email', title: 'Envoi de CV par Email', icon: EnvelopeIcon },
  { id: 'radar-marche', title: 'Radar Marché', icon: ChartBarIcon },
  { id: 'assistant-ia', title: 'Assistant IA', icon: ChatBubbleLeftRightIcon },
  { id: 'administration', title: 'Administration', icon: Cog6ToothIcon },
  { id: 'sauvegarde-de-la-base-de-donnees', title: 'Sauvegarde', icon: ServerIcon },
  { id: 'conformite-rgpd', title: 'Conformité RGPD', icon: ShieldCheckIcon },
  { id: 'interface-et-navigation', title: 'Interface', icon: ComputerDesktopIcon },
  { id: 'bonnes-pratiques', title: 'Bonnes Pratiques', icon: LightBulbIcon },
  { id: 'depannage', title: 'Dépannage', icon: WrenchScrewdriverIcon },
  { id: 'faq', title: 'FAQ', icon: QuestionMarkCircleIcon },
  { id: 'prochaines-etapes', title: 'Prochaines Étapes', icon: RocketLaunchIcon },
  { id: 'glossaire', title: 'Glossaire', icon: BookmarkIcon },
  { id: 'support', title: 'Support', icon: PhoneIcon },
];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getUserGuideSections = (isEnglish: boolean): UserGuideSection[] =>
  isEnglish ? ENGLISH_SECTIONS : FRENCH_SECTIONS;


export const extractGuideSectionContent = (params: {
  isEnglish: boolean;
  sectionId: string;
  content: string;
}): string => {
  const { isEnglish, sectionId, content } = params;
  const sectionMap = isEnglish ? ENGLISH_SECTION_TITLES : FRENCH_SECTION_TITLES;
  const sectionTitle = sectionMap[sectionId];

  if (!sectionTitle) {
    return '';
  }

  const sectionRegex = new RegExp(`\\n## ${escapeRegex(sectionTitle)}([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = content.match(sectionRegex);

  return match ? `## ${sectionTitle}${match[1]}` : '';
};
