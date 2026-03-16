/**
 * MarketTrendsTab - Market Trends Analysis for Market Radar
 * Displays labor market trends from France Travail Marché du Travail API
 * - Hiring data by job type and sector
 * - Employment dynamics indicator
 * - Recruitment difficulties
 * - Proposed salaries by job
 * - AI dynamism indicator
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import Pagination from '../Pagination';
import {
  getTrends,
  getTrendsSummary,
  getTrendFilters,
  triggerTrendsCollection,
  triggerDynamicsCollection,
  MarketTrend,
  TrendsSummary,
  TrendFilters
} from '../../services/marketRadarService';
import { getStoredMetiers, Metier } from '../../services/romeService';
import { TREND_TYPE_LABELS, TREND_TYPE_ICONS, type TrendType } from './marketTrends.types';
import { parseMetadata } from './parseMetadata';
import TrendCard from './TrendCard';

export default function MarketTrendsTab({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [groupedTrends, setGroupedTrends] = useState<Record<string, MarketTrend[]> | null>(null);
  const [countsByType, setCountsByType] = useState<Record<string, number>>({});
  const [isGrouped, setIsGrouped] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<TrendFilters | null>(null);
  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [_collecting, _setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_collectionResult, _setCollectionResult] = useState<{ stored: number; created: number; updated: number; duration: number } | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  
  // Server-side filters - empty means all types
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [romeFilter, setRomeFilter] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // Load filters and metiers on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setFiltersLoading(true);
      try {
        // Load filters first
        const filtersResponse = await getTrendFilters();
        if (filtersResponse.filters) {
          setFilters(filtersResponse.filters);
        }
        
        // Then load summary and metiers in parallel
        const [summaryResponse, metiersData] = await Promise.all([
          getTrendsSummary(),
          getStoredMetiers()
        ]);
        setSummary(summaryResponse.summary);
        setMetiers(metiersData);
      } catch (_err) {
        // Set empty filters as fallback
        setFilters({ types: [], regions: [], romeCodes: [] });
      } finally {
        setFiltersLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Load trends when filters or page change (wait for initial filters to load)
  useEffect(() => {
    // Don't load trends until filters are loaded to avoid race conditions
    if (filtersLoading) return;
    
    const loadTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getTrends({
          type: typeFilter || undefined,
          codeRome: romeFilter || undefined,
          regionCode: regionFilter || undefined,
          page: currentPage,
          pageSize
        });
        
        if (response.grouped) {
          // Grouped response (no type filter)
          setIsGrouped(true);
          setGroupedTrends(response.groupedTrends || {});
          setCountsByType(response.countsByType || {});
          setTrends([]);
          setTotalPages(1); // No pagination for grouped view
        } else {
          // Paginated response (with type filter)
          setIsGrouped(false);
          setGroupedTrends(null);
          setCountsByType({});
          setTrends(response.trends || []);
          if (response.pagination) {
            setTotalPages(response.pagination.totalPages);
          }
        }
        setTotalCount(response.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadTrends();
  }, [filtersLoading, typeFilter, regionFilter, romeFilter, currentPage, t]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, regionFilter, romeFilter]);

  // Create ROME labels map
  const romeLabelsMap = useMemo(() => {
    return metiers.reduce((acc, m) => {
      acc[m.CodeRome] = m.Libelle;
      return acc;
    }, {} as Record<string, string>);
  }, [metiers]);

  // Group trends by type for display
  // Use backend-grouped data when available, otherwise group locally
  const trendsByType = useMemo(() => {
    if (isGrouped && groupedTrends) {
      return groupedTrends;
    }
    // Fallback: group locally for paginated response
    const grouped: Record<string, MarketTrend[]> = {};
    trends.forEach(t => {
      if (!grouped[t.Type]) grouped[t.Type] = [];
      grouped[t.Type].push(t);
    });
    return grouped;
  }, [isGrouped, groupedTrends, trends]);

  // Handle collection (fire-and-forget)
  const handleCollect = async () => {
    setError(null);
    try {
      const result = await triggerTrendsCollection();
      toast.success(
        t('marketRadar.trends.collection.started') || 
        `Collecte lancée en arrière-plan. Durée estimée : ${result.estimatedDuration}`,
        { duration: 5000 }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de lancement de la collecte';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // TEMPORARY: Handle DYN_1 dynamics collection only
  const handleCollectDynamics = async () => {
    setError(null);
    try {
      const result = await triggerDynamicsCollection();
      toast.success(
        `Collecte DYN_1 (dynamique emploi) lancée. Durée estimée : ${result.estimatedDuration}`,
        { duration: 5000 }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de lancement de la collecte DYN_1';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (loading && trends.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('marketRadar.trends.loading')}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh and collect buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('marketRadar.trends.title')}
          </h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const [trendsResponse, summaryResponse, filtersResponse] = await Promise.all([
                    getTrends({ type: typeFilter || undefined, codeRome: romeFilter || undefined, regionCode: regionFilter || undefined, page: currentPage, pageSize }),
                    getTrendsSummary(),
                    getTrendFilters()
                  ]);
                  setTrends(trendsResponse.trends || []);
                  setTotalCount(trendsResponse.totalCount);
                  if (trendsResponse.pagination) {
                    setTotalPages(trendsResponse.pagination.totalPages);
                  }
                  setSummary(summaryResponse.summary);
                  setFilters(filtersResponse.filters);
                } catch (err) {
                  setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('marketRadar.trends.refresh')}
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleCollect}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              {t('marketRadar.trends.collection.button')}
            </button>
            
            {/* TEMPORARY: DYN_1 only collection button */}
            <button
              onClick={handleCollectDynamics}
              className="inline-flex items-center px-4 py-2 border border-orange-500 rounded-md shadow-sm text-sm font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              title="TEMPORAIRE: Collecte uniquement DYN_1 (dynamique emploi)"
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              DYN_1 Only
            </button>
          </div>
        </div>

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

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {summary.types.map((typeData) => {
            const { type, count, latestDate } = typeData;
            // Get aggregatedValue, isSumType, and valueCount with defaults
            const aggregatedValue = typeData.aggregatedValue ?? 0;
            const isSumType = typeData.isSumType ?? ['embauche', 'demandeur', 'demandeur_entrant', 'offre'].includes(type);
            const valueCount = typeData.valueCount ?? 0;  // Records with valid (non-null) values
            
            const Icon = TREND_TYPE_ICONS[type] || ChartBarIcon;
            // Card is "selected" if: this type is filtered OR no filter is active (all types shown)
            const isSelected = typeFilter === type || typeFilter === '';
            
            // Only show aggregated value if there are records with valid values
            const hasValidValues = valueCount > 0;
            
            // Format aggregated value based on type
            const formatAggregatedValue = (): string => {
              if (!hasValidValues) return '-';
              const val = aggregatedValue ?? 0;
              if (type === 'salaire') {
                return `${Math.round(val).toLocaleString('fr-FR')} €`;
              }
              if (type === 'tension' || type === 'dynamique_emploi') {
                return val.toFixed(2);
              }
              // For sum types (embauche, demandeur, etc.)
              return Math.round(val).toLocaleString('fr-FR');
            };
            
            const aggregatedLabel = isSumType ? 'Total' : 'Moyenne';
            const formattedValue = formatAggregatedValue();
            
            return (
              <div
                key={type}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-2 border-indigo-500 dark:border-indigo-400' 
                    : 'border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
                onClick={() => setTypeFilter(typeFilter === type ? '' : type as TrendType)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {TREND_TYPE_LABELS[type] || type}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                  {aggregatedLabel}: {formattedValue}
                </div>
                {latestDate && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Dernière collecte: {latestDate}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        {filtersLoading ? (
          <div className="flex items-center justify-center py-4">
            <ArrowPathIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin mr-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type {filters?.types?.length ? `(${filters.types.length})` : ''}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">{t('marketRadar.trends.filters.allTypes')}</option>
                {(filters?.types || []).map(type => (
                  <option key={type} value={type}>{TREND_TYPE_LABELS[type] || type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Région {filters?.regions?.length ? `(${filters.regions.length})` : ''}
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">{t('marketRadar.trends.filters.allRegions')}</option>
                {(filters?.regions || []).map(r => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Métier {filters?.romeCodes?.length ? `(${filters.romeCodes.length})` : ''}
              </label>
              <select
                value={romeFilter}
                onChange={(e) => setRomeFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              >
                <option value="">{t('marketRadar.facts.filters.allMetiers')}</option>
                {(filters?.romeCodes || []).map(code => (
                  <option key={code} value={code}>{romeLabelsMap[code] || code}</option>
                ))}
              </select>
            </div>
          </div>
          {(typeFilter || regionFilter || romeFilter) && (
            <div className="flex justify-end">
              <button
                onClick={() => { setTypeFilter(''); setRegionFilter(''); setRomeFilter(''); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.resetFilters')}
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Trends Display */}
      {(trends.length === 0 && Object.keys(trendsByType).length === 0) ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ChartBarIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('marketRadar.trends.noData')}</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t('marketRadar.facts.collection.startCollection')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pagination - only show when filtered by type (not grouped) */}
          {!isGrouped && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              loading={loading}
              itemName={t('marketRadar.trends.results')}
            />
          )}

          {/* Display trends grouped by type with proper headers */}
          {Object.entries(trendsByType).map(([type, typeTrends]) => {
            const Icon = TREND_TYPE_ICONS[type] || ChartBarIcon;
            // Get total count for this type from countsByType (backend) or summary
            const typeTotal = countsByType[type] || summary?.types?.find(t => t.type === type)?.count || typeTrends.length;
            return (
              <div key={type} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    {TREND_TYPE_LABELS[type] || type}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({typeTrends.length} affichés / {typeTotal} total)
                    </span>
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {typeTrends.map((trend) => {
                      const parsed = parseMetadata(trend.Metadata || null, type, trend.Value);
                      return (
                        <TrendCard
                          key={trend.id}
                          trend={trend}
                          type={type}
                          parsed={parsed}
                          romeLabel={trend.CodeRome ? romeLabelsMap[trend.CodeRome] : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom Pagination - only show when filtered by type (not grouped) */}
          {!isGrouped && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              loading={loading}
              itemName={t('marketRadar.trends.results')}
            />
          )}
        </div>
      )}
    </div>
  );
}
