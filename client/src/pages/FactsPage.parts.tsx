import { ArrowPathIcon, BriefcaseIcon, CalendarIcon, ChartBarIcon, ClockIcon, ExclamationTriangleIcon, FunnelIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import Pagination from '../components/Pagination';
import type { MarketFact } from '../services/marketRadarService';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import type { FactsStats } from './FactsPage.hooks';

export const FactsStatsCards = ({ stats }: { stats: FactsStats }) => {
  const { t } = useTranslation();

  return (
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
  );
};

export const FactsTable = ({
  facts,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  loading,
  onPageChange,
  romeLabelsMap,
}: {
  facts: MarketFact[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  romeLabelsMap: Record<string, string>;
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('marketRadar.facts.results')}
      />

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
              {facts.map((fact, index) => (
                <tr key={fact.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <CalendarIcon className="h-4 w-4 inline mr-1" />
                    {fact.Date ? formatDate(fact.Date, 'short') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {fact.Source === 'france_travail' ? 'France Travail' : 'Adzuna'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <span title={fact.Keyword || ''}>{romeLabelsMap[fact.Keyword || ''] || fact.Keyword || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <MapPinIcon className="h-4 w-4 inline mr-1 text-gray-400 dark:text-gray-500" />
                    {fact.Region || fact.Location || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-indigo-600 dark:text-indigo-400">
                    {fact.JobCount?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          loading={loading}
          itemName={t('marketRadar.facts.results')}
        />
      </div>
    </div>
  );
};

export const FactsAdminCollectionPanel = ({
  collecting,
  error,
  onCollect,
}: {
  collecting: boolean;
  error: string | null;
  onCollect: (source: 'france_travail' | 'adzuna') => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {t('marketRadar.facts.collection.title')}
      </h2>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => onCollect('france_travail')}
          disabled={collecting}
          className={`btn btn-primary inline-flex items-center px-4 py-2 text-sm ${collecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${collecting ? 'animate-spin' : ''}`} />
          {t('marketRadar.facts.collection.collectFranceTravail')}
        </button>
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
};

export const FactsFiltersPanel = ({
  sourceFilter,
  setSourceFilter,
  keywordFilter,
  setKeywordFilter,
  regionFilter,
  setRegionFilter,
  uniqueKeywords,
  uniqueRegions,
  romeLabelsMap,
  onClearFilters,
}: {
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  keywordFilter: string;
  setKeywordFilter: (value: string) => void;
  regionFilter: string;
  setRegionFilter: (value: string) => void;
  uniqueKeywords: string[];
  uniqueRegions: string[];
  romeLabelsMap: Record<string, string>;
  onClearFilters: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <FunnelIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('resumes.filterButton')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('marketRadar.facts.filters.source')}
          </label>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            <option value="">{t('marketRadar.facts.filters.allSources')}</option>
            <option value="france_travail">France Travail</option>
            <option value="adzuna">Adzuna</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('marketRadar.facts.filters.keyword')}
          </label>
          <select
            value={keywordFilter}
            onChange={(event) => setKeywordFilter(event.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            <option value="">{t('marketRadar.facts.filters.allMetiers')}</option>
            {uniqueKeywords.map((keyword) => (
              <option key={keyword} value={keyword}>
                {romeLabelsMap[keyword] || keyword}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('marketRadar.facts.filters.region')}
          </label>
          <select
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            <option value="">{t('marketRadar.trends.filters.allRegions')}</option>
            {uniqueRegions.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>

      {(keywordFilter || regionFilter) && (
        <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filtres actifs:</span>
          {keywordFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
              {romeLabelsMap[keywordFilter] || keywordFilter}
              <button onClick={() => setKeywordFilter('')} className="hover:text-indigo-600">x</button>
            </span>
          )}
          {regionFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              {regionFilter}
              <button onClick={() => setRegionFilter('')} className="hover:text-purple-600">x</button>
            </span>
          )}
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.resetFilters')}
          </button>
        </div>
      )}
    </div>
  );
};

export const FactsEmptyState = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
      <ChartBarIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        {t('marketRadar.facts.collection.noData')}
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        {t('marketRadar.facts.collection.noDataDescription')}
      </p>
    </div>
  );
};

export const FactsLastUpdatedFooter = () => (
  <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
    <ClockIcon className="h-4 w-4 inline mr-1" />
    Derniere mise a jour: {formatDateTime(new Date())}
  </div>
);
