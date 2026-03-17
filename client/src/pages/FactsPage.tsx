/**
 * FactsPage - Market Radar Facts Display
 * Admin-only page for viewing and collecting market data
 * Features: France Map visualization + Data tables
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { createLogger } from '../utils/logger.frontend';

const log = createLogger('FactsPage');

import {
  ChartBarIcon,
  ArrowPathIcon,
  FunnelIcon,
  MapPinIcon,
  BriefcaseIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MapIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import {
  getFacts,
  getFactsSummary,
  triggerSourceCollection,
  MarketFact,
  CollectionSummary,
  FactsSummary
} from '../services/marketRadarService';
import { getStoredMetiers, Metier } from '../services/romeService';
import Pagination from '../components/Pagination';

// Lazy load heavy map component (1MB+ maplibre-gl)
const FranceMapTab = lazy(() => import('../components/market/FranceMapTab'));
const MarketTrendsTab = lazy(() => import('../components/market/MarketTrendsTab'));
const MetiersTab = lazy(() => import('../components/market/MetiersTab'));

// Loading spinner for lazy components
const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

// Tab type
type TabType = 'map' | 'data' | 'trends' | 'metiers';

export default function FactsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = ((user?.role || user?.Role || '') as string).toLowerCase() === 'admin';
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('map');
  
  // State
  const [facts, setFacts] = useState<MarketFact[]>([]);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionResult, setCollectionResult] = useState<CollectionSummary | null>(null);
  
  // Filters (simplified for PostgreSQL - source, region, keyword)
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');

  // Pagination (server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Unique regions for filter dropdown (loaded once)
  const [uniqueRegions, setUniqueRegions] = useState<string[]>([]);
  
  // Unique keywords/métiers for filter dropdown (loaded once)
  const [uniqueKeywords, setUniqueKeywords] = useState<string[]>([]);
  
  // Global stats
  const [globalStats, setGlobalStats] = useState<FactsSummary | null>(null);

  // Load metiers and global stats once on mount
  useEffect(() => {
    const loadMetiers = async () => {
      try {
        const metiersData = await getStoredMetiers();
        setMetiers(metiersData);
      } catch (err) {
        log.warn('Failed to load metiers', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    };
    loadMetiers();
  }, []);

  // Load global stats on mount
  useEffect(() => {
    const loadGlobalStats = async () => {
      try {
        const response = await getFactsSummary();
        if (response.success) {
          setGlobalStats(response.summary);
        }
      } catch (err) {
        log.warn('Failed to load global stats', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    };
    loadGlobalStats();
  }, []);

  // Load unique regions and keywords once (without pagination - get first page with large size)
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        // No date filter - get all facts to extract unique regions and keywords
        const response = await getFacts({ page: 1, pageSize: 1000 });
        const regions = [...new Set(response.facts.map(f => f.Region).filter(Boolean))].sort() as string[];
        const keywords = [...new Set(response.facts.map(f => f.Keyword).filter(Boolean))].sort() as string[];
        setUniqueRegions(regions);
        setUniqueKeywords(keywords);
      } catch (err) {
        log.warn('Failed to load filters data', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    };
    loadFiltersData();
  }, []);

  // Load facts with server-side filtering and pagination
  const loadFacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No date filter - get all facts with pagination
      const response = await getFacts({
        source: sourceFilter || undefined,
        keyword: keywordFilter || undefined,
        region: regionFilter || undefined,
        page: currentPage,
        pageSize
      });
      
      setFacts(response.facts);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.totalCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, keywordFilter, regionFilter, currentPage]);

  useEffect(() => {
    loadFacts();
  }, [loadFacts]);

  // Reset pagination when filters change (but not on initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [sourceFilter, keywordFilter, regionFilter]);

  // Reload global stats
  const reloadGlobalStats = async () => {
    try {
      const response = await getFactsSummary();
      if (response.success) {
        setGlobalStats(response.summary);
      }
    } catch (err) {
      log.warn('Failed to reload global stats', { error: err instanceof Error ? err.message : 'Unknown' });
    }
  };

  // Trigger collection
  const handleCollect = async (source: 'france_travail' | 'adzuna') => {
    setCollecting(true);
    setError(null);
    setCollectionResult(null);
    
    try {
      const result = await triggerSourceCollection(source);
      setCollectionResult(result);
      // Reload data and global stats after collection
      await Promise.all([loadFacts(), reloadGlobalStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collection failed');
    } finally {
      setCollecting(false);
    }
  };

  // Create a map of ROME codes to labels from loaded metiers
  const romeLabelsMap = metiers.reduce((acc, m) => {
    acc[m.CodeRome] = m.Libelle;
    return acc;
  }, {} as Record<string, string>);

  // Group facts by source for display (using server-paginated facts)
  const _groupedFacts = facts.reduce((acc, fact) => {
    const key = fact.Source || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(fact);
    return acc;
  }, {} as Record<string, MarketFact[]>);

  // Calculate stats from global stats (or fallback to page data)
  const stats = {
    total: globalStats?.totalRecords ?? totalCount,
    franceTravail: globalStats?.sources?.find(s => s.source === 'france_travail')?.count ?? facts.filter(f => f.Source === 'france_travail').length,
    adzuna: globalStats?.sources?.find(s => s.source === 'adzuna')?.count ?? facts.filter(f => f.Source === 'adzuna').length,
    totalJobs: globalStats?.totalJobs ?? facts.reduce((sum, f) => sum + (f.JobCount || 0), 0),
    uniqueRegions: globalStats?.totalRegions ?? new Set(facts.map(f => f.Region).filter(Boolean)).size,
    uniqueKeywords: globalStats?.totalKeywords ?? new Set(facts.map(f => f.Keyword).filter(Boolean)).size
  };

  return (
    <>
      {/* Full-screen overlay during collection */}
      {collecting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <ArrowPathIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('marketRadar.facts.collection.overlayTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('marketRadar.facts.collection.overlayDescription')}
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-4">
              {t('marketRadar.facts.collection.overlayWarning')}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse"></div>
              <span>{t('common.pleaseWait')}</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ChartBarIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          {t('marketRadar.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('marketRadar.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'map'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <MapIcon className="h-5 w-5" />
            {t('marketRadar.tabs.map')}
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'trends'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <ChartBarIcon className="h-5 w-5" />
            {t('marketRadar.tabs.trends')}
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'data'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <TableCellsIcon className="h-5 w-5" />
            {t('marketRadar.tabs.facts')}
          </button>
          <button
            onClick={() => setActiveTab('metiers')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'metiers'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <BriefcaseIcon className="h-5 w-5" />
            {t('marketRadar.tabs.metiers')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
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
        <>
          {/* Collection Controls - Admin only */}
          {isAdmin && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('marketRadar.facts.collection.title')}</h2>
              
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleCollect('france_travail')}
                  disabled={collecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {collecting ? (
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  {t('marketRadar.facts.collection.collectFranceTravail')}
                </button>
              </div>

              {/* Collection Result */}
              {collectionResult && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-300">{t('marketRadar.facts.collection.success')}</h3>
                      <div className="mt-2 text-sm text-green-700 dark:text-green-400">
                        <p>{t('marketRadar.facts.collection.factsCollected')}: <strong>{collectionResult.totalFacts}</strong></p>
                        <p>{t('marketRadar.facts.collection.stored')}: <strong>{collectionResult.stored}</strong></p>
                        {collectionResult.failed > 0 && (
                          <p className="text-orange-600">{t('marketRadar.facts.collection.failed')}: {collectionResult.failed}</p>
                        )}
                        <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                          {t('marketRadar.facts.collection.duration')}: {Math.round(collectionResult.duration / 1000)}s
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
                    <p className="ml-2 text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FunnelIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('resumes.filterButton')}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('marketRadar.facts.filters.source')}</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="">{t('marketRadar.facts.filters.allSources')}</option>
                  <option value="france_travail">France Travail</option>
                  <option value="adzuna">Adzuna</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('marketRadar.facts.filters.keyword')}</label>
                <select
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="">{t('marketRadar.facts.filters.allMetiers')}</option>
                  {uniqueKeywords.map(keyword => (
                    <option key={keyword} value={keyword}>
                      {romeLabelsMap[keyword] || keyword}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('marketRadar.facts.filters.region')}</label>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="">{t('marketRadar.trends.filters.allRegions')}</option>
                  {uniqueRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filters indicator */}
            {(keywordFilter || regionFilter) && (
              <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-gray-400">Filtres actifs:</span>
                {keywordFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                    {romeLabelsMap[keywordFilter] || keywordFilter}
                    <button onClick={() => setKeywordFilter('')} className="hover:text-indigo-600">×</button>
                  </span>
                )}
                {regionFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                    {regionFilter}
                    <button onClick={() => setRegionFilter('')} className="hover:text-purple-600">×</button>
                  </span>
                )}
                <button
                  onClick={() => { setKeywordFilter(''); setRegionFilter(''); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.resetFilters')}
                </button>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Facts total</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.franceTravail}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">France Travail</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.adzuna}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Adzuna</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalJobs.toLocaleString()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.facts.stats.totalJobs')}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.uniqueRegions}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.facts.stats.regions')}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.uniqueKeywords}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.facts.stats.keywords')}</div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">{t('common.loading')}</span>
            </div>
          )}

          {/* Facts Display */}
          {!loading && facts.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <ChartBarIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('marketRadar.facts.collection.noData')}</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {t('marketRadar.facts.collection.noDataDescription')}
              </p>
            </div>
          )}

          {!loading && facts.length > 0 && (
            <div className="space-y-6">
              {/* Top Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                loading={loading}
                itemName={t('marketRadar.facts.results')}
              />

              {/* All Facts Table */}
              {facts.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                      <BriefcaseIcon className="h-5 w-5" />
                      {t('marketRadar.facts.sections.allFacts')}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('marketRadar.facts.table.date')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('marketRadar.facts.table.source')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('marketRadar.facts.table.metier')}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('marketRadar.facts.table.region')}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('marketRadar.facts.table.offers')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {facts.map((fact, idx) => {
                          const formattedDate = fact.Date ? formatDate(fact.Date, 'short') : '-';
                          return (
                          <tr key={fact.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              <CalendarIcon className="h-4 w-4 inline mr-1" />
                              {formattedDate}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {fact.Source === 'france_travail' ? 'France Travail' : 'Adzuna'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              <span title={fact.Keyword || ''}>
                                {romeLabelsMap[fact.Keyword || ''] || fact.Keyword || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              <MapPinIcon className="h-4 w-4 inline mr-1 text-gray-400 dark:text-gray-500" />
                              {fact.Region || fact.Location || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-indigo-600 dark:text-indigo-400">
                              {fact.JobCount?.toLocaleString()}
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Controls */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    loading={loading}
                    itemName={t('marketRadar.facts.results')}
                  />
                </div>
              )}
            </div>
          )}

          {/* Footer info */}
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <ClockIcon className="h-4 w-4 inline mr-1" />
            Dernière mise à jour: {formatDateTime(new Date())}
          </div>
        </>
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
