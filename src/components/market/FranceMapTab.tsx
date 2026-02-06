/**
 * FranceMapTab - Interactive France Map for Market Radar
 * Displays regional job market data on a map of France using react-map-gl/maplibre
 * Updated: 2026-02-01 - Fixed hooks order
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinIcon, BriefcaseIcon, ArrowPathIcon, ChartBarIcon, CurrencyEuroIcon, ExclamationTriangleIcon, ArrowTrendingUpIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Map, { Marker, Popup, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import { useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { MarketTrend, getAllTrends, getTrendMetadata } from '../../services/marketRadarService';
import { getStoredMetiers, Metier } from '../../services/romeService';
import TrendMetadataDisplay, { parseMetadata } from './TrendMetadataDisplay';

// Data source types
type DataSourceType = 'all' | 'offres' | 'tension' | 'salaire' | 'dynamique_emploi' | 'embauche' | 'demandeur' | 'demandeur_entrant';

const DATA_SOURCE_OPTIONS: { value: DataSourceType; label: string; icon: typeof BriefcaseIcon; color: string }[] = [
  { value: 'offres', label: 'Offres d\'emploi', icon: BriefcaseIcon, color: 'indigo' },
  { value: 'tension', label: 'Tensions recrutement', icon: ExclamationTriangleIcon, color: 'red' },
  // Salaire excluded - no geographic dimension (national level only)
  { value: 'dynamique_emploi', label: 'Dynamique emploi', icon: ArrowTrendingUpIcon, color: 'blue' },
  { value: 'embauche', label: 'Embauches', icon: BriefcaseIcon, color: 'teal' },
  { value: 'demandeur', label: 'Demandeurs d\'emploi', icon: UserGroupIcon, color: 'purple' },
  { value: 'demandeur_entrant', label: 'Nouveaux demandeurs', icon: UserGroupIcon, color: 'violet' }
];

// French regions with their coordinates for markers (longitude, latitude)
const REGIONS_INFO: Record<string, { coords: [number, number]; name: string }> = {
  '84': { coords: [5.0, 45.5], name: 'Auvergne-Rhône-Alpes' },
  '27': { coords: [5.0, 47.2], name: 'Bourgogne-Franche-Comté' },
  '53': { coords: [-3.0, 48.2], name: 'Bretagne' },
  '24': { coords: [1.5, 47.2], name: 'Centre-Val de Loire' },
  '94': { coords: [9.0, 42.0], name: 'Corse' },
  '44': { coords: [6.0, 48.5], name: 'Grand Est' },
  '32': { coords: [3.0, 49.8], name: 'Hauts-de-France' },
  '11': { coords: [2.5, 48.8], name: 'Île-de-France' },
  '28': { coords: [0.0, 49.0], name: 'Normandie' },
  '75': { coords: [0.0, 45.5], name: 'Nouvelle-Aquitaine' },
  '76': { coords: [2.0, 43.5], name: 'Occitanie' },
  '52': { coords: [-1.0, 47.2], name: 'Pays de la Loire' },
  '93': { coords: [6.0, 43.8], name: "Provence-Alpes-Côte d'Azur" }
};

interface RegionData {
  code: string;
  name: string;
  totalJobs: number;
  value: number;
  romeBreakdown: Record<string, number>;
  coords: [number, number];
}

interface TrendRegionData {
  code: string;
  name: string;
  value: number;
  count: number;
  romeBreakdown: Record<string, { value: number; count: number; label?: string }>;
  coords: [number, number];
}

interface FranceMapTabProps {
  className?: string;
}

// Map styles for light and dark modes
const MAP_STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};

// French region name mappings (English/default -> French)
const FRENCH_REGION_NAMES: Record<string, string> = {
  // Régions métropolitaines
  'UPPER FRANCE': 'HAUTS-DE-FRANCE',
  'Upper France': 'Hauts-de-France',
  'HAUTS-DE-FRANCE': 'HAUTS-DE-FRANCE',
  'NORMANDY': 'NORMANDIE',
  'Normandy': 'Normandie',
  'BRITTANY': 'BRETAGNE',
  'Brittany': 'Bretagne',
  'PAYS OF THE LOIRE': 'PAYS DE LA LOIRE',
  'Pays of the Loire': 'Pays de la Loire',
  'PAYS DE LA LOIRE': 'PAYS DE LA LOIRE',
  'CENTRE-LOIRE VALLEY': 'CENTRE-VAL DE LOIRE',
  'Centre-Loire Valley': 'Centre-Val de Loire',
  'CENTRE-VAL DE LOIRE': 'CENTRE-VAL DE LOIRE',
  'BURGUNDY-FREE COUNTY': 'BOURGOGNE-FRANCHE-COMTÉ',
  'Burgundy-Free County': 'Bourgogne-Franche-Comté',
  'BOURGOGNE-FRANCHE-COMTÉ': 'BOURGOGNE-FRANCHE-COMTÉ',
  'GRAND EAST': 'GRAND EST',
  'Grand East': 'Grand Est',
  'GREATER EAST': 'GRAND EST',
  'Greater East': 'Grand Est',
  'GRAND EST': 'GRAND EST',
  'NEW AQUITANIA': 'NOUVELLE-AQUITAINE',
  'New Aquitania': 'Nouvelle-Aquitaine',
  'NEW AQUITAINE': 'NOUVELLE-AQUITAINE',
  'New Aquitaine': 'Nouvelle-Aquitaine',
  'NOUVELLE-AQUITAINE': 'NOUVELLE-AQUITAINE',
  'OCCITANIA': 'OCCITANIE',
  'Occitania': 'Occitanie',
  'OCCITANIE': 'OCCITANIE',
  'AUVERGNE-RHÔNE-ALPES': 'AUVERGNE-RHÔNE-ALPES',
  'Auvergne-Rhône-Alpes': 'Auvergne-Rhône-Alpes',
  'PROVENCE-ALPES-CÔTE D\'AZUR': 'PROVENCE-ALPES-CÔTE D\'AZUR',
  'Provence-Alpes-Côte d\'Azur': 'Provence-Alpes-Côte d\'Azur',
  'CORSICA': 'CORSE',
  'Corsica': 'Corse',
  'CORSE': 'CORSE',
  'Corse': 'Corse',
  'COLLECTIVITÉ DE CORSE': 'CORSE',
  'Collectivité de Corse': 'Corse',
  'TERRITORIAL COLLECTIVITY OF CORSICA': 'CORSE',
  'Territorial Collectivity of Corsica': 'Corse',
  'COLLECTIVITY OF CORSICA': 'CORSE',
  'Collectivity of Corsica': 'Corse',
  'ÎLE-DE-FRANCE': 'ÎLE-DE-FRANCE',
  'Île-de-France': 'Île-de-France',
  'ILE-DE-FRANCE': 'ÎLE-DE-FRANCE',
  'Ile-de-France': 'Île-de-France',
  // Régions d'outre-mer
  'FRENCH GUIANA': 'GUYANE',
  'French Guiana': 'Guyane',
  'GUADELOUPE': 'GUADELOUPE',
  'MARTINIQUE': 'MARTINIQUE',
  'RÉUNION': 'LA RÉUNION',
  'Réunion': 'La Réunion',
  'REUNION': 'LA RÉUNION',
  'Reunion': 'La Réunion',
  'MAYOTTE': 'MAYOTTE',
  // Villes principales (au cas où)
  'FRANCE': 'FRANCE',
  'France': 'France',
};

// Function to set French labels on map load
const setFrenchLabels = (map: MaplibreMap) => {
  const style = map.getStyle();
  if (!style || !style.layers) return;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style.layers.forEach((layer: any) => {
    // Find text layers that use 'name' property
    if (layer.layout && layer.layout['text-field']) {
      // Use a case expression to replace known English region names with French
      // First try name:fr, then check our mapping, then fallback to original name
      const frenchNameExpression = [
        'coalesce',
        ['get', 'name:fr'],
        // Use case expression to map English names to French
        ['case',
          ...Object.entries(FRENCH_REGION_NAMES).flatMap(([en, fr]) => [
            ['==', ['get', 'name'], en], fr
          ]),
          ['get', 'name'] // default fallback
        ]
      ];
      
      map.setLayoutProperty(layer.id, 'text-field', frenchNameExpression);
    }
  });
};

export default function FranceMapTab({ className = '' }: FranceMapTabProps) {
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
      console.error('Failed to load trend metadata:', err);
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

  // Clear metadata state when region changes
  useEffect(() => {
    setSelectedTrendMetadata(null);
  }, [selectedRegion]);
  
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
          // Load all trends data in single optimized call
          const [allTrendsResponse, metiersData] = await Promise.all([
            getAllTrends(), // Single optimized call for all trends
            getStoredMetiers()
          ]);
          setTrends(allTrendsResponse.trends);
          setMetiers(metiersData || []);
        } else if (dataSource === 'offres') {
          // Load job offers from trends (type='offre')
          const [trendsResponse, metiersData] = await Promise.all([
            getAllTrends('offre'), // Filter for offre type
            getStoredMetiers()
          ]);
          setTrends(trendsResponse.trends);
          setMetiers(metiersData || []);
        } else {
          // Load specific trend type - use getAllTrends with type filter (NO metadata, optimized)
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

  // Helper to get métier label from code (uses romeLabelsMap as fallback for job offers)
  const getMetierLabel = (codeRome: string, romeLabel?: string): string => {
    // For trends, use the RomeLabel field stored server-side
    if (romeLabel) return romeLabel;
    // For job offers, use the romeLabelsMap
    return romeLabelsMap[codeRome] || codeRome;
  };

  // Aggregate job offers data by region (from trends with type='offre')
  // Each trend represents one métier in one region - avoid counting duplicates
  const jobRegionData = useMemo(() => {
    if (dataSource !== 'offres' && dataSource !== 'all') return [];
    
    const aggregated: Record<string, RegionData> = {};
    // Track unique region+rome combinations to avoid duplicates
    const seenCombinations = new Set<string>();
    
    // Filter trends for 'offre' type
    const offreTrends = trends.filter(t => t.Type === 'offre');
    const filteredTrends = selectedMetier 
      ? offreTrends.filter(t => t.CodeRome === selectedMetier)
      : offreTrends;

    filteredTrends.forEach(trend => {
      const regionCode = trend.RegionCode;
      if (!regionCode || !REGIONS_INFO[regionCode]) return;

      // Create unique key for this region+rome combination
      const comboKey = `${regionCode}-${trend.CodeRome || 'unknown'}`;
      
      // Skip if we've already processed this combination (take the first/most recent)
      if (seenCombinations.has(comboKey)) return;
      seenCombinations.add(comboKey);

      if (!aggregated[regionCode]) {
        aggregated[regionCode] = {
          code: regionCode,
          name: REGIONS_INFO[regionCode].name,
          totalJobs: 0,
          value: 0,
          romeBreakdown: {},
          coords: REGIONS_INFO[regionCode].coords
        };
      }

      // Value contains the job count for 'offre' type
      const jobCount = typeof trend.Value === 'string' ? parseFloat(trend.Value) : (trend.Value || 0);
      if (!isNaN(jobCount)) {
        aggregated[regionCode].totalJobs += jobCount;
        aggregated[regionCode].value = aggregated[regionCode].totalJobs;
        
        if (trend.CodeRome) {
          // Each rome code should only appear once per region now
          aggregated[regionCode].romeBreakdown[trend.CodeRome] = jobCount;
        }
      }
    });

    return Object.values(aggregated);
  }, [trends, selectedMetier, dataSource]);

  // Aggregate trend data by region
  // Filter by selected dataSource type and avoid duplicates
  const trendRegionData = useMemo(() => {
    if (dataSource === 'offres') return [];
    if (dataSource === 'all' && trends.length === 0) return [];
    
    const aggregated: Record<string, TrendRegionData> = {};
    // Track unique region+rome+type combinations to avoid duplicates
    const seenCombinations = new Set<string>();
    
    // Filter by type (unless 'all') and by selected métier
    let filteredTrends = trends;
    if (dataSource !== 'all') {
      filteredTrends = filteredTrends.filter(t => t.Type === dataSource);
    }
    if (selectedMetier) {
      filteredTrends = filteredTrends.filter(t => t.CodeRome === selectedMetier);
    }

    filteredTrends.forEach(trend => {
      const regionCode = trend.RegionCode;
      if (!regionCode || !REGIONS_INFO[regionCode]) return;

      // Create unique key for this region+rome+type combination
      const comboKey = `${regionCode}-${trend.CodeRome || 'unknown'}-${trend.Type || 'unknown'}`;
      
      // Skip if we've already processed this combination (take the first/most recent)
      if (seenCombinations.has(comboKey)) return;
      seenCombinations.add(comboKey);

      if (!aggregated[regionCode]) {
        aggregated[regionCode] = {
          code: regionCode,
          name: REGIONS_INFO[regionCode].name,
          value: 0,
          count: 0,
          romeBreakdown: {},
          coords: REGIONS_INFO[regionCode].coords
        };
      }

      // Each unique combination is counted once (no duplicates due to seenCombinations)
      // Convert Value to number (PostgreSQL DECIMAL returns string)
      const numValue = typeof trend.Value === 'string' ? parseFloat(trend.Value) : (trend.Value || 0);
      if (!isNaN(numValue)) {
        aggregated[regionCode].value += numValue;
        aggregated[regionCode].count += 1;
      }
      
      if (trend.CodeRome) {
        // Assign directly - each rome code appears only once per region due to seenCombinations
        aggregated[regionCode].romeBreakdown[trend.CodeRome] = { 
          value: numValue, 
          count: 1, 
          label: trend.RomeLabel 
        };
      }
    });

    // For embauche, demandeur, demandeur_entrant: keep sum (these are counts)
    // For tension, dynamique_emploi: calculate average (these are indices/rates)
    const sumTypes = ['embauche', 'demandeur', 'demandeur_entrant'];
    if (!sumTypes.includes(dataSource)) {
      // Calculate average for indices/rates
      Object.values(aggregated).forEach(region => {
        if (region.count > 0) {
          region.value = region.value / region.count;
        }
      });
    }
    // For sum types, keep the accumulated sum as-is

    return Object.values(aggregated);
  }, [trends, selectedMetier, dataSource]);

  // Combined region data for 'all' mode - one entry per type per region
  interface MultiTypeRegionData {
    regionCode: string;
    regionName: string;
    coords: [number, number];
    typeData: Array<{
      type: DataSourceType;
      value: number;
      count: number;
      color: string;
      label: string;
    }>;
  }
  
  const multiTypeRegionData = useMemo((): MultiTypeRegionData[] => {
    if (dataSource !== 'all') return [];
    
    // Aggregate by region and type
    const aggregated: Record<string, Record<string, { value: number; count: number }>> = {};
    
    // Initialize all regions
    Object.keys(REGIONS_INFO).forEach(regionCode => {
      aggregated[regionCode] = {};
    });
    
    // Add all trends data by type (including 'offre' for job offers)
    trends.forEach(trend => {
      const regionCode = trend.RegionCode;
      const trendType = trend.Type;
      if (!regionCode || !REGIONS_INFO[regionCode] || !trendType) return;
      
      if (!aggregated[regionCode][trendType]) {
        aggregated[regionCode][trendType] = { value: 0, count: 0 };
      }
      // Convert Value to number (PostgreSQL DECIMAL returns string)
      const numValue = typeof trend.Value === 'string' ? parseFloat(trend.Value) : (trend.Value || 0);
      if (!isNaN(numValue)) {
        aggregated[regionCode][trendType].value += numValue;
        aggregated[regionCode][trendType].count += 1;
      }
    });
    
    // Determine which types need averaging (indices/rates vs counts)
    const sumTypes = ['embauche', 'demandeur', 'demandeur_entrant', 'offres'];
    
    // Convert to array format with type info
    return Object.entries(aggregated)
      .filter(([regionCode]) => REGIONS_INFO[regionCode])
      .map(([regionCode, types]) => {
        const typeData = Object.entries(types)
          .filter(([, data]) => data.count > 0)
          .map(([type, data]) => {
            const option = DATA_SOURCE_OPTIONS.find(o => o.value === type);
            // For sum types (counts), keep raw value; for index types, calculate average
            const displayValue = sumTypes.includes(type) 
              ? data.value 
              : (data.count > 0 ? data.value / data.count : 0);
            return {
              type: type as DataSourceType,
              value: displayValue,
              count: data.count,
              color: option?.color || 'gray',
              label: option?.label || type
            };
          });
        
        return {
          regionCode,
          regionName: REGIONS_INFO[regionCode].name,
          coords: REGIONS_INFO[regionCode].coords,
          typeData
        };
      })
      .filter(r => r.typeData.length > 0);
  }, [trends, dataSource]);

  // Legacy combined data for stats (keep for compatibility)
  const combinedRegionData = useMemo(() => {
    if (dataSource !== 'all') return [];
    return multiTypeRegionData.map(r => ({
      code: r.regionCode,
      name: r.regionName,
      value: r.typeData.reduce((sum, t) => sum + t.value, 0),
      count: r.typeData.reduce((sum, t) => sum + t.count, 0),
      romeBreakdown: {} as Record<string, { value: number; count: number; label?: string }>,
      coords: r.coords
    }));
  }, [multiTypeRegionData, dataSource]);

  // Get current region data based on source
  const currentRegionData = useMemo(() => {
    if (dataSource === 'all') return combinedRegionData;
    return dataSource === 'offres' ? jobRegionData : trendRegionData;
  }, [dataSource, jobRegionData, trendRegionData, combinedRegionData]);

  // Sync selectedRegion with currentRegionData when data changes
  // This ensures the romeBreakdown is always up-to-date with current filters
  useEffect(() => {
    if (selectedRegion) {
      const updatedRegion = currentRegionData.find(r => r.code === selectedRegion.code);
      if (updatedRegion && updatedRegion !== selectedRegion) {
        setSelectedRegion(updatedRegion);
      } else if (!updatedRegion) {
        setSelectedRegion(null);
      }
    }
  }, [currentRegionData, selectedRegion]);

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    if (dataSource === 'all') {
      return Math.max(...combinedRegionData.map(r => r.count), 1);
    }
    if (dataSource === 'offres') {
      return Math.max(...jobRegionData.map(r => r.totalJobs), 1);
    }
    return Math.max(...trendRegionData.map(r => r.value), 1);
  }, [jobRegionData, trendRegionData, combinedRegionData, dataSource]);

  // Calculate totals based on data source
  // For embauche, demandeur, demandeur_entrant: sum (these are counts)
  // For tension, dynamique_emploi: average (these are indices/rates)
  // IMPORTANT: For averages, use total number of data points (count), not number of regions
  const totalValue = useMemo(() => {
    if (dataSource === 'all') {
      return combinedRegionData.reduce((sum, r) => sum + r.count, 0);
    }
    if (dataSource === 'offres') {
      return jobRegionData.reduce((sum: number, r: RegionData) => sum + r.totalJobs, 0);
    }
    const sumTypes = ['embauche', 'demandeur', 'demandeur_entrant'];
    if (sumTypes.includes(dataSource)) {
      // Sum for count-based types
      return trendRegionData.reduce((sum: number, r: TrendRegionData) => sum + r.value, 0);
    }
    // Average for index-based types (tension, dynamique_emploi)
    // Use total count of data points across all regions, not just number of regions
    const totalSum = trendRegionData.reduce((sum: number, r: TrendRegionData) => sum + r.value, 0);
    const totalCount = trendRegionData.reduce((sum: number, r: TrendRegionData) => sum + r.count, 0);
    return totalCount > 0 ? totalSum / totalCount : 0;
  }, [jobRegionData, trendRegionData, combinedRegionData, dataSource]);

  // Get top region
  const topRegion = useMemo(() => {
    if (dataSource === 'all' && combinedRegionData.length > 0) {
      return [...combinedRegionData].sort((a, b) => b.count - a.count)[0];
    }
    if (dataSource === 'offres' && jobRegionData.length > 0) {
      return [...jobRegionData].sort((a, b) => b.value - a.value)[0];
    }
    if (trendRegionData.length > 0) {
      return [...trendRegionData].sort((a, b) => b.value - a.value)[0];
    }
    return null;
  }, [jobRegionData, trendRegionData, combinedRegionData, dataSource]);

  // Get unique métiers count (all data now comes from trends)
  const uniqueMetiersCount = useMemo(() => {
    return new Set(trends.map(t => t.CodeRome).filter(Boolean)).size;
  }, [trends]);

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
            className="w-full md:w-64 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          >
            {DATA_SOURCE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MapPinIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('marketRadar.map.noData')}</h3>
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
              className="w-full md:w-64 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <SourceIcon className="h-5 w-5" />
            {t(`marketRadar.dataTypes.${dataSource}`)} {t('marketRadar.map.title').toLowerCase().replace('données ', '')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('marketRadar.map.subtitle')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Map with MapLibre */}
          <div className="relative flex-1 min-h-[500px]">
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
                      key={region.code}
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
            <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPinIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  {selectedRegion.name}
                </h4>
                <button
                  onClick={() => setSelectedRegion(null)}
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
                        onClick={() => {
                          setSelectedMetier(null);
                          setMetierFilter('');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {t('common.resetFilters')}
                      </button>
                    )}
                  </div>

                  {/* Selected métier indicator */}
                  {selectedMetier && (
                    <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-md border border-indigo-200 dark:border-indigo-700">
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">{t('marketRadar.map.activeFilter')} :</div>
                      <div className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                        {romeLabelsMap[selectedMetier] || selectedMetier}
                      </div>
                    </div>
                  )}
                  
                  {/* Métier filter */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder={t('marketRadar.map.searchMetier')}
                      value={metierFilter}
                      onChange={(e) => setMetierFilter(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dataSource === 'offres' && 'totalJobs' in selectedRegion ? (
                      // Job offers breakdown - now with metadata support via trends
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

                        return Object.entries((selectedRegion as RegionData).romeBreakdown)
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
                            const totalRegion = (selectedRegion as RegionData).totalJobs;
                            const percentage = totalRegion > 0 ? ((count as number) / totalRegion * 100).toFixed(1) : '0';
                            return (
                              <div key={rome} className="relative group">
                                <button
                                  onClick={() => trend ? handleMetierSelect(trend.id, rome) : setSelectedMetier(selectedMetier === rome ? null : rome)}
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
                                onClick={() => handleMetierSelect(trend.id, rome)}
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
                  
                  {/* Metadata details panel - shown when a métier is selected */}
                  {selectedMetier && (
                    <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                      {metadataLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <ArrowPathIcon className="h-4 w-4 animate-spin text-indigo-500" />
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Chargement des détails...</span>
                        </div>
                      ) : selectedTrendMetadata ? (
                        <TrendMetadataDisplay
                          metadata={selectedTrendMetadata.Metadata || null}
                          type={selectedTrendMetadata.Type}
                          value={selectedTrendMetadata.Value}
                          compact={true}
                        />
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Sélectionnez un métier pour voir les détails
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
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
