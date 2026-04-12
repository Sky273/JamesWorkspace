import { BriefcaseIcon, FolderIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import ViewModeToggle from '../components/page/ViewModeToggle';
import Pagination from '../components/Pagination';
import { MissionsDealsGroupedView, SearchAndActions, StatsCards } from '../components/MissionsPage';
import type { GroupedMission } from '../components/MissionsPage/MissionsDealsGroupedView.types';
import { SkeletonMissionList } from '../components/ui/Skeleton';
import MissionCard from './MissionCard';
import type { Mission, MissionStats, MissionViewMode } from './MissionsPage.hooks';
import { MISSIONS_PAGE_SIZE } from './MissionsPage.hooks';

export function MissionsHeader() {
  const { t } = useTranslation();

  return <PageHeader title={t('missions.title')} subtitle={t('missions.subtitle')} />;
}

export function MissionsViewModeToggle({
  onChange,
  value,
}: {
  onChange: (mode: MissionViewMode) => void;
  value: MissionViewMode;
}) {
  const { t } = useTranslation();

  return (
    <ViewModeToggle
      label={t('missions.viewMode', 'Affichage')}
      onChange={onChange}
      options={[
        { icon: FolderIcon, label: t('missions.viewByDeal', 'Par affaire'), value: 'byDeal' },
        { icon: ListBulletIcon, label: t('missions.viewList', 'Liste'), value: 'list' },
      ]}
      value={value}
    />
  );
}

export function MissionsListPanel({
  canDeleteMission,
  currentPage,
  loading,
  missions,
  onAddMission,
  onDelete,
  onEdit,
  onPageChange,
  onRefresh,
  onResetSearch,
  onSearchChange,
  searchTerm,
  stats,
  totalCount,
  totalPages,
}: {
  canDeleteMission: (mission: Mission | null | undefined) => boolean;
  currentPage: number;
  loading: boolean;
  missions: Mission[];
  onAddMission: () => void;
  onDelete: (mission: Mission) => void;
  onEdit: (mission: Mission) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => Promise<void>;
  onResetSearch: () => void;
  onSearchChange: (value: string) => void;
  searchTerm: string;
  stats: MissionStats;
  totalCount: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <>
      <StatsCards stats={stats} missionsCount={totalCount} t={t} />
      <SearchAndActions
        searchTerm={searchTerm}
        resultsLabel={
          searchTerm
            ? `${totalCount} ${t('missions.results')} · “${searchTerm}”`
            : `${totalCount} ${t('missions.results')}`
        }
        onSearchChange={onSearchChange}
        onRefresh={() => {
          void onRefresh();
        }}
        onAddMission={onAddMission}
        onReset={onResetSearch}
        t={t}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={MISSIONS_PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('missions.results')}
      />

      <MissionsGrid
        canDeleteMission={canDeleteMission}
        loading={loading}
        missions={missions}
        onAddMission={onAddMission}
        onDelete={onDelete}
        onEdit={onEdit}
        searchTerm={searchTerm}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={MISSIONS_PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('missions.results')}
      />
    </>
  );
}

function MissionsGrid({
  canDeleteMission,
  loading,
  missions,
  onAddMission,
  onDelete,
  onEdit,
  searchTerm,
}: {
  canDeleteMission: (mission: Mission | null | undefined) => boolean;
  loading: boolean;
  missions: Mission[];
  onAddMission: () => void;
  onDelete: (mission: Mission) => void;
  onEdit: (mission: Mission) => void;
  searchTerm: string;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <SkeletonMissionList count={6} />;
  }

  if (missions.length === 0) {
    return (
      <EmptyStateCard
        icon={BriefcaseIcon}
        title={t('missions.noMissions')}
        description={searchTerm ? t('missions.noResults') : t('missions.createFirst')}
        containerClassName="cv-panel rounded-[2rem] p-12 text-center"
        action={
          <button
            onClick={onAddMission}
            className="cv-gradient-button mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-semibold"
          >
            {t('missions.addMission')}
          </button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
      {missions.map((mission, index) => (
        <MissionCard
          key={mission.id}
          canDelete={canDeleteMission(mission)}
          mission={mission}
          index={index}
          onEdit={onEdit}
          onDelete={() => {
            onDelete(mission);
          }}
        />
      ))}
    </div>
  );
}

export function MissionsByDealView({
  onAddMission,
  onEditMission,
  onDeleteMission,
  refreshToken,
}: {
  onAddMission: () => void;
  onEditMission: (mission: GroupedMission) => void;
  onDeleteMission: (mission: GroupedMission) => void;
  refreshToken: number;
}) {
  return (
    <MissionsDealsGroupedView
      onAddMission={onAddMission}
      onEditMission={onEditMission}
      onDeleteMission={onDeleteMission}
      refreshToken={refreshToken}
    />
  );
}
