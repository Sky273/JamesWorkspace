import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useScopedViewRefresh } from '../../hooks/useScopedViewRefresh';
import {
  getTrends,
  getTrendsSummary,
  getTrendFilters,
  triggerTrendsCollection,
  triggerDynamicsCollection,
  type MarketTrend,
  type TrendsSummary,
  type TrendFilters,
} from '../../services/marketRadarService';
import { getStoredMetiers, type Metier } from '../../services/romeService';

export const MARKET_TRENDS_PAGE_SIZE = 20;

export function useMarketTrendsDashboard() {
  const refreshConsumerId = 'market-trends-dashboard';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [groupedTrends, setGroupedTrends] = useState<Record<string, MarketTrend[]> | null>(null);
  const [countsByType, setCountsByType] = useState<Record<string, number>>({});
  const [isGrouped, setIsGrouped] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<TrendFilters | null>(null);
  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectingSuccess, setCollectingSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [romeFilter, setRomeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadInitialData = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const filtersResponse = await getTrendFilters();
      if (filtersResponse.filters) {
        setFilters(filtersResponse.filters);
      }

      const [summaryResponse, metiersData] = await Promise.all([
        getTrendsSummary(),
        getStoredMetiers(),
      ]);
      setSummary(summaryResponse.summary);
      setMetiers(metiersData);
    } catch {
      setFilters({ types: [], regions: [], romeCodes: [] });
    } finally {
      setFiltersLoading(false);
    }
  }, []);

  const applyTrendsResponse = useCallback((response: Awaited<ReturnType<typeof getTrends>>) => {
    if (response.grouped) {
      setIsGrouped(true);
      setGroupedTrends(response.groupedTrends || {});
      setCountsByType(response.countsByType || {});
      setTrends([]);
      setTotalPages(1);
    } else {
      setIsGrouped(false);
      setGroupedTrends(null);
      setCountsByType({});
      setTrends(response.trends || []);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    }
    setTotalCount(response.totalCount);
  }, []);

  const loadTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrends({
        type: typeFilter || undefined,
        codeRome: romeFilter || undefined,
        regionCode: regionFilter || undefined,
        page: currentPage,
        pageSize: MARKET_TRENDS_PAGE_SIZE,
      });
      applyTrendsResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [applyTrendsResponse, currentPage, regionFilter, romeFilter, t, typeFilter]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendsResponse, summaryResponse, filtersResponse] = await Promise.all([
        getTrends({
          type: typeFilter || undefined,
          codeRome: romeFilter || undefined,
          regionCode: regionFilter || undefined,
          page: currentPage,
          pageSize: MARKET_TRENDS_PAGE_SIZE,
          forceRefresh: true,
        }),
        getTrendsSummary(true),
        getTrendFilters(true),
      ]);
      applyTrendsResponse(trendsResponse);
      setSummary(summaryResponse.summary);
      setFilters(filtersResponse.filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [applyTrendsResponse, currentPage, regionFilter, romeFilter, t, typeFilter]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (filtersLoading) {
      return;
    }
    void loadTrends();
  }, [filtersLoading, loadTrends]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['marketTrends', 'rome'],
    onRefresh: () => {
      void refreshAll();
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, regionFilter, romeFilter]);

  const romeLabelsMap = useMemo(
    () =>
      metiers.reduce<Record<string, string>>((acc, metier) => {
        acc[metier.CodeRome] = metier.Libelle;
        return acc;
      }, {}),
    [metiers]
  );

  const trendsByType = useMemo(() => {
    if (isGrouped && groupedTrends) {
      return groupedTrends;
    }

    return trends.reduce<Record<string, MarketTrend[]>>((acc, trend) => {
      if (!acc[trend.Type]) {
        acc[trend.Type] = [];
      }
      acc[trend.Type].push(trend);
      return acc;
    }, {});
  }, [groupedTrends, isGrouped, trends]);

  const handleCollect = useCallback(async () => {
    setError(null);
    setCollecting(true);
    try {
      await triggerTrendsCollection();
      setCollectingSuccess(true);
      setTimeout(() => navigate('/batch-jobs'), 1200);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de lancement de la collecte';
      setError(errorMessage);
      toast.error(errorMessage);
      setCollecting(false);
    }
  }, [navigate]);

  const handleCollectDynamics = useCallback(async () => {
    setError(null);
    setCollecting(true);
    try {
      await triggerDynamicsCollection();
      setCollectingSuccess(true);
      setTimeout(() => navigate('/batch-jobs'), 1200);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de lancement de la collecte DYN_1';
      setError(errorMessage);
      toast.error(errorMessage);
      setCollecting(false);
    }
  }, [navigate]);

  const resetFilters = useCallback(() => {
    setTypeFilter('');
    setRegionFilter('');
    setRomeFilter('');
  }, []);

  return {
    collecting,
    collectingSuccess,
    countsByType,
    currentPage,
    error,
    filters,
    filtersLoading,
    handleCollect,
    handleCollectDynamics,
    isGrouped,
    loading,
    refreshAll,
    regionFilter,
    resetFilters,
    romeFilter,
    romeLabelsMap,
    setCurrentPage,
    setRegionFilter,
    setRomeFilter,
    setTypeFilter,
    summary,
    totalCount,
    totalPages,
    trendsByType,
    typeFilter,
  };
}
