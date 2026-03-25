import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  collectITMetiers,
  getMetiersStats,
  getStoredMetiersPaginated,
  type Metier,
  type MetiersStats,
} from '../../services/romeService';
import { createLogger } from '../../utils/logger.frontend';

const log = createLogger('MetiersTab');
export const METIERS_PAGE_SIZE = 20;

export function useMetiersDashboard(isAdmin: boolean) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMetiers, setExpandedMetiers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collectingSuccess, setCollectingSuccess] = useState(false);
  const [globalStats, setGlobalStats] = useState<MetiersStats | null>(null);

  const loadGlobalStats = useCallback(async () => {
    try {
      const stats = await getMetiersStats();
      setGlobalStats(stats);
    } catch (err) {
      log.warn('Failed to load global stats', { error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const loadMetiers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getStoredMetiersPaginated({
        search: searchQuery || undefined,
        page: currentPage,
        pageSize: METIERS_PAGE_SIZE,
      });
      setMetiers(response.metiers);
      setTotalCount(response.totalCount);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, t]);

  useEffect(() => {
    void loadGlobalStats();
  }, [loadGlobalStats]);

  useEffect(() => {
    void loadMetiers();
  }, [loadMetiers]);

  const handleCollect = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    try {
      setCollecting(true);
      setCollectingSuccess(false);
      setError(null);
      await collectITMetiers();
      setCollectingSuccess(true);
      setTimeout(() => navigate('/batch-jobs'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketRadar.facts.collection.error'));
      setCollecting(false);
    }
  }, [isAdmin, navigate, t]);

  const toggleMetierExpand = useCallback((codeRome: string) => {
    setExpandedMetiers((current) => {
      const next = new Set(current);
      if (next.has(codeRome)) {
        next.delete(codeRome);
      } else {
        next.add(codeRome);
      }
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  const handleSearchSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    setCurrentPage(1);
  }, []);

  const refreshAll = useCallback(() => {
    void loadMetiers();
    void loadGlobalStats();
  }, [loadGlobalStats, loadMetiers]);

  return {
    clearSearch,
    collecting,
    collectingSuccess,
    currentPage,
    error,
    expandedMetiers,
    globalStats,
    handleCollect,
    handleSearchSubmit,
    loading,
    metiers,
    refreshAll,
    searchQuery,
    setCurrentPage,
    setError,
    setSearchQuery,
    toggleMetierExpand,
    totalCount,
    totalPages,
  };
}
