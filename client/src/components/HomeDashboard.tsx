/**
 * HomeDashboard Component
 * Dashboard with KPIs and quick actions for the homepage
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../utils/apiInterceptor';
import { createLogger } from '../utils/logger.frontend';
import {
  HomeDashboardHeader,
  HomeDashboardKpiGrid,
  HomeDashboardLoading,
  HomeDashboardQuickActions,
  HomeDashboardSecondaryStats,
} from './HomeDashboard.sections';
import type { DashboardStats } from './HomeDashboard.types';
import {
  buildKpiCards,
  buildQuickActions,
  buildSecondaryStatCards,
  getFirmLabel,
} from './HomeDashboard.utils';

const log = createLogger('HomeDashboard');

function HomeDashboard(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
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

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return <HomeDashboardLoading />;
  }

  if (error || !stats) {
    return null;
  }

  const firmLabel = getFirmLabel(user);
  const kpiCards = buildKpiCards(stats, t);
  const secondaryStatCards = buildSecondaryStatCards(stats, t);
  const quickActions = buildQuickActions(t);

  return (
    <section className="py-12 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <HomeDashboardHeader title={t('home.dashboard.title')} firmLabel={firmLabel} />
        <HomeDashboardKpiGrid cards={kpiCards} onNavigate={navigate} />
        <HomeDashboardSecondaryStats cards={secondaryStatCards} />
        <HomeDashboardQuickActions
          title={t('home.dashboard.quickActions')}
          actions={quickActions}
          onNavigate={navigate}
        />
      </div>
    </section>
  );
}

export default HomeDashboard;
