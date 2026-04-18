import {
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type {
  DashboardStats,
  KPICardConfig,
  QuickActionConfig,
  SecondaryStatCard,
} from './HomeDashboard.types';

export function getFirmLabel(user: { firmName?: string; firm?: string } | null | undefined): string | null {
  return user?.firmName || user?.firm || null;
}

export function buildKpiCards(stats: DashboardStats, t: TFunction<'translation', undefined>): KPICardConfig[] {
  return [
    {
      icon: DocumentTextIcon,
      label: t('home.dashboard.kpis.totalResumes'),
      value: stats.resumes.total,
      subValue: t('home.dashboard.kpis.thisMonth', { count: stats.resumes.thisMonth }),
      color: 'text-blue-600 dark:text-blue-400',
      delay: 0,
      route: '/resumes',
    },
    {
      icon: SparklesIcon,
      label: t('home.dashboard.kpis.analyzed'),
      value: stats.resumes.analyzed,
      subValue: `${stats.resumes.total > 0 ? Math.round((stats.resumes.analyzed / stats.resumes.total) * 100) : 0}%`,
      color: 'text-purple-600 dark:text-purple-400',
      delay: 0.1,
      route: '/resumes',
    },
    {
      icon: ChartBarIcon,
      label: t('home.dashboard.kpis.averageScore'),
      value: `${stats.scores.averageImproved > 0 ? stats.scores.averageImproved : stats.scores.averageOriginal}%`,
      subValue:
        stats.scores.improvement > 0
          ? `+${stats.scores.improvement} pts ${t('home.dashboard.kpis.afterImprovement')}`
          : undefined,
      color: 'text-green-600 dark:text-green-400',
      delay: 0.2,
      route: '/resumes',
    },
    {
      icon: BriefcaseIcon,
      label: t('home.dashboard.kpis.activeMissions'),
      value: stats.missions.active,
      subValue: t('home.dashboard.kpis.totalMissions', { count: stats.missions.total }),
      color: 'text-orange-600 dark:text-orange-400',
      delay: 0.3,
      route: '/missions',
    },
  ];
}

export function buildSecondaryStatCards(
  stats: DashboardStats,
  t: TFunction<'translation', undefined>,
): SecondaryStatCard[] {
  return [
    {
      title: t('home.dashboard.recentActivity'),
      delay: 0.4,
      icon: ClockIcon,
      rows: [
        { label: t('home.dashboard.today'), value: `${stats.resumes.today} CV` },
        { label: t('home.dashboard.thisWeek'), value: `${stats.resumes.thisWeek} CV` },
        { label: t('home.dashboard.thisMonth'), value: `${stats.resumes.thisMonth} CV` },
      ],
    },
    {
      title: t('home.dashboard.improvements'),
      delay: 0.5,
      icon: ArrowTrendingUpIcon,
      rows: [
        { label: t('home.dashboard.improved'), value: stats.resumes.improved },
        { label: t('home.dashboard.avgBefore'), value: `${stats.scores.averageOriginal}%` },
        {
          label: t('home.dashboard.avgAfter'),
          value: `${stats.scores.averageImproved}%`,
          valueClassName: 'text-green-600 dark:text-green-400',
        },
      ],
    },
    {
      title: t('home.dashboard.adaptations'),
      delay: 0.6,
      icon: DocumentDuplicateIcon,
      rows: [
        { label: t('home.dashboard.totalAdaptations'), value: stats.adaptations.total },
        { label: t('home.dashboard.missions'), value: stats.missions.total },
        {
          label: t('home.dashboard.active'),
          value: stats.missions.active,
          valueClassName: 'text-orange-600 dark:text-orange-400',
        },
      ],
    },
  ];
}

export function buildQuickActions(t: TFunction<'translation', undefined>): QuickActionConfig[] {
  return [
    {
      icon: DocumentPlusIcon,
      label: t('home.dashboard.actions.importResume'),
      description: t('home.dashboard.actions.importResumeDesc'),
      route: '/upload?new',
      color: 'bg-blue-500',
      delay: 0.8,
      tone: 'primary',
    },
    {
      icon: FolderOpenIcon,
      label: t('home.dashboard.actions.viewLibrary'),
      description: t('home.dashboard.actions.viewLibraryDesc'),
      route: '/resumes',
      color: 'bg-purple-500',
      delay: 0.9,
      tone: 'secondary',
    },
    {
      icon: ClipboardDocumentListIcon,
      label: t('home.dashboard.actions.createMission'),
      description: t('home.dashboard.actions.createMissionDesc'),
      route: '/missions',
      color: 'bg-orange-500',
      delay: 1.0,
      tone: 'secondary',
    },
    {
      icon: DocumentDuplicateIcon,
      label: t('home.dashboard.actions.viewAdaptations'),
      description: t('home.dashboard.actions.viewAdaptationsDesc'),
      route: '/adaptations',
      color: 'bg-green-500',
      delay: 1.1,
      tone: 'secondary',
    },
  ];
}
