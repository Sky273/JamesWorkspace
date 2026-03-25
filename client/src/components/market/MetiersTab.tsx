/**
 * MetiersTab - Metiers et Competences Tab for Market Radar
 */

import { useAuth } from '../../context/AuthContext';

import {
  MetiersCollectionOverlay,
  MetiersHeader,
  MetiersResults,
  MetiersSearchBar,
  MetiersStatsCards,
} from './MetiersTab.components';
import { useMetiersDashboard } from './useMetiersDashboard';

interface MetiersTabProps {
  className?: string;
}

export default function MetiersTab({ className = '' }: MetiersTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const dashboard = useMetiersDashboard(isAdmin);

  return (
    <>
      <MetiersCollectionOverlay collecting={dashboard.collecting} collectingSuccess={dashboard.collectingSuccess} />

      <div className={`space-y-6 ${className}`}>
        <MetiersHeader
          error={dashboard.error}
          isAdmin={isAdmin}
          loading={dashboard.loading}
          onClearError={() => dashboard.setError(null)}
          onCollect={dashboard.handleCollect}
          onRefresh={dashboard.refreshAll}
        />

        <MetiersSearchBar
          searchQuery={dashboard.searchQuery}
          onSearchQueryChange={dashboard.setSearchQuery}
          onSubmit={dashboard.handleSearchSubmit}
          onClear={dashboard.clearSearch}
        />

        <MetiersStatsCards
          globalStats={dashboard.globalStats}
          totalCount={dashboard.totalCount}
          latestUpdated={dashboard.metiers[0]?.LastUpdated}
        />

        <MetiersResults
          currentPage={dashboard.currentPage}
          expandedMetiers={dashboard.expandedMetiers}
          isAdmin={isAdmin}
          loading={dashboard.loading}
          metiers={dashboard.metiers}
          searchQuery={dashboard.searchQuery}
          totalCount={dashboard.totalCount}
          totalPages={dashboard.totalPages}
          onCollect={dashboard.handleCollect}
          onPageChange={dashboard.setCurrentPage}
          onToggleExpand={dashboard.toggleMetierExpand}
        />
      </div>
    </>
  );
}
