/**
 * FactsPage - Market Radar Facts Display
 * Admin-only page for viewing and collecting market data
 * Features: France Map visualization + Data tables
 */

import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/page/PageHeader';
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
        <PageHeader title={t('marketRadar.title')} subtitle={t('marketRadar.subtitle')} />

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
