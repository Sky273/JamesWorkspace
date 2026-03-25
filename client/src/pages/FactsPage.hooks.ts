import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { getFacts, getFactsSummary, triggerSourceCollection, type FactsSummary, type MarketFact } from '../services/marketRadarService';
import { getStoredMetiers, type Metier } from '../services/romeService';
import { createLogger } from '../utils/logger.frontend';

const log = createLogger('FactsPage');

export type TabType = 'map' | 'data' | 'trends' | 'metiers';

export interface FactsStats {
  total: number;
  franceTravail: number;
  adzuna: number;
  totalJobs: number;
  uniqueRegions: number;
  uniqueKeywords: number;
}

interface UseFactsDashboardParams {
  navigate: NavigateFunction;
}

export const useFactsDashboard = ({ navigate }: UseFactsDashboardParams) => {
  const [facts, setFacts] = useState<MarketFact[]>([]);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectingSuccess, setCollectingSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [uniqueRegions, setUniqueRegions] = useState<string[]>([]);
  const [uniqueKeywords, setUniqueKeywords] = useState<string[]>([]);
  const [globalStats, setGlobalStats] = useState<FactsSummary | null>(null);

  const pageSize = 20;
  const isInitialMount = useRef(true);

  useEffect(() => {
    const loadMetiers = async () => {
      try {
        setMetiers(await getStoredMetiers());
      } catch (err) {
        log.warn('Failed to load metiers', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    };

    void loadMetiers();
  }, []);

  const reloadGlobalStats = useCallback(async () => {
    try {
      const response = await getFactsSummary();
      if (response.success) {
        setGlobalStats(response.summary);
      }
    } catch (err) {
      log.warn('Failed to reload global stats', { error: err instanceof Error ? err.message : 'Unknown' });
    }
  }, []);

  useEffect(() => {
    void reloadGlobalStats();
  }, [reloadGlobalStats]);

  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const response = await getFacts({ page: 1, pageSize: 1000 });
        setUniqueRegions([...new Set(response.facts.map((fact) => fact.Region).filter(Boolean))].sort() as string[]);
        setUniqueKeywords([...new Set(response.facts.map((fact) => fact.Keyword).filter(Boolean))].sort() as string[]);
      } catch (err) {
        log.warn('Failed to load filters data', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    };

    void loadFiltersData();
  }, []);

  const loadFacts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getFacts({
        source: sourceFilter || undefined,
        keyword: keywordFilter || undefined,
        region: regionFilter || undefined,
        page: currentPage,
        pageSize,
      });

      setFacts(response.facts);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.totalCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, keywordFilter, regionFilter, sourceFilter]);

  useEffect(() => {
    void loadFacts();
  }, [loadFacts]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setCurrentPage(1);
  }, [keywordFilter, regionFilter, sourceFilter]);

  const handleCollect = useCallback(async (source: 'france_travail' | 'adzuna') => {
    setCollecting(true);
    setCollectingSuccess(false);
    setError(null);

    try {
      await triggerSourceCollection(source);
      setCollectingSuccess(true);
      setTimeout(() => navigate('/batch-jobs'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collection failed');
      setCollecting(false);
    }
  }, [navigate]);

  const clearFilters = useCallback(() => {
    setKeywordFilter('');
    setRegionFilter('');
  }, []);

  const romeLabelsMap = useMemo(
    () => metiers.reduce<Record<string, string>>((acc, metier) => {
      acc[metier.CodeRome] = metier.Libelle;
      return acc;
    }, {}),
    [metiers]
  );

  const stats = useMemo<FactsStats>(() => ({
    total: globalStats?.totalRecords ?? totalCount,
    franceTravail:
      globalStats?.sources?.find((source) => source.source === 'france_travail')?.count ??
      facts.filter((fact) => fact.Source === 'france_travail').length,
    adzuna:
      globalStats?.sources?.find((source) => source.source === 'adzuna')?.count ??
      facts.filter((fact) => fact.Source === 'adzuna').length,
    totalJobs: globalStats?.totalJobs ?? facts.reduce((sum, fact) => sum + (fact.JobCount || 0), 0),
    uniqueRegions: globalStats?.totalRegions ?? new Set(facts.map((fact) => fact.Region).filter(Boolean)).size,
    uniqueKeywords: globalStats?.totalKeywords ?? new Set(facts.map((fact) => fact.Keyword).filter(Boolean)).size,
  }), [facts, globalStats, totalCount]);

  return {
    facts,
    loading,
    collecting,
    collectingSuccess,
    error,
    sourceFilter,
    setSourceFilter,
    keywordFilter,
    setKeywordFilter,
    regionFilter,
    setRegionFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    totalCount,
    pageSize,
    uniqueRegions,
    uniqueKeywords,
    romeLabelsMap,
    stats,
    handleCollect,
    clearFilters,
  };
};
