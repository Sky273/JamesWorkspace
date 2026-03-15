/**
 * RegionDetailPanel - Side panel showing region details and métier breakdown
 * Extracted from FranceMapTab.tsx
 */

import { MapPinIcon, BriefcaseIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { MarketTrend } from '../../services/marketRadarService';
import TrendMetadataDisplay, { parseMetadata } from './TrendMetadataDisplay';
import type { RegionData, TrendRegionData, DataSourceType } from './franceMap.types';

interface RegionDetailPanelProps {
  selectedRegion: RegionData | TrendRegionData;
  dataSource: DataSourceType;
  trends: MarketTrend[];
  jobRegionDataFull: RegionData[];
  selectedMetier: string | null;
  selectedTrendMetadata: MarketTrend | null;
  metadataLoading: boolean;
  metierFilter: string;
  romeLabelsMap: Record<string, string>;
  onClose: () => void;
  onMetierFilterChange: (value: string) => void;
  onMetierSelect: (trendId: string, rome: string) => void;
  onResetFilters: () => void;
  formatValue: (value: number | string | undefined | null) => string;
  getValueLabel: () => string;
}

export default function RegionDetailPanel({
  selectedRegion,
  dataSource,
  trends,
  jobRegionDataFull,
  selectedMetier,
  selectedTrendMetadata,
  metadataLoading,
  metierFilter,
  romeLabelsMap,
  onClose,
  onMetierFilterChange,
  onMetierSelect,
  onResetFilters,
  formatValue,
  getValueLabel
}: RegionDetailPanelProps) {
  const { t } = useTranslation();

  // Helper to get métier label from code
  const getMetierLabel = (codeRome: string, romeLabel?: string): string => {
    if (romeLabel) return romeLabel;
    return romeLabelsMap[codeRome] || codeRome;
  };

  return (
    <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto max-h-[600px]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MapPinIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          {selectedRegion.name}
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-4 p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
        <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
          {formatValue(selectedRegion.value)}
        </div>
        <div className="text-sm text-indigo-700 dark:text-indigo-300">{getValueLabel()}</div>
      </div>

      {/* Only show métier breakdown if there is data */}
      {Object.keys(selectedRegion.romeBreakdown).length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <BriefcaseIcon className="h-4 w-4" />
              {t('marketRadar.map.metierBreakdown')}
            </h5>
            {(selectedMetier || metierFilter) && (
              <button
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.resetFilters')}
              </button>
            )}
          </div>

          {/* Métier filter */}
          <div className="mb-3">
            <input
              type="text"
              placeholder={t('marketRadar.map.searchMetier')}
              value={metierFilter}
              onChange={(e) => onMetierFilterChange(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dataSource === 'offres' && 'totalJobs' in selectedRegion ? (
              // Job offers breakdown - now with metadata support via trends
              // Use jobRegionDataFull to always show all métiers (not filtered by selectedMetier)
              (() => {
                // Get the offre trends for this region to access metadata
                const offreTrendsForRegion = trends.filter(t => 
                  t.Type === 'offre' && t.RegionCode === selectedRegion.code
                );
                // Create a map of rome code to trend for quick lookup
                const trendByRome: Record<string, MarketTrend> = {};
                offreTrendsForRegion.forEach(t => {
                  if (t.CodeRome && !trendByRome[t.CodeRome]) {
                    trendByRome[t.CodeRome] = t;
                  }
                });

                // Use full data (not filtered by selectedMetier) for the breakdown list
                const fullRegionData = jobRegionDataFull.find(r => r.code === selectedRegion.code);
                const romeBreakdown = fullRegionData?.romeBreakdown || {};

                return Object.entries(romeBreakdown)
                  .filter(([rome]) => {
                    if (!metierFilter) return true;
                    const label = getMetierLabel(rome, trendByRome[rome]?.RomeLabel);
                    return label.toLowerCase().includes(metierFilter.toLowerCase()) || 
                           rome.toLowerCase().includes(metierFilter.toLowerCase());
                  })
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([rome, count]) => {
                    const trend = trendByRome[rome];
                    const metierLabel = getMetierLabel(rome, trend?.RomeLabel);
                    return (
                      <div key={rome} className="relative group">
                        <button
                          onClick={() => trend ? onMetierSelect(trend.id, rome) : onMetierSelect('', rome)}
                          className={`w-full flex items-center justify-between rounded p-2 text-sm transition-colors ${
                            selectedMetier === rome 
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-600' 
                              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className={`truncate flex-1 mr-2 text-left ${
                            selectedMetier === rome 
                              ? 'text-indigo-700 dark:text-indigo-300 font-medium' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`} title={metierLabel}>
                            {metierLabel}
                          </span>
                          <span className={`font-semibold whitespace-nowrap ${
                            selectedMetier === rome 
                              ? 'text-indigo-700 dark:text-indigo-300' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {(count as number).toLocaleString()}
                          </span>
                        </button>
                      </div>
                    );
                  });
              })()
            ) : (
              // Trend breakdown - filter trends directly by Type and RegionCode
              // Deduplicate by CodeRome, keeping only the first (most recent) entry
              (() => {
                // Filter by Type AND RegionCode
                const filteredTrends = trends.filter(t => 
                  t.Type === dataSource && 
                  t.RegionCode === selectedRegion.code
                );
                
                // Deduplicate by CodeRome - use object to keep only one entry per métier
                const uniqueByRome: Record<string, MarketTrend> = {};
                filteredTrends.forEach(t => {
                  const key = t.CodeRome || t.id;
                  // Keep the first one (most recent if sorted by date desc)
                  if (!uniqueByRome[key]) {
                    uniqueByRome[key] = t;
                  }
                });

                return Object.values(uniqueByRome)
                  .filter(t => {
                    if (!metierFilter) return true;
                    const label = t.RomeLabel || t.CodeRome || '';
                    return label.toLowerCase().includes(metierFilter.toLowerCase()) || 
                           (t.CodeRome || '').toLowerCase().includes(metierFilter.toLowerCase());
                  })
                  .sort((a, b) => (b.Value || 0) - (a.Value || 0))
                  .map(trend => {
                    const metierLabel = trend.RomeLabel || trend.CodeRome || 'Inconnu';
                    const rome = trend.CodeRome || trend.id;
                    
                    // Use metadata value when available for selected métier
                    let displayValue = trend.Value || 0;
                    if (selectedMetier === rome && selectedTrendMetadata?.Metadata) {
                      const parsed = parseMetadata(selectedTrendMetadata.Metadata, selectedTrendMetadata.Type, selectedTrendMetadata.Value);
                      if (parsed?.valeurPrincipale !== undefined) {
                        displayValue = parsed.valeurPrincipale;
                      }
                    }
                    
                    return (
                      <button
                        key={trend.id}
                        onClick={() => onMetierSelect(trend.id, rome)}
                        className={`w-full flex items-center justify-between rounded p-2 text-sm transition-colors ${
                          selectedMetier === rome 
                            ? 'bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-600' 
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className={`truncate flex-1 mr-2 text-left ${
                          selectedMetier === rome 
                            ? 'text-indigo-700 dark:text-indigo-300 font-medium' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`} title={metierLabel}>
                          {metierLabel}
                        </span>
                        <span className={`font-semibold whitespace-nowrap ${
                          selectedMetier === rome 
                            ? 'text-indigo-700 dark:text-indigo-300' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {formatValue(displayValue)}
                        </span>
                      </button>
                    );
                  });
              })()
            )}
          </div>
          
          {/* Metadata details panel - shown when a métier is selected AND metadata is available or loading */}
          {selectedMetier && (metadataLoading || selectedTrendMetadata) && (
            <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
              {/* Métier name header */}
              <div className="mb-3 pb-2 border-b border-indigo-200 dark:border-indigo-600">
                <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">
                  Métier sélectionné
                </div>
                <div className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                  {selectedTrendMetadata?.RomeLabel || romeLabelsMap[selectedMetier] || selectedMetier}
                </div>
                {selectedMetier && selectedMetier !== (selectedTrendMetadata?.RomeLabel || romeLabelsMap[selectedMetier]) && (
                  <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                    {selectedMetier}
                  </div>
                )}
              </div>
              
              {metadataLoading ? (
                <div className="flex items-center justify-center py-2">
                  <ArrowPathIcon className="h-4 w-4 animate-spin text-indigo-500" />
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Chargement des détails...</span>
                </div>
              ) : (
                <TrendMetadataDisplay
                  metadata={selectedTrendMetadata?.Metadata || null}
                  type={selectedTrendMetadata?.Type || dataSource}
                  value={selectedTrendMetadata?.Value}
                  compact={true}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
