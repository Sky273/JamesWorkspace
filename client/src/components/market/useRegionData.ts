/**
 * useRegionData - Custom hook for aggregating market trend data by region
 * Extracted from FranceMapTab.tsx
 */

import { useMemo } from 'react';
import type { MarketTrend } from '../../services/marketRadarService';
import {
  REGIONS_INFO,
  DATA_SOURCE_OPTIONS,
  type DataSourceType,
  type RegionData,
  type TrendRegionData,
  type MultiTypeRegionData
} from './franceMap.types';

interface UseRegionDataParams {
  trends: MarketTrend[];
  dataSource: DataSourceType;
  selectedMetier: string | null;
}

interface UseRegionDataResult {
  jobRegionData: RegionData[];
  jobRegionDataFull: RegionData[];
  trendRegionData: TrendRegionData[];
  multiTypeRegionData: MultiTypeRegionData[];
  combinedRegionData: TrendRegionData[];
  currentRegionData: (RegionData | TrendRegionData)[];
  maxValue: number;
  totalValue: number;
  topRegion: RegionData | TrendRegionData | null;
  uniqueMetiersCount: number;
  dataFreshness: {
    newestDate: Date;
    oldestDate: Date;
    daysSinceNewest: number;
    quarterPeriod: string | null;
    status: 'fresh' | 'recent' | 'stale';
    totalRecords: number;
  } | null;
}

export function useRegionData({ trends, dataSource, selectedMetier }: UseRegionDataParams): UseRegionDataResult {
  // Aggregate job offers data by region (from trends with type='offre')
  // Each trend represents one métier in one region - avoid counting duplicates
  // This version is FILTERED by selectedMetier for map bubbles
  const jobRegionData = useMemo(() => {
    if (dataSource !== 'offres' && dataSource !== 'all') return [];
    
    const aggregated: Record<string, RegionData> = {};
    // Track unique region+rome combinations to avoid duplicates
    const seenCombinations = new Set<string>();
    
    // Filter trends for 'offre' type
    const offreTrends = trends.filter(t => t.Type === 'offre');
    // Filter by selectedMetier if set - this affects map bubbles
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

      // Value is pre-calculated during collection from metadata
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

  // Full job region data (NOT filtered by selectedMetier) - used for panel breakdown
  const jobRegionDataFull = useMemo(() => {
    if (dataSource !== 'offres' && dataSource !== 'all') return [];
    
    const aggregated: Record<string, RegionData> = {};
    const seenCombinations = new Set<string>();
    const offreTrends = trends.filter(t => t.Type === 'offre');

    offreTrends.forEach(trend => {
      const regionCode = trend.RegionCode;
      if (!regionCode || !REGIONS_INFO[regionCode]) return;

      const comboKey = `${regionCode}-${trend.CodeRome || 'unknown'}`;
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

      const jobCount = typeof trend.Value === 'string' ? parseFloat(trend.Value) : (trend.Value || 0);
      if (!isNaN(jobCount)) {
        aggregated[regionCode].totalJobs += jobCount;
        aggregated[regionCode].value = aggregated[regionCode].totalJobs;
        
        if (trend.CodeRome) {
          aggregated[regionCode].romeBreakdown[trend.CodeRome] = jobCount;
        }
      }
    });

    return Object.values(aggregated);
  }, [trends, dataSource]);

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
  // Note: jobRegionData and trendRegionData already filter by selectedMetier
  const currentRegionData = useMemo(() => {
    if (dataSource === 'all') return combinedRegionData;
    return dataSource === 'offres' ? jobRegionData : trendRegionData;
  }, [dataSource, jobRegionData, trendRegionData, combinedRegionData, selectedMetier]);

  // Calculate max value for scaling (recalculates when selectedMetier changes via jobRegionData/trendRegionData)
  const maxValue = useMemo(() => {
    if (dataSource === 'all') {
      return Math.max(...combinedRegionData.map(r => r.count), 1);
    }
    if (dataSource === 'offres') {
      return Math.max(...jobRegionData.map(r => r.totalJobs), 1);
    }
    return Math.max(...trendRegionData.map(r => r.value), 1);
  }, [jobRegionData, trendRegionData, combinedRegionData, dataSource, selectedMetier]);

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

  // Calculate data freshness info
  const dataFreshness = useMemo(() => {
    if (trends.length === 0) return null;
    
    // Get most recent and oldest collection dates
    const collectedDates = trends
      .map(t => t.CollectedAt)
      .filter(Boolean)
      .map(d => new Date(d as string).getTime());
    
    if (collectedDates.length === 0) return null;
    
    const newestDate = new Date(Math.max(...collectedDates));
    const oldestDate = new Date(Math.min(...collectedDates));
    const now = new Date();
    const daysSinceNewest = Math.floor((now.getTime() - newestDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get quarter period from first trend that has it
    const quarterPeriod = trends.find(t => t.QuarterPeriod)?.QuarterPeriod || null;
    
    // Determine freshness status
    let status: 'fresh' | 'recent' | 'stale';
    if (daysSinceNewest <= 7) {
      status = 'fresh';
    } else if (daysSinceNewest <= 30) {
      status = 'recent';
    } else {
      status = 'stale';
    }
    
    return {
      newestDate,
      oldestDate,
      daysSinceNewest,
      quarterPeriod,
      status,
      totalRecords: trends.length
    };
  }, [trends]);

  return {
    jobRegionData,
    jobRegionDataFull,
    trendRegionData,
    multiTypeRegionData,
    combinedRegionData,
    currentRegionData,
    maxValue,
    totalValue,
    topRegion,
    uniqueMetiersCount,
    dataFreshness
  };
}
