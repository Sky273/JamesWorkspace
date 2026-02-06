/**
 * HomeDashboard Component
 * Dashboard with KPIs and quick actions for the homepage
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  DocumentTextIcon,
  DocumentPlusIcon,
  BriefcaseIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  SparklesIcon,
  FolderOpenIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth } from '../utils/apiInterceptor';
import { createLogger } from '../utils/logger.frontend';

const log = createLogger('HomeDashboard');

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  resumes: {
    total: number;
    analyzed: number;
    improved: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  missions: {
    total: number;
    active: number;
  };
  adaptations: {
    total: number;
  };
  scores: {
    averageOriginal: number;
    averageImproved: number;
    improvement: number;
  };
  customer: string | null;
}

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subValue?: string;
  color: string;
  delay: number;
  onClick?: () => void;
}

interface QuickActionProps {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  color: string;
  delay: number;
}

// ============================================
// COMPONENTS
// ============================================

function KPICard({ icon: Icon, label, value, subValue, color, delay, onClick }: KPICardProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subValue && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subValue}</p>
          )}
        </div>
        <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, description, onClick, color, delay }: QuickActionProps): JSX.Element {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all text-left w-full"
    >
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </motion.button>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

function HomeDashboard(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      // Wait for auth to be initialized before making requests
      if (authLoading) {
        return;
      }
      
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth('/api/resumes/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          setError('Failed to load statistics');
        }
      } catch (err) {
        log.error('Error fetching stats', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAuthenticated, authLoading]);

  // Don't render while auth is loading or if not authenticated
  if (authLoading || !isAuthenticated) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <section className="py-12 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Error state - show minimal dashboard
  if (error || !stats) {
    return null;
  }

  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.Role?.toLowerCase() === 'admin';

  return (
    <section className="py-12 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('home.dashboard.title')}
          </h2>
          {stats.customer && (
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {stats.customer}
            </p>
          )}
        </motion.div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KPICard
            icon={DocumentTextIcon}
            label={t('home.dashboard.kpis.totalResumes')}
            value={stats.resumes.total}
            subValue={t('home.dashboard.kpis.thisMonth', { count: stats.resumes.thisMonth })}
            color="text-blue-600 dark:text-blue-400"
            delay={0}
            onClick={() => navigate('/resumes')}
          />
          <KPICard
            icon={SparklesIcon}
            label={t('home.dashboard.kpis.analyzed')}
            value={stats.resumes.analyzed}
            subValue={`${stats.resumes.total > 0 ? Math.round((stats.resumes.analyzed / stats.resumes.total) * 100) : 0}%`}
            color="text-purple-600 dark:text-purple-400"
            delay={0.1}
            onClick={() => navigate('/resumes')}
          />
          <KPICard
            icon={ChartBarIcon}
            label={t('home.dashboard.kpis.averageScore')}
            value={`${stats.scores.averageOriginal}%`}
            subValue={stats.scores.improvement > 0 ? `+${stats.scores.improvement}% ${t('home.dashboard.kpis.afterImprovement')}` : undefined}
            color="text-green-600 dark:text-green-400"
            delay={0.2}
            onClick={() => navigate('/resumes')}
          />
          <KPICard
            icon={BriefcaseIcon}
            label={t('home.dashboard.kpis.activeMissions')}
            value={stats.missions.active}
            subValue={t('home.dashboard.kpis.totalMissions', { count: stats.missions.total })}
            color="text-orange-600 dark:text-orange-400"
            delay={0.3}
            onClick={() => navigate('/missions')}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <ClockIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                {t('home.dashboard.recentActivity')}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.today')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.resumes.today} CV</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.thisWeek')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.resumes.thisWeek} CV</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.thisMonth')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.resumes.thisMonth} CV</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <ArrowTrendingUpIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                {t('home.dashboard.improvements')}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.improved')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.resumes.improved}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.avgBefore')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.scores.averageOriginal}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.avgAfter')}</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{stats.scores.averageImproved}%</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <DocumentDuplicateIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                {t('home.dashboard.adaptations')}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.totalAdaptations')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.adaptations.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.missions')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{stats.missions.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('home.dashboard.active')}</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{stats.missions.active}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          id="quick-actions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="scroll-mt-32"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('home.dashboard.quickActions')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickAction
              icon={DocumentPlusIcon}
              label={t('home.dashboard.actions.importResume')}
              description={t('home.dashboard.actions.importResumeDesc')}
              onClick={() => navigate('/upload?new')}
              color="bg-blue-500"
              delay={0.8}
            />
            <QuickAction
              icon={FolderOpenIcon}
              label={t('home.dashboard.actions.viewLibrary')}
              description={t('home.dashboard.actions.viewLibraryDesc')}
              onClick={() => navigate('/resumes')}
              color="bg-purple-500"
              delay={0.9}
            />
            <QuickAction
              icon={PlusCircleIcon}
              label={t('home.dashboard.actions.createMission')}
              description={t('home.dashboard.actions.createMissionDesc')}
              onClick={() => navigate('/missions')}
              color="bg-orange-500"
              delay={1.0}
            />
            <QuickAction
              icon={DocumentDuplicateIcon}
              label={t('home.dashboard.actions.viewAdaptations')}
              description={t('home.dashboard.actions.viewAdaptationsDesc')}
              onClick={() => navigate('/adaptations')}
              color="bg-green-500"
              delay={1.1}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default HomeDashboard;
