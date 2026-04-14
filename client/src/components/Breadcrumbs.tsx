/**
 * Breadcrumbs Component
 * Navigation breadcrumbs with automatic route detection
 */

import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useResume } from '../context/ResumeContext';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  tone?: 'default' | 'header';
}

const DETAIL_SEGMENTS = new Set(['analysis', 'improve', 'export', 'adapt']);

const Breadcrumbs = ({ items, className = '', tone = 'default' }: BreadcrumbsProps): JSX.Element | null => {
  const location = useLocation();
  const { t } = useTranslation();
  const { currentResume } = useResume();

  const palette = tone === 'header'
    ? {
        nav: 'text-[13px] text-slate-500 dark:text-slate-300',
        icon: 'text-slate-300 dark:text-slate-500',
        home: 'text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
        link: 'text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
        current: 'font-medium text-slate-900 dark:text-white',
      }
    : {
        nav: 'text-sm',
        icon: 'text-gray-400',
        home: 'text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
        link: 'text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
        current: 'font-medium text-gray-900 dark:text-gray-100',
      };

  const getDynamicLabel = (segment: string, previousSegment?: string): BreadcrumbItem | null => {
    if (previousSegment === 'resumes') {
      const resumeName = currentResume?.Name || currentResume?.['File Name'] || t('common.loading');
      return { label: resumeName, href: `/resumes/${segment}`, current: false };
    }

    if (previousSegment === 'missions') {
      return { label: t('missions.details', 'Détail mission'), current: true };
    }

    if (previousSegment === 'adaptations') {
      return { label: t('adaptations.details', 'Détail adaptation'), current: true };
    }

    if (previousSegment === 'edit' && location.pathname.startsWith('/admin/templates/edit/')) {
      return { label: t('templates.editTemplate', 'Modifier le template'), current: true };
    }

    return null;
  };

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: t('navigation.home'), href: '/' }];

    if (pathSegments.length === 0) {
      breadcrumbs.push({ label: t('navigation.home'), current: true });
      return breadcrumbs;
    }

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const previousSegment = pathSegments[i - 1];
      const nextSegment = pathSegments[i + 1];
      const isLast = i === pathSegments.length - 1;

      switch (segment) {
        case 'dashboard':
          break;
        case 'resumes':
          breadcrumbs.push({ label: t('navigation.resumes'), href: isLast ? undefined : '/resumes', current: isLast });
          break;
        case 'missions':
          breadcrumbs.push({ label: t('navigation.missions'), href: isLast ? undefined : '/missions', current: isLast });
          break;
        case 'clients':
          breadcrumbs.push({ label: t('navigation.crm', 'CRM'), href: isLast ? undefined : '/clients', current: isLast });
          break;
        case 'adaptations':
          breadcrumbs.push({ label: t('navigation.adaptations'), href: isLast ? undefined : '/adaptations', current: isLast });
          break;
        case 'templates':
          breadcrumbs.push({ label: t('navigation.templates'), href: isLast ? undefined : '/admin?tab=templates', current: isLast });
          break;
        case 'new':
          if (previousSegment === 'templates') {
            breadcrumbs.push({ label: t('templates.newTemplate', 'Nouveau template'), current: true });
          }
          break;
        case 'edit':
          if (previousSegment === 'templates') {
            breadcrumbs.push({ label: t('templates.editTemplate', 'Modifier le template'), current: false });
          }
          break;
        case 'analysis':
          breadcrumbs.push({ label: t('resume.steps.analysis'), current: isLast });
          break;
        case 'improve':
          breadcrumbs.push({ label: t('resume.steps.improve'), current: isLast });
          break;
        case 'export':
          breadcrumbs.push({ label: t('resume.steps.export'), current: isLast });
          break;
        case 'adapt':
          breadcrumbs.push({ label: t('resume.steps.adapt', 'Adaptation'), current: isLast });
          break;
        case 'upload':
          breadcrumbs.push({ label: t('navigation.upload'), current: true });
          break;
        case 'batch-upload':
          breadcrumbs.push({ label: t('batchUpload.title', 'Import par lot'), current: true });
          break;
        case 'batch-jobs':
          breadcrumbs.push({ label: t('navigation.jobs', 'Jobs'), current: true });
          break;
        case 'settings':
          breadcrumbs.push({ label: t('navigation.settings'), current: true });
          break;
        case 'guide':
          breadcrumbs.push({ label: t('navigation.userGuide'), current: true });
          break;
        case 'profile':
          breadcrumbs.push({ label: t('navigation.profile', 'Profil'), current: true });
          break;
        case 'profile-matching':
          breadcrumbs.push({ label: t('navigation.profileMatching'), current: true });
          break;
        case 'facts':
          breadcrumbs.push({ label: t('navigation.facts', 'Faits marché'), current: true });
          break;
        case 'metiers':
          breadcrumbs.push({ label: t('navigation.metiers', 'Métiers'), current: true });
          break;
        case 'admin':
          breadcrumbs.push({ label: t('navigation.administration', 'Administration'), href: isLast ? undefined : '/admin', current: isLast });
          break;
        case 'metrics':
          breadcrumbs.push({ label: t('navigation.metrics'), href: isLast ? undefined : '/dashboard/metrics', current: isLast });
          break;
        case 'users':
          breadcrumbs.push({ label: t('navigation.users'), href: isLast ? undefined : '/admin?tab=users', current: isLast });
          break;
        case 'security-logs':
          breadcrumbs.push({ label: t('navigation.securityLogs'), href: isLast ? undefined : '/dashboard/security-logs', current: isLast });
          break;
        case 'tags':
          breadcrumbs.push({ label: t('navigation.tags'), href: isLast ? undefined : '/admin?tab=tags', current: isLast });
          break;
        case 'email-templates':
          breadcrumbs.push({ label: t('navigation.emailTemplates'), href: isLast ? undefined : '/admin?tab=emailTemplates', current: isLast });
          break;
        case 'gdpr-audit':
          breadcrumbs.push({ label: t('navigation.gdprAudit', 'Audit RGPD'), href: isLast ? undefined : '/dashboard/gdpr-audit', current: isLast });
          break;
        case 'backup':
          breadcrumbs.push({ label: t('navigation.backup', 'Sauvegardes'), href: isLast ? undefined : '/dashboard/backup', current: isLast });
          break;
        default: {
          const dynamicItem = getDynamicLabel(segment, previousSegment);
          if (dynamicItem) {
            if (previousSegment === 'resumes' && nextSegment && DETAIL_SEGMENTS.has(nextSegment)) {
              breadcrumbs.push({ ...dynamicItem, current: false });
            } else {
              breadcrumbs.push({
                ...dynamicItem,
                current: dynamicItem.current ?? isLast,
                href: dynamicItem.current || isLast ? undefined : dynamicItem.href,
              });
            }
          }
          break;
        }
      }
    }

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center ${palette.nav} ${className}`} aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1.5">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex min-w-0 items-center">
            {index > 0 && <ChevronRightIcon className={`mx-0.5 h-3.5 w-3.5 flex-shrink-0 ${palette.icon}`} />}
            {index === 0 ? (
              <Link
                to={item.href || '/'}
                className={palette.home}
                aria-label={item.label}
                title={item.label}
              >
                <HomeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : item.current || !item.href ? (
              <span className={`max-w-[220px] truncate sm:max-w-[320px] ${palette.current}`}>{item.label}</span>
            ) : (
              <Link to={item.href} className={`max-w-[220px] truncate sm:max-w-[320px] ${palette.link}`}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
