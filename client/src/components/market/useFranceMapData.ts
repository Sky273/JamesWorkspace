import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAllTrends, getTrendMetadata, type MarketTrend } from '../../services/marketRadarService';
import { getStoredMetiers, type Metier } from '../../services/romeService';
import logger from '../../utils/logger.frontend';
import type { DataSourceType } from './franceMap.types';

export const useFranceMapData = (dataSource: DataSourceType) => {
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const trendType = dataSource === 'all' ? undefined : dataSource === 'offres' ? 'offre' : dataSource;
      const [trendsResponse, metiersData] = await Promise.all([
        trendType ? getAllTrends(trendType) : getAllTrends(),
        getStoredMetiers(),
      ]);

      setTrends(trendsResponse.trends);
      setMetiers(metiersData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const romeLabelsMap = useMemo(
    () =>
      metiers.reduce<Record<string, string>>((accumulator, metier) => {
        if (metier.CodeRome && metier.Libelle) {
          accumulator[metier.CodeRome] = metier.Libelle;
        }
        return accumulator;
      }, {}),
    [metiers]
  );

  return {
    trends,
    metiers,
    loading,
    error,
    romeLabelsMap,
    reload: loadData,
  };
};

export const useTrendMetadata = ({
  dataSource,
  selectedMetier,
  selectedRegionCode,
  trends,
}: {
  dataSource: DataSourceType;
  selectedMetier: string | null;
  selectedRegionCode: string | undefined;
  trends: MarketTrend[];
}) => {
  const [selectedTrendMetadata, setSelectedTrendMetadata] = useState<MarketTrend | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [cache, setCache] = useState<Record<string, MarketTrend>>({});
  const [cacheKeys, setCacheKeys] = useState<string[]>([]);
  const cacheMaxSize = 50;

  const addToCache = useCallback((trendId: string, trend: MarketTrend) => {
    setCache((current) => ({ ...current, [trendId]: trend }));
    setCacheKeys((current) => {
      const filtered = current.filter((key) => key !== trendId);
      const nextKeys = [...filtered, trendId];
      if (nextKeys.length <= cacheMaxSize) {
        return nextKeys;
      }
      const [oldestKey, ...rest] = nextKeys;
      setCache((currentCache) => {
        const nextCache = { ...currentCache };
        delete nextCache[oldestKey];
        return nextCache;
      });
      return rest;
    });
  }, []);

  const getFromCache = useCallback(
    (trendId: string) => {
      const trend = cache[trendId];
      if (!trend) {
        return undefined;
      }

      setCacheKeys((current) => [...current.filter((key) => key !== trendId), trendId]);
      return trend;
    },
    [cache]
  );

  const loadTrendMetadata = useCallback(
    async (trendId: string) => {
      if (!trendId) {
        setSelectedTrendMetadata(null);
        return;
      }

      const cached = getFromCache(trendId);
      if (cached) {
        setSelectedTrendMetadata(cached);
        return;
      }

      setMetadataLoading(true);
      try {
        const response = await getTrendMetadata(trendId);
        if (response.success && response.trend) {
          addToCache(trendId, response.trend);
          setSelectedTrendMetadata(response.trend);
        } else {
          setSelectedTrendMetadata(null);
        }
      } catch (error) {
        logger.error('[FranceMap] Failed to load trend metadata:', error);
        setSelectedTrendMetadata(null);
      } finally {
        setMetadataLoading(false);
      }
    },
    [addToCache, getFromCache]
  );

  useEffect(() => {
    setSelectedTrendMetadata(null);
    setCache({});
    setCacheKeys([]);
  }, [dataSource]);

  useEffect(() => {
    if (!selectedRegionCode || !selectedMetier) {
      setSelectedTrendMetadata(null);
      return;
    }

    const trendType = dataSource === 'offres' ? 'offre' : dataSource;
    const trendForRegion = trends.find(
      (trend) =>
        trend.CodeRome === selectedMetier &&
        trend.RegionCode === selectedRegionCode &&
        (dataSource === 'all' || trend.Type === trendType)
    );

    if (!trendForRegion) {
      setSelectedTrendMetadata(null);
      return;
    }

    void loadTrendMetadata(trendForRegion.id);
  }, [dataSource, loadTrendMetadata, selectedMetier, selectedRegionCode, trends]);

  return {
    selectedTrendMetadata,
    metadataLoading,
    loadTrendMetadata,
    resetMetadata: () => setSelectedTrendMetadata(null),
  };
};
