/**
 * FactsPage - Market Radar Facts Display
 * Admin-only page for viewing and collecting market data
 * Features: France Map visualization + Data tables
 */

import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { FactsCollectionOverlay, FactsDataTab, FactsTabs, TabLoader } from './FactsPage.components';
import { type TabType, useFactsDashboard } from './FactsPage.hooks';

const FranceMapTab = lazy(() => import('../components/market/FranceMapTab'));
const MarketTrendsTab = lazy(() => import('../components/market/MarketTrendsTab'));
const MetiersTab = lazy(() => import('../components/market/MetiersTab'));

export default function FactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const factsDashboard = useFactsDashboard({ navigate });

  return (
    <>
      <FactsCollectionOverlay
        collecting={factsDashboard.collecting}
        collectingSuccess={factsDashboard.collectingSuccess}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-8 rounded-full bg-primary-500" />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t('marketRadar.title')}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{t('marketRadar.subtitle')}</p>
        </div>

        <FactsTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'map' && (
          <Suspense fallback={<TabLoader />}>
            <FranceMapTab />
          </Suspense>
        )}

        {activeTab === 'trends' && (
          <Suspense fallback={<TabLoader />}>
            <MarketTrendsTab />
          </Suspense>
        )}

        {activeTab === 'data' && (
          <FactsDataTab
            facts={factsDashboard.facts}
            loading={factsDashboard.loading}
            error={factsDashboard.error}
            collecting={factsDashboard.collecting}
            isAdmin={isAdmin}
            sourceFilter={factsDashboard.sourceFilter}
            setSourceFilter={factsDashboard.setSourceFilter}
            keywordFilter={factsDashboard.keywordFilter}
            setKeywordFilter={factsDashboard.setKeywordFilter}
            regionFilter={factsDashboard.regionFilter}
            setRegionFilter={factsDashboard.setRegionFilter}
            uniqueKeywords={factsDashboard.uniqueKeywords}
            uniqueRegions={factsDashboard.uniqueRegions}
            romeLabelsMap={factsDashboard.romeLabelsMap}
            stats={factsDashboard.stats}
            currentPage={factsDashboard.currentPage}
            totalPages={factsDashboard.totalPages}
            totalCount={factsDashboard.totalCount}
            pageSize={factsDashboard.pageSize}
            setCurrentPage={factsDashboard.setCurrentPage}
            onCollect={factsDashboard.handleCollect}
            onClearFilters={factsDashboard.clearFilters}
          />
        )}

        {activeTab === 'metiers' && (
          <Suspense fallback={<TabLoader />}>
            <MetiersTab />
          </Suspense>
        )}
      </div>
    </>
  );
}
