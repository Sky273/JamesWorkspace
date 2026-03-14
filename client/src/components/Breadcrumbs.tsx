/**
 * Breadcrumbs Component
 * Navigation breadcrumbs with automatic route detection
 */

import { Link, useLocation, useParams } from 'react-router-dom';
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
}

const Breadcrumbs = ({ items, className = '' }: BreadcrumbsProps): JSX.Element | null => {
  const location = useLocation();
  const _params = useParams<{ id?: string }>();
  const { t } = useTranslation();
  const { currentResume } = useResume();

  // Auto-generate breadcrumbs based on current route if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: t('navigation.home'), href: '/' }
    ];

    let _currentPath = '';

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      _currentPath += `/${segment}`;
      const isLast = i === pathSegments.length - 1;

      // Handle different route patterns
      switch (segment) {
        case 'resumes':
          breadcrumbs.push({
            label: t('navigation.resumes'),
            href: isLast ? undefined : '/resumes',
            current: isLast
          });
          break;

        case 'missions':
          breadcrumbs.push({
            label: t('navigation.missions'),
            href: isLast ? undefined : '/missions',
            current: isLast
          });
          break;

        case 'clients':
          breadcrumbs.push({
            label: t('navigation.crm', 'CRM'),
            href: isLast ? undefined : '/clients',
            current: isLast
          });
          break;

        case 'adaptations':
          breadcrumbs.push({
            label: t('navigation.adaptations'),
            href: isLast ? undefined : '/adaptations',
            current: isLast
          });
          break;

        case 'templates':
          breadcrumbs.push({
            label: t('navigation.templates'),
            href: isLast ? undefined : '/templates',
            current: isLast
          });
          break;

        case 'analysis':
          breadcrumbs.push({
            label: t('resume.steps.analysis'),
            current: isLast
          });
          break;

        case 'improve':
          breadcrumbs.push({
            label: t('resume.steps.improve'),
            current: isLast
          });
          break;

        case 'export':
          breadcrumbs.push({
            label: t('resume.steps.export'),
            current: isLast
          });
          break;

        case 'upload':
          breadcrumbs.push({
            label: t('navigation.upload'),
            current: true
          });
          break;

        case 'settings':
          breadcrumbs.push({
            label: t('navigation.settings'),
            current: true
          });
          break;

        case 'guide':
          breadcrumbs.push({
            label: t('navigation.userGuide'),
            current: true
          });
          break;

        case 'profile-matching':
          breadcrumbs.push({
            label: t('navigation.profileMatching'),
            current: true
          });
          break;

        case 'radar':
          breadcrumbs.push({
            label: t('navigation.radar'),
            current: true
          });
          break;

        case 'metrics':
          breadcrumbs.push({
            label: t('navigation.metrics'),
            current: true
          });
          break;

        case 'users':
          breadcrumbs.push({
            label: t('navigation.users'),
            current: true
          });
          break;

        case 'security-logs':
          breadcrumbs.push({
            label: t('navigation.securityLogs'),
            current: true
          });
          break;

        case 'tags':
          breadcrumbs.push({
            label: t('navigation.tags'),
            current: true
          });
          break;

        case 'email-templates':
          breadcrumbs.push({
            label: t('navigation.emailTemplates'),
            current: isLast
          });
          break;

        case 'admin':
          breadcrumbs.push({
            label: t('navigation.admin'),
            href: isLast ? undefined : '/admin',
            current: isLast
          });
          break;

        default:
          // Check if this is an ID (UUID or similar)
          if (segment.match(/^[a-zA-Z0-9-_]{10,}$/)) {
            // This is likely a resource ID
            const prevSegment = pathSegments[i - 1];
            
            if (prevSegment === 'resumes') {
              const resumeName = currentResume?.Name || currentResume?.['File Name'] || t('common.loading');
              breadcrumbs.push({
                label: resumeName,
                href: isLast ? undefined : `/resumes/${segment}/analysis`,
                current: isLast
              });
            } else if (prevSegment === 'missions') {
              breadcrumbs.push({
                label: t('missions.details'),
                current: isLast
              });
            } else if (prevSegment === 'adaptations') {
              breadcrumbs.push({
                label: t('adaptations.details'),
                current: isLast
              });
            }
          }
          break;
      }
    }

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  // Don't render if only home
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav className={`flex items-center text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRightIcon className="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" />
            )}
            {index === 0 ? (
              <Link
                to={item.href || '/'}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <HomeIcon className="w-4 h-4" />
              </Link>
            ) : item.current || !item.href ? (
              <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors truncate max-w-[200px]"
              >
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
