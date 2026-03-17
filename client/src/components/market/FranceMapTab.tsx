/**
 * FranceMapTab - Interactive France Map for Market Radar
 * Displays regional job market data on a map of France using react-map-gl/maplibre
 * Updated: 2026-02-01 - Fixed hooks order
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinIcon, ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import Map, { Marker, Popup, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MarketTrend, getAllTrends, getTrendMetadata } from '../../services/marketRadarService';
import { getStoredMetiers, Metier } from '../../services/romeService';
import logger from '../../utils/logger.frontend';
import {
  DATA_SOURCE_OPTIONS,
  MAP_STYLES,
  setFrenchLabels,
  type DataSourceType,
  type RegionData,
  type TrendRegionData
} from './franceMap.types';
import { useRegionData } from './useRegionData';
import RegionDetailPanel from './RegionDetailPanel';

export default function FranceMapTab({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const mapRef = useRef<MapRef>(null);
  const [dataSource, setDataSource] = useState<DataSourceType>('offres');
  // Facts state removed - now using trends for all data including job offers
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionData | TrendRegionData | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [metierFilter, setMetierFilter] = useState<string>('');
  const [selectedMetier, setSelectedMetier] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Metadata state for selected métier
  const [selectedTrendMetadata, setSelectedTrendMetadata] = useState<MarketTrend | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  
  // LRU-style cache with max size to prevent memory leaks
  const METADATA_CACHE_MAX_SIZE = 50;
  const metadataCacheRef = useRef<{ data: Record<string, MarketTrend>; keys: string[] }>({ data: {}, keys: [] });
  
  // Cleanup on unmount to free memory
  useEffect(() => {
    return () => {
      // Clear all state to free memory
      setTrends([]);
      setMetiers([]);
      setSelectedRegion(null);
      setSelectedTrendMetadata(null);
      // Clear metadata cache
      metadataCacheRef.current = { data: {}, keys: [] };
    };
  }, []);
  
  // Helper to add to cache with LRU eviction
  const addToMetadataCache = useCallback((trendId: string, trend: MarketTrend) => {
    const cache = metadataCacheRef.current;
    // Remove from keys if already exists (to re-add at end)
    const existingIndex = cache.keys.indexOf(trendId);
    if (existingIndex !== -1) {
      cache.keys.splice(existingIndex, 1);
    }
    // Evict oldest entries if cache is full
    while (cache.keys.length >= METADATA_CACHE_MAX_SIZE) {
      const oldestKey = cache.keys.shift();
      if (oldestKey) delete cache.data[oldestKey];
    }
    // Add to cache
    cache.data[trendId] = trend;
    cache.keys.push(trendId);
  }, []);
  
  // Helper to get from cache (updates LRU position)
  const getFromMetadataCache = useCallback((trendId: string): MarketTrend | undefined => {
    const cache = metadataCacheRef.current;
    const trend = cache.data[trendId];
    if (trend) {
      // Move to end (most recently used)
      const index = cache.keys.indexOf(trendId);
      if (index !== -1) {
        cache.keys.splice(index, 1);
        cache.keys.push(trendId);
      }
    }
    return trend;
  }, []);
  
  // Handle métier selection - load metadata for selected trend
  const handleMetierSelect = useCallback(async (trendId: string, rome: string) => {
    // Toggle selection
    if (selectedMetier === rome) {
      setSelectedMetier(null);
      setSelectedTrendMetadata(null);
      return;
    }
    
    setSelectedMetier(rome);
    
    // Check cache first
    const cachedTrend = getFromMetadataCache(trendId);
    if (cachedTrend) {
      setSelectedTrendMetadata(cachedTrend);
      return;
    }
    
    // Load metadata
    setMetadataLoading(true);
    try {
      const response = await getTrendMetadata(trendId);
      if (response.success && response.trend) {
        addToMetadataCache(trendId, response.trend);
        setSelectedTrendMetadata(response.trend);
      }
    } catch (err) {
      logger.error('[FranceMap] Failed to load trend metadata:', err);
    } finally {
      setMetadataLoading(false);
    }
  }, [selectedMetier, getFromMetadataCache, addToMetadataCache]);

  // Handle map load - set French labels
  const handleMapLoad = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      setFrenchLabels(map);
    }
  }, []);

  // Track previous region code to detect region changes
  const selectedRegionCode = selectedRegion?.code;
  const prevRegionCodeRef = useRef<string | null>(null);
  
  // When region changes (not métier), reload metadata for the selected métier in the new region
  useEffect(() => {
    const prevRegionCode = prevRegionCodeRef.current;
    
    // Update ref AFTER checking for change
    // Skip if this is the same region (no change)
    if (prevRegionCode === selectedRegionCode) {
      return;
    }
    
    // Update the ref to current region
    prevRegionCodeRef.current = selectedRegionCode ?? null;
    
    // Skip if this is initial selection (no previous region)
    if (prevRegionCode === null) {
      return;
    }
    
    // Region changed - reload metadata for selected métier in new region
    if (!selectedRegionCode || !selectedMetier) {
      setSelectedTrendMetadata(null);
      return;
    }
    
    // Find the trend for the selected métier in the new region
    // Note: dataSource 'offres' maps to trend Type 'offre'
    const trendType = dataSource === 'offres' ? 'offre' : dataSource;
    const trendForMetier = trends.find(t => 
      t.CodeRome === selectedMetier && 
      t.RegionCode === selectedRegionCode &&
      (dataSource === 'all' || t.Type === trendType)
    );
    
    if (trendForMetier) {
      // Check cache first
      const cachedTrend = getFromMetadataCache(trendForMetier.id);
      if (cachedTrend) {
        setSelectedTrendMetadata(cachedTrend);
        return;
      }
      
      // Load metadata for this trend
      setMetadataLoading(true);
      getTrendMetadata(trendForMetier.id)
        .then(response => {
          if (response.success && response.trend) {
            addToMetadataCache(trendForMetier.id, response.trend);
            setSelectedTrendMetadata(response.trend);
          } else {
            setSelectedTrendMetadata(null);
          }
        })
        .catch(err => {
          logger.error('[FranceMap] Failed to load trend metadata for new region:', err);
          setSelectedTrendMetadata(null);
        })
        .finally(() => {
          setMetadataLoading(false);
        });
    } else {
      // No data for this métier in the new region
      setSelectedTrendMetadata(null);
    }
  }, [selectedRegionCode, selectedMetier, trends, dataSource, getFromMetadataCache, addToMetadataCache]);
  
  // Clear metadata state when data source changes
  useEffect(() => {
    setSelectedTrendMetadata(null);
    // Clear cache when switching data sources to free memory
    metadataCacheRef.current = { data: {}, keys: [] };
  }, [dataSource]);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    // Initial check
    checkDarkMode();
    
    // Watch for changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  // Load data based on selected source
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setSelectedRegion(null);
      setSelectedMetier(null);
      
      try {
        if (dataSource === 'all') {
          // Load all trends data (value is pre-calculated during collection)
          const [allTrendsResponse, metiersData] = await Promise.all([
            getAllTrends(),
            getStoredMetiers()
          ]);
          setTrends(allTrendsResponse.trends);
          setMetiers(metiersData || []);
        } else if (dataSource === 'offres') {
          // Load job offers from trends (type='offre')
          const [trendsResponse, metiersData] = await Promise.all([
            getAllTrends('offre'),
            getStoredMetiers()
          ]);
          setTrends(trendsResponse.trends);
          setMetiers(metiersData || []);
        } else {
          // Load specific trend type
          const [trendsResponse, metiersData] = await Promise.all([
            getAllTrends(dataSource),
            getStoredMetiers()
          ]);
          setTrends(trendsResponse.trends);
          setMetiers(metiersData || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataSource]);

  // Create a map of ROME codes to labels
  const romeLabelsMap = useMemo(() => {
    const map = metiers.reduce((acc, m) => {
      if (m.CodeRome && m.Libelle) {
        acc[m.CodeRome] = m.Libelle;
      }
      return acc;
    }, {} as Record<string, string>);
    return map;
  }, [metiers]);

  // Region data aggregation (extracted to custom hook)
  const {
    jobRegionDataFull,
    multiTypeRegionData,
    currentRegionData,
    maxValue,
    totalValue,
    topRegion,
    uniqueMetiersCount,
    dataFreshness
  } = useRegionData({ trends, dataSource, selectedMetier });

  // Sync selectedRegion with currentRegionData when data changes
  // This ensures the value and romeBreakdown are always up-to-date with current filters (including selectedMetier)
  const currentSelectedRegionCode = selectedRegion?.code;
  useEffect(() => {
    if (currentSelectedRegionCode) {
      const updatedRegion = currentRegionData.find(r => r.code === currentSelectedRegionCode);
      if (updatedRegion) {
        // Always update to get the latest value (filtered by selectedMetier if applicable)
        setSelectedRegion(updatedRegion);
      } else {
        setSelectedRegion(null);
      }
    }
  }, [currentRegionData, currentSelectedRegionCode]);

  // Get current source option for styling
  const currentSourceOption = DATA_SOURCE_OPTIONS.find(o => o.value === dataSource);
  const SourceIcon = currentSourceOption?.icon || ChartBarIcon;

  // Get color based on data source and value
  const getRegionColor = (value: number) => {
    const intensity = Math.min(value / maxValue, 1);
    const sourceOption = DATA_SOURCE_OPTIONS.find(o => o.value === dataSource);
    
    // Color hues based on data source
    const colorMap: Record<string, number> = {
      gray: 220,
      indigo: 220,
      red: 0,
      emerald: 160,
      blue: 210,
      teal: 175,
      purple: 270,
      violet: 280
    };
    
    const hue = colorMap[sourceOption?.color || 'indigo'] || 220;
    const saturation = 70 + intensity * 20;
    const lightness = 80 - intensity * 45;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Get bubble size based on value
  const getBubbleSize = (value: number) => {
    const minSize = 24;
    const maxSize = 64;
    const intensity = Math.min(value / maxValue, 1);
    return minSize + intensity * (maxSize - minSize);
  };

  // Format value for display (handles NaN and string values)
  const formatValue = (value: number | string | undefined | null) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0);
    if (isNaN(numValue)) return '0';
    
    if (dataSource === 'all' || dataSource === 'offres') {
      return numValue > 999 ? `${Math.round(numValue / 1000)}k` : Math.round(numValue).toString();
    }
    if (dataSource === 'salaire') {
      return `${Math.round(numValue / 1000)}k€`;
    }
    if (dataSource === 'tension') {
      return numValue.toFixed(1);
    }
    return numValue > 999 ? `${Math.round(numValue / 1000)}k` : Math.round(numValue).toString();
  };

  // Get value label based on data source
  const getValueLabel = () => {
    const labels: Record<DataSourceType, string> = {
      all: 'données',
      offres: 'offres',
      tension: 'indice',
      salaire: '€',
      dynamique_emploi: 'indice',
      embauche: 'embauches',
      demandeur: 'demandeurs',
      demandeur_entrant: 'nouveaux'
    };
    return labels[dataSource];
  };

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
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Data Source Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type de données</label>
          <select
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value as DataSourceType)}
            className="w-full md:w-64 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            {DATA_SOURCE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MapPinIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('marketRadar.map.noData')}</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {dataSource === 'offres' 
              ? t('marketRadar.map.noDataOffres')
              : t('marketRadar.map.noDataTrends')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Data Source Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.map.selectDataType')}</label>
            <select
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value as DataSourceType)}
              className="w-full md:w-64 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              {DATA_SOURCE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{t(`marketRadar.dataTypes.${option.value}`)}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={async () => {
              setLoading(true);
              setError(null);
              setSelectedRegion(null);
              try {
                if (dataSource === 'all') {
                  const [trendsResponse, metiersData] = await Promise.all([
                    getAllTrends(),
                    getStoredMetiers()
                  ]);
                  setTrends(trendsResponse.trends);
                  setMetiers(metiersData);
                } else if (dataSource === 'offres') {
                  const [trendsResponse, metiersData] = await Promise.all([
                    getAllTrends('offre'),
                    getStoredMetiers()
                  ]);
                  setTrends(trendsResponse.trends);
                  setMetiers(metiersData);
                } else {
                  const [trendsData, metiersData] = await Promise.all([
                    getAllTrends(dataSource),
                    getStoredMetiers()
                  ]);
                  setTrends(trendsData.trends);
                  setMetiers(metiersData);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            title={t('marketRadar.map.refresh')}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {dataSource === 'offres' 
              ? (isNaN(totalValue) ? '0' : totalValue.toLocaleString())
              : dataSource === 'salaire' 
                ? `${isNaN(totalValue) ? '0' : Math.round(totalValue).toLocaleString()} €`
                : ['embauche', 'demandeur', 'demandeur_entrant'].includes(dataSource)
                  ? (isNaN(totalValue) ? '0' : Math.round(totalValue).toLocaleString())
                  : (isNaN(totalValue) ? '0' : totalValue.toFixed(2))}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {dataSource === 'offres' 
              ? t('marketRadar.map.totalOffers') 
              : ['embauche', 'demandeur', 'demandeur_entrant'].includes(dataSource)
                ? `${t('marketRadar.map.total')} ${t(`marketRadar.dataTypes.${dataSource}`)}`
                : `${t('marketRadar.map.average')} ${t(`marketRadar.dataTypes.${dataSource}`)}`}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {currentRegionData.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.map.regionsCovered')}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-lg font-bold text-green-600 dark:text-green-400 truncate" title={topRegion?.name || '-'}>
            {topRegion?.name || '-'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.map.topRegion')}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {uniqueMetiersCount}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('marketRadar.map.itJobs')}</div>
        </div>
      </div>

      {/* Data Freshness Indicator */}
      {dataFreshness && (
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
                  dataFreshness.status === 'fresh' ? 'bg-green-500' : 
                  dataFreshness.status === 'recent' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
                {dataFreshness.status === 'fresh' ? t('marketRadar.freshness.fresh', 'Données à jour') :
                 dataFreshness.status === 'recent' ? t('marketRadar.freshness.recent', 'Données récentes') :
                 t('marketRadar.freshness.stale', 'Données anciennes')}
              </span>
              {dataFreshness.quarterPeriod && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('marketRadar.freshness.period', 'Période')}: <strong>{dataFreshness.quarterPeriod}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {t('marketRadar.freshness.collectedAt', 'Collecté le')}: {dataFreshness.newestDate.toLocaleDateString('fr-FR')}
              </span>
              <span>
                {t('marketRadar.freshness.records', 'Enregistrements')}: {dataFreshness.totalRecords.toLocaleString()}
              </span>
              <span className="text-gray-400 dark:text-gray-500">
                Source: France Travail API
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
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
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('marketRadar.map.subtitle')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Map with MapLibre */}
          <div className="relative flex-1 min-h-[500px]" key={`map-container-${selectedMetier || 'all'}-${dataSource}`}>
            <Map
              ref={mapRef}
              initialViewState={{
                longitude: 2.5,
                latitude: 46.5,
                zoom: 5
              }}
              style={{ width: '100%', height: '500px' }}
              mapStyle={isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light}
              attributionControl={false}
              onLoad={handleMapLoad}
            >
              <NavigationControl position="top-right" />
              
              {/* Region markers - multi-bubble for 'all' mode */}
              {dataSource === 'all' ? (
                // Multiple bubbles per region for 'all' mode
                multiTypeRegionData.map(region => {
                  const bubbleCount = region.typeData.length;
                  const radius = 0.4; // Offset radius in degrees
                  
                  return region.typeData.map((typeInfo, index) => {
                    // Position bubbles in a circle around the region center
                    const angle = (2 * Math.PI * index) / bubbleCount - Math.PI / 2;
                    const offsetLng = bubbleCount > 1 ? Math.cos(angle) * radius : 0;
                    const offsetLat = bubbleCount > 1 ? Math.sin(angle) * radius * 0.7 : 0; // 0.7 to account for map projection
                    
                    const size = 28; // Fixed smaller size for multi-bubble mode
                    const colorHues: Record<string, number> = {
                      indigo: 220, red: 0, blue: 210, teal: 175, purple: 270, violet: 280, gray: 220
                    };
                    const hue = colorHues[typeInfo.color] || 220;
                    const bgColor = `hsl(${hue}, 70%, 50%)`;
                    
                    return (
                      <Marker
                        key={`${region.regionCode}-${typeInfo.type}`}
                        longitude={region.coords[0] + offsetLng}
                        latitude={region.coords[1] + offsetLat}
                        anchor="center"
                      >
                        <button
                          onClick={() => setDataSource(typeInfo.type)}
                          onMouseEnter={() => setHoveredRegion(region.regionCode)}
                          onMouseLeave={() => setHoveredRegion(null)}
                          className="rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 hover:scale-125 focus:outline-none border-2 border-white"
                          style={{
                            width: `${size}px`,
                            height: `${size}px`,
                            backgroundColor: bgColor,
                            fontSize: '9px'
                          }}
                          title={`${region.regionName} - ${typeInfo.label}: ${typeInfo.type === 'offres' ? (isNaN(typeInfo.value) ? '0' : typeInfo.value.toLocaleString()) : (isNaN(typeInfo.value) ? '0' : typeInfo.value.toFixed(1))}`}
                        >
                          {typeInfo.type === 'offres' 
                            ? (isNaN(typeInfo.value) ? '0' : (typeInfo.value > 999 ? `${Math.round(typeInfo.value / 1000)}k` : Math.round(typeInfo.value)))
                            : (isNaN(typeInfo.value) ? '0' : typeInfo.value.toFixed(1))
                          }
                        </button>
                      </Marker>
                    );
                  });
                })
              ) : (
                // Single bubble per region for specific data source
                currentRegionData.map(region => {
                  const regionValue = region.value;
                  const size = getBubbleSize(regionValue);
                  const isSelected = selectedRegion?.code === region.code;

                  return (
                    <Marker
                      key={`${region.code}-${selectedMetier || 'all'}`}
                      longitude={region.coords[0]}
                      latitude={region.coords[1]}
                      anchor="center"
                    >
                      <button
                        onClick={() => setSelectedRegion(isSelected ? null : region)}
                        onMouseEnter={() => setHoveredRegion(region.code)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none ${
                          isSelected ? 'ring-4 ring-indigo-500' : ''
                        }`}
                        style={{
                          width: `${size}px`,
                          height: `${size}px`,
                          backgroundColor: getRegionColor(regionValue),
                          fontSize: size > 40 ? '12px' : '10px'
                        }}
                        title={`${region.name}: ${formatValue(regionValue)} ${getValueLabel()}`}
                      >
                        {formatValue(regionValue)}
                      </button>
                    </Marker>
                  );
                })
              )}

              {/* Popup for hovered region */}
              {hoveredRegion && !selectedRegion && (() => {
                const hoveredData = currentRegionData.find(r => r.code === hoveredRegion);
                if (!hoveredData) return null;
                return (
                  <Popup
                    longitude={hoveredData.coords[0]}
                    latitude={hoveredData.coords[1]}
                    closeButton={false}
                    closeOnClick={false}
                    anchor="bottom"
                    offset={20}
                  >
                    <div className="p-1">
                      <div className="font-semibold text-gray-900">
                        {hoveredData.name}
                      </div>
                      <div className="text-indigo-600 font-bold">
                        {formatValue(hoveredData.value)} {getValueLabel()}
                      </div>
                    </div>
                  </Popup>
                );
              })()}
            </Map>
          </div>

          {/* Region Detail Panel */}
          {selectedRegion && (
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
              onResetFilters={() => { setSelectedMetier(null); setMetierFilter(''); }}
              formatValue={formatValue}
              getValueLabel={getValueLabel}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('marketRadar.map.legend')}</h4>
        {dataSource === 'all' ? (
          // Legend for 'all' mode - show each data type with its color
          <div className="flex items-center gap-4 flex-wrap">
            {DATA_SOURCE_OPTIONS.filter(o => o.value !== 'all' && o.value !== 'salaire').map(option => {
              const colorHues: Record<string, number> = {
                indigo: 220, red: 0, blue: 210, teal: 175, purple: 270, violet: 280
              };
              const hue = colorHues[option.color] || 220;
              return (
                <button
                  key={option.value}
                  onClick={() => setDataSource(option.value)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <div 
                    className="w-4 h-4 rounded-full border border-white shadow-sm" 
                    style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{t(`marketRadar.dataTypes.${option.value}`)}</span>
                </button>
              );
            })}
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              {t('marketRadar.map.clickToFilter')}
            </div>
          </div>
        ) : (
          // Standard legend for single data source
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
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              {t('marketRadar.map.bubbleSizeInfo')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
