/**
 * FranceMapTab - Interactive France Map for Market Radar
 * Displays regional job market data on a map of France using MapLibre
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, ChartBarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { Map as MaplibreMap } from 'maplibre-gl';

import {
  DATA_SOURCE_OPTIONS,
  setFrenchLabels,
  type DataSourceType,
  type RegionData,
  type TrendRegionData,
} from './franceMap.types';
import {
  FranceMapControls,
  FranceMapFreshnessBanner,
  FranceMapLegend,
  FranceMapNoDataState,
  FranceMapStatsCards,
} from './FranceMapTab.sections';
import {
  buildFranceMapStatsCards,
  formatFranceMapValue,
  getFranceMapValueLabel,
} from './FranceMapTab.utils';
import RegionDetailPanel from './RegionDetailPanel';
import { useFranceMapData, useTrendMetadata } from './useFranceMapData';
import { useRegionData } from './useRegionData';

const FranceMapCanvas = lazy(() => import('./FranceMapCanvas'));

export default function FranceMapTab({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const mapRef = useRef<MaplibreMap | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceType>('offres');
  const [selectedRegion, setSelectedRegion] = useState<RegionData | TrendRegionData | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [metierFilter, setMetierFilter] = useState('');
  const [selectedMetier, setSelectedMetier] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMapEnabled, setIsMapEnabled] = useState(false);

  const { trends, loading, error, romeLabelsMap, reload } = useFranceMapData(dataSource);
  const selectedRegionCode = selectedRegion?.code;
  const { selectedTrendMetadata, metadataLoading, loadTrendMetadata, resetMetadata } = useTrendMetadata({
    dataSource,
    selectedMetier,
    selectedRegionCode,
    trends,
  });

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedRegion(null);
    setSelectedMetier(null);
    setMetierFilter('');
    resetMetadata();
  }, [dataSource, resetMetadata]);

  const {
    jobRegionDataFull,
    multiTypeRegionData,
    currentRegionData,
    maxValue,
    totalValue,
    topRegion,
    uniqueMetiersCount,
    dataFreshness,
  } = useRegionData({ trends, dataSource, selectedMetier });

  useEffect(() => {
    if (!selectedRegionCode) {
      return;
    }

    const updatedRegion = currentRegionData.find((region) => region.code === selectedRegionCode);
    setSelectedRegion(updatedRegion || null);
  }, [currentRegionData, selectedRegionCode]);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      setFrenchLabels(map);
    }
  }, []);

  const handleMetierSelect = useCallback(
    async (trendId: string, rome: string) => {
      if (selectedMetier === rome) {
        setSelectedMetier(null);
        resetMetadata();
        return;
      }

      setSelectedMetier(rome);
      await loadTrendMetadata(trendId);
    },
    [loadTrendMetadata, resetMetadata, selectedMetier]
  );

  const currentSourceOption = DATA_SOURCE_OPTIONS.find((option) => option.value === dataSource);
  const SourceIcon = currentSourceOption?.icon || ChartBarIcon;

  const getRegionColor = useCallback(
    (value: number) => {
      const intensity = Math.min(value / maxValue, 1);
      const hueByColor: Record<string, number> = {
        gray: 220,
        indigo: 220,
        red: 0,
        emerald: 160,
        blue: 210,
        teal: 175,
        purple: 270,
        violet: 280,
      };
      const hue = hueByColor[currentSourceOption?.color || 'indigo'] || 220;
      const saturation = 70 + intensity * 20;
      const lightness = 80 - intensity * 45;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    },
    [currentSourceOption?.color, maxValue]
  );

  const getBubbleSize = useCallback(
    (value: number) => {
      const minSize = 24;
      const maxSize = 64;
      const intensity = Math.min(value / maxValue, 1);
      return minSize + intensity * (maxSize - minSize);
    },
    [maxValue]
  );

  const formatValue = useCallback(
    (value: number | string | undefined | null) => formatFranceMapValue(dataSource, value),
    [dataSource]
  );

  const getValueLabel = useCallback(() => getFranceMapValueLabel(dataSource), [dataSource]);

  const statsCards = useMemo(
    () =>
      buildFranceMapStatsCards({
        currentRegionCount: currentRegionData.length,
        dataSource,
        t,
        topRegionName: topRegion?.name,
        totalValue,
        uniqueMetiersCount,
      }),
    [currentRegionData.length, dataSource, t, topRegion?.name, totalValue, uniqueMetiersCount]
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('marketRadar.map.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 ${className}`}>
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (currentRegionData.length === 0) {
    return <FranceMapNoDataState className={className} dataSource={dataSource} onSourceChange={setDataSource} t={t} />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <FranceMapControls
        dataSource={dataSource}
        loading={loading}
        onRefresh={() => {
          setSelectedRegion(null);
          void reload({ forceRefresh: true });
        }}
        onSourceChange={setDataSource}
        t={t}
      />

      <FranceMapStatsCards statsCards={statsCards} />

      {dataFreshness && <FranceMapFreshnessBanner dataFreshness={dataFreshness} t={t} />}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className={`px-6 py-4 border-b ${
          currentSourceOption?.color === 'red' ? 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800' :
          currentSourceOption?.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800' :
          currentSourceOption?.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' :
          currentSourceOption?.color === 'teal' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800' :
          currentSourceOption?.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800' :
          currentSourceOption?.color === 'violet' ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-100 dark:border-violet-800' :
          'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800'
        }`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SourceIcon className="h-5 w-5" />
            {t(`marketRadar.dataTypes.${dataSource}`)} {t('marketRadar.map.title').toLowerCase().replace('données ', '')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('marketRadar.map.subtitle')}</p>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="relative flex-1 min-h-[500px]" key={`map-container-${selectedMetier || 'all'}-${dataSource}`}>
            {isMapEnabled ? (
              <Suspense
                fallback={
                  <div className="flex h-[500px] items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                    <ArrowPathIcon className="h-6 w-6 animate-spin" />
                    <span className="ml-2">{t('marketRadar.map.loading')}</span>
                  </div>
                }
              >
                <FranceMapCanvas
                  mapRef={mapRef}
                  isDarkMode={isDarkMode}
                  dataSource={dataSource}
                  selectedMetier={selectedMetier}
                  selectedRegion={selectedRegion}
                  hoveredRegion={hoveredRegion}
                  currentRegionData={currentRegionData}
                  multiTypeRegionData={multiTypeRegionData}
                  onMapLoad={handleMapLoad}
                  onHoveredRegionChange={setHoveredRegion}
                  onRegionSelect={setSelectedRegion}
                  onDataSourceChange={setDataSource}
                  getBubbleSize={getBubbleSize}
                  getRegionColor={getRegionColor}
                  formatValue={formatValue}
                  getValueLabel={getValueLabel}
                />
              </Suspense>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center dark:bg-gray-900">
                <div className="rounded-full bg-indigo-100 p-4 dark:bg-indigo-900/30">
                  <MapPinIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('marketRadar.map.title')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('marketRadar.map.subtitle')}
                  </p>
                </div>
                <button
                  onClick={() => setIsMapEnabled(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                  type="button"
                >
                  <MapPinIcon className="h-4 w-4" />
                  {t('marketRadar.map.loadInteractive', 'Charger la carte interactive')}
                </button>
              </div>
            )}
          </div>

          {isMapEnabled && selectedRegion ? (
            <RegionDetailPanel
              selectedRegion={selectedRegion}
              dataSource={dataSource}
              trends={trends}
              jobRegionDataFull={jobRegionDataFull}
              selectedMetier={selectedMetier}
              selectedTrendMetadata={selectedTrendMetadata}
              metadataLoading={metadataLoading}
              metierFilter={metierFilter}
              romeLabelsMap={romeLabelsMap}
              onClose={() => setSelectedRegion(null)}
              onMetierFilterChange={setMetierFilter}
              onMetierSelect={handleMetierSelect}
              onResetFilters={() => {
                setSelectedMetier(null);
                setMetierFilter('');
                resetMetadata();
              }}
              formatValue={formatValue}
              getValueLabel={getValueLabel}
            />
          ) : null}
        </div>
      </div>

      <FranceMapLegend
        dataSource={dataSource}
        getRegionColor={getRegionColor}
        maxValue={maxValue}
        onSourceChange={setDataSource}
        t={t}
      />
    </div>
  );
}

