import {
  ArrowPathIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import type { MarketTrend, TrendFilters, TrendsSummary } from '../../services/marketRadarService';
import Pagination from '../Pagination';
import TrendCard from './TrendCard';
import { TREND_TYPE_ICONS, TREND_TYPE_LABELS, type TrendType } from './marketTrends.types';
import { parseMetadata } from './parseMetadata';
import { MARKET_TRENDS_PAGE_SIZE } from './useMarketTrendsDashboard';

export function MarketCollectionOverlay({ collecting, collectingSuccess }: { collecting: boolean; collectingSuccess: boolean }) {
  const { t } = useTranslation();

  if (!collecting) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {collectingSuccess ? (
          <>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('marketRadar.collection.launched', 'Collecte lancee !')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('marketRadar.collection.redirecting', 'Redirection vers les jobs...')}
            </p>
          </>
        ) : (
          <>
            <ArrowPathIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('marketRadar.collection.starting', 'Lancement de la collecte...')}
            </h3>
          </>
        )}
      </div>
    </div>
  );
}

export function MarketTrendsHeader({
  error,
  loading,
  onCollect,
  onCollectDynamics,
  onRefresh,
}: {
  error: string | null;
  loading: boolean;
  onCollect: () => void;
  onCollectDynamics: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('marketRadar.trends.title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('marketRadar.trends.refresh')}
            aria-label={t('marketRadar.trends.refresh')}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={onCollect} className="btn btn-primary inline-flex items-center px-4 py-2 text-sm">
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            {t('marketRadar.trends.collection.button')}
          </button>

          <button
            onClick={onCollectDynamics}
            className="inline-flex items-center px-4 py-2 border border-orange-500 rounded-md shadow-sm text-sm font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            title={t('marketRadar.trends.collectDynamics.title')}
          >
            <SparklesIcon className="h-4 w-4 mr-2" />
            {t('marketRadar.trends.collectDynamics.button')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
            <p className="ml-2 text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketTrendsSummaryCards({
  summary,
  typeFilter,
  onTypeFilterChange,
}: {
  summary: TrendsSummary | null;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
}) {
  if (!summary) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {summary.types.map((typeData) => {
        const { type, count, latestDate } = typeData;
        const aggregatedValue = typeData.aggregatedValue ?? 0;
        const isSumType = typeData.isSumType ?? ['embauche', 'demandeur', 'demandeur_entrant', 'offre'].includes(type);
        const valueCount = typeData.valueCount ?? 0;
        const Icon = TREND_TYPE_ICONS[type] || ChartBarIcon;
        const isPressed = typeFilter === type;
        const isSelected = isPressed || typeFilter === '';

        const formatAggregatedValue = () => {
          if (valueCount === 0) return '-';
          if (type === 'salaire') return `${Math.round(aggregatedValue).toLocaleString('fr-FR')} EUR`;
          if (type === 'tension' || type === 'dynamique_emploi') return aggregatedValue.toFixed(2);
          return Math.round(aggregatedValue).toLocaleString('fr-FR');
        };

        return (
          <button
            type="button"
            key={type}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 cursor-pointer transition-colors ${
              isSelected
                ? 'border-2 border-indigo-500 dark:border-indigo-400'
                : 'border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
            aria-pressed={isPressed}
            aria-label={`${TREND_TYPE_LABELS[type] || type} (${count})`}
            onClick={() => onTypeFilterChange(typeFilter === type ? '' : (type as TrendType))}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-5 w-5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{TREND_TYPE_LABELS[type] || type}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</div>
            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-1">
              {isSumType ? 'Total' : 'Moyenne'}: {formatAggregatedValue()}
            </div>
            {latestDate && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Derniere collecte: {latestDate}</div>}
          </button>
        );
      })}
    </div>
  );
}

export function MarketTrendsFiltersPanel({
  filters,
  filtersLoading,
  regionFilter,
  romeFilter,
  romeLabelsMap,
  typeFilter,
  onRegionFilterChange,
  onReset,
  onRomeFilterChange,
  onTypeFilterChange,
}: {
  filters: TrendFilters | null;
  filtersLoading: boolean;
  regionFilter: string;
  romeFilter: string;
  romeLabelsMap: Record<string, string>;
  typeFilter: string;
  onRegionFilterChange: (value: string) => void;
  onReset: () => void;
  onRomeFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
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
              <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm">
                <option value="">{t('marketRadar.trends.filters.allTypes')}</option>
                {(filters?.types || []).map((type) => (
                  <option key={type} value={type}>{TREND_TYPE_LABELS[type] || type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Region {filters?.regions?.length ? `(${filters.regions.length})` : ''}
              </label>
              <select value={regionFilter} onChange={(event) => onRegionFilterChange(event.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm">
                <option value="">{t('marketRadar.trends.filters.allRegions')}</option>
                {(filters?.regions || []).map((region) => (
                  <option key={region.code} value={region.code}>{region.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Metier {filters?.romeCodes?.length ? `(${filters.romeCodes.length})` : ''}
              </label>
              <select value={romeFilter} onChange={(event) => onRomeFilterChange(event.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm">
                <option value="">{t('marketRadar.facts.filters.allMetiers')}</option>
                {(filters?.romeCodes || []).map((code) => (
                  <option key={code} value={code}>{romeLabelsMap[code] || code}</option>
                ))}
              </select>
            </div>
          </div>

          {(typeFilter || regionFilter || romeFilter) && (
            <div className="flex justify-end">
              <button onClick={onReset} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                {t('common.resetFilters')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MarketTrendsResults({
  countsByType,
  currentPage,
  isGrouped,
  loading,
  summary,
  totalCount,
  totalPages,
  trendsByType,
  romeLabelsMap,
  onPageChange,
}: {
  countsByType: Record<string, number>;
  currentPage: number;
  isGrouped: boolean;
  loading: boolean;
  summary: TrendsSummary | null;
  totalCount: number;
  totalPages: number;
  trendsByType: Record<string, MarketTrend[]>;
  romeLabelsMap: Record<string, string>;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();

  if (Object.keys(trendsByType).length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <ChartBarIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('marketRadar.trends.noData')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('marketRadar.facts.collection.startCollection')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isGrouped && (
        <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={MARKET_TRENDS_PAGE_SIZE} onPageChange={onPageChange} loading={loading} itemName={t('marketRadar.trends.results')} />
      )}

      {Object.entries(trendsByType).map(([type, typeTrends]) => {
        const Icon = TREND_TYPE_ICONS[type] || ChartBarIcon;
        const typeTotal = countsByType[type] || summary?.types?.find((item) => item.type === type)?.count || typeTrends.length;
        return (
          <div key={type} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {TREND_TYPE_LABELS[type] || type}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({typeTrends.length} affiches / {typeTotal} total)</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {typeTrends.map((trend) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    type={type}
                    parsed={parseMetadata(trend.Metadata || null, type, trend.Value)}
                    romeLabel={trend.CodeRome ? romeLabelsMap[trend.CodeRome] : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {!isGrouped && (
        <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={MARKET_TRENDS_PAGE_SIZE} onPageChange={onPageChange} loading={loading} itemName={t('marketRadar.trends.results')} />
      )}
    </div>
  );
}
