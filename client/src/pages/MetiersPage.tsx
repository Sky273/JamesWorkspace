/**
 * Metiers et Competences Page
 * Interface for querying Rome 4.0 API and managing IT metiers.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { collectITMetiers, getStoredMetiers, type Metier } from '../services/romeService';
import {
  MetiersCollectionOverlay,
  MetiersEmptyState,
  MetiersErrorAlert,
  MetiersListSection,
  MetiersLoadingState,
  MetiersPageHeader,
  MetiersSearchBar,
  MetiersStatsCards,
} from './MetiersPage.sections';
import { buildMetiersStats } from './MetiersPage.utils';

export default function MetiersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [metiers, setMetiers] = useState<Metier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMetiers, setExpandedMetiers] = useState<Set<string>>(new Set());
  const [collecting, setCollecting] = useState(false);
  const [collectingSuccess, setCollectingSuccess] = useState(false);

  const stats = useMemo(() => buildMetiersStats(metiers), [metiers]);

  const loadMetiers = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStoredMetiers(search ? { search } : undefined);
      setMetiers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('marketRadar.errors.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMetiers();
  }, [loadMetiers]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await loadMetiers(searchQuery);
  };

  const handleCollect = async () => {
    if (!isAdmin) return;

    try {
      setCollecting(true);
      setCollectingSuccess(false);
      setError(null);
      await collectITMetiers();
      setCollectingSuccess(true);
      setTimeout(() => navigate('/batch-jobs'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la collecte');
      setCollecting(false);
    }
  };

  const toggleMetierExpand = (codeRome: string) => {
    setExpandedMetiers((current) => {
      const next = new Set(current);
      if (next.has(codeRome)) next.delete(codeRome);
      else next.add(codeRome);
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadMetiers();
  };

  return (
    <>
      <MetiersCollectionOverlay
        collecting={collecting}
        collectingSuccess={collectingSuccess}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MetiersPageHeader
          isAdmin={isAdmin}
          collecting={collecting}
          onCollect={handleCollect}
        />

        <MetiersErrorAlert error={error} onClose={() => setError(null)} />

        <MetiersSearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearch={handleSearch}
          onClear={clearSearch}
        />

        <MetiersStatsCards stats={stats} />

        {loading ? (
          <MetiersLoadingState />
        ) : metiers.length === 0 ? (
          <MetiersEmptyState
            isAdmin={isAdmin}
            searchQuery={searchQuery}
            onCollect={handleCollect}
          />
        ) : (
          <MetiersListSection
            metiers={metiers}
            expandedMetiers={expandedMetiers}
            onToggle={toggleMetierExpand}
          />
        )}
      </div>
    </>
  );
}
