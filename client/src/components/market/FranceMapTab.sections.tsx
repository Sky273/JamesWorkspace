import { ArrowPathIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { DataSourceType } from './franceMap.types';
import { DATA_SOURCE_OPTIONS } from './franceMap.types';
import { getFranceFreshnessLabels } from './FranceMapTab.utils';

export function FranceMapControls({
  dataSource,
  loading,
  onRefresh,
  onSourceChange,
  t,
}: {
  dataSource: DataSourceType;
  loading: boolean;
  onRefresh: () => void;
  onSourceChange: (value: DataSourceType) => void;
  t: TFunction;
}): JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.map.selectDataType')}</label>
          <select
            value={dataSource}
            onChange={(event) => onSourceChange(event.target.value as DataSourceType)}
            className="w-full md:w-64 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            {DATA_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{t(`marketRadar.dataTypes.${option.value}`)}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
          title={t('marketRadar.map.refresh')}
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

export function FranceMapStatsCards({
  statsCards,
}: {
  statsCards: Array<{ color: string; label: string; value: string }>;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statsCards.map((card) => (
        <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className={`text-2xl font-bold ${card.color}`} title={card.value}>{card.value}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

export function FranceMapFreshnessBanner({
  dataFreshness,
  t,
}: {
  dataFreshness: {
    newestDate: Date;
    quarterPeriod?: string | null;
    status: 'fresh' | 'recent' | 'stale';
    totalRecords: number;
  };
  t: TFunction;
}): JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            dataFreshness.status === 'fresh'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : dataFreshness.status === 'recent'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${
              dataFreshness.status === 'fresh' ? 'bg-green-500' : dataFreshness.status === 'recent' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></span>
            {getFranceFreshnessLabels(dataFreshness.status, t)}
          </span>
          {dataFreshness.quarterPeriod && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('marketRadar.freshness.period', 'Periode')}: <strong>{dataFreshness.quarterPeriod}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>{t('marketRadar.freshness.collectedAt', 'Collecte le')}: {dataFreshness.newestDate.toLocaleDateString('fr-FR')}</span>
          <span>{t('marketRadar.freshness.records', 'Enregistrements')}: {dataFreshness.totalRecords.toLocaleString()}</span>
          <span className="text-gray-400 dark:text-gray-500">Source: France Travail API</span>
        </div>
      </div>
    </div>
  );
}

export function FranceMapNoDataState({
  className,
  dataSource,
  onSourceChange,
  t,
}: {
  className: string;
  dataSource: DataSourceType;
  onSourceChange: (value: DataSourceType) => void;
  t: TFunction;
}): JSX.Element {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type de donnees</label>
        <select
          value={dataSource}
          onChange={(event) => onSourceChange(event.target.value as DataSourceType)}
          className="w-full md:w-64 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
        >
          {DATA_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <MapPinIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('marketRadar.map.noData')}</h3>
        <p className="text-gray-500 dark:text-gray-400">
          {dataSource === 'offres' ? t('marketRadar.map.noDataOffres') : t('marketRadar.map.noDataTrends')}
        </p>
      </div>
    </div>
  );
}

export function FranceMapLegend({
  dataSource,
  getRegionColor,
  maxValue,
  onSourceChange,
  t,
}: {
  dataSource: DataSourceType;
  getRegionColor: (value: number) => string;
  maxValue: number;
  onSourceChange: (value: DataSourceType) => void;
  t: TFunction;
}): JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.map.legend')}</h4>
      {dataSource === 'all' ? (
        <div className="flex items-center gap-4 flex-wrap">
          {DATA_SOURCE_OPTIONS.filter((option) => option.value !== 'all' && option.value !== 'salaire').map((option) => {
            const colorHues: Record<string, number> = { indigo: 220, red: 0, blue: 210, teal: 175, purple: 270, violet: 280 };
            const hue = colorHues[option.color] || 220;
            return (
              <button key={option.value} onClick={() => onSourceChange(option.value)} className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }} />
                <span className="text-xs text-gray-600 dark:text-gray-400">{t(`marketRadar.dataTypes.${option.value}`)}</span>
              </button>
            );
          })}
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{t('marketRadar.map.clickToFilter')}</div>
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getRegionColor(maxValue * 0.1) }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('marketRadar.map.low')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getRegionColor(maxValue * 0.5) }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('marketRadar.map.medium')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getRegionColor(maxValue) }}></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('marketRadar.map.high')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
