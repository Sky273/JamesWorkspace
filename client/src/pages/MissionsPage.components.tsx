import { FolderIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import PageHeader from '../components/page/PageHeader';
import ViewModeToggle from '../components/page/ViewModeToggle';
import Pagination from '../components/Pagination';
import {
  MissionCardInDeal,
  MissionsGroupedEmptyState,
  MissionsGroupedToolbar,
} from '../components/MissionsPage/MissionsDealsGroupedView.parts';
import MissionsDealsGroupedView from '../components/MissionsPage/MissionsDealsGroupedView';
import type { GroupedMission } from '../components/MissionsPage/MissionsDealsGroupedView.types';
import { SkeletonMissionList } from '../components/ui/Skeleton';
import type { Mission, MissionViewMode } from './MissionsPage.hooks';
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
      className="cv-view-toggle-row"
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
  totalCount: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <>
      <MissionsGrid
        canDeleteMission={canDeleteMission}
        currentPage={currentPage}
        loading={loading}
        missions={missions}
        onAddMission={onAddMission}
        onDelete={onDelete}
        onEdit={onEdit}
        onPageChange={onPageChange}
        onRefresh={onRefresh}
        onResetSearch={onResetSearch}
        onSearchChange={onSearchChange}
        searchTerm={searchTerm}
        totalCount={totalCount}
        totalPages={totalPages}
      />
    </>
  );
}

function toGroupedMission(mission: Mission): GroupedMission {
  return {
    id: mission.id,
    title: mission.Title || '',
    content: mission.Content || undefined,
    status: mission.Status || 'Active',
    keywords: (mission['Keywords'] as string | undefined) || undefined,
    created_at: (mission['Created At'] as string | undefined) || '',
    updated_at: (mission['Updated At'] as string | undefined) || undefined,
    firm: mission.Firm || undefined,
    client_id: (mission['Client ID'] as string | undefined) || undefined,
    contact_id: (mission['Contact ID'] as string | undefined) || undefined,
    client_name: (mission['Client Name'] as string | undefined) || undefined,
    client_type: (mission['Client Type'] as string | undefined) || undefined,
    contact_name: (mission['Contact Name'] as string | undefined) || undefined,
    contact_email: (mission['Contact Email'] as string | undefined) || undefined,
    contact_role: (mission['Contact Role'] as string | undefined) || undefined,
    adaptations_count: Number(mission['Adaptations Count'] || 0),
    submissions_count: Number(mission['Submissions Count'] || 0),
    pipeline_count: Number(mission['Pipeline Count'] || 0),
    has_attached_elements: Boolean(mission['Has Attachments']),
  };
}

function MissionsGrid({
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
  totalCount: number;
  totalPages: number;
}) {
  const { t } = useTranslation();
  const groupedMissions = missions.map(toGroupedMission);
  const hasSearch = searchTerm.trim() !== '';

  if (loading) {
    return (
      <div className="space-y-5">
        <MissionsGroupedToolbar
          onAddMission={onAddMission}
          onRefresh={() => {
            void onRefresh();
          }}
          searchQuery={searchTerm}
          setSearchQuery={onSearchChange}
          totalMissions={totalCount}
          dealCount={0}
          visibleCount={missions.length}
        />
        <div className="cv-panel rounded-[2rem] p-5 sm:p-6">
          <SkeletonMissionList count={6} />
        </div>
      </div>
    );
  }

  if (groupedMissions.length === 0) {
    return (
      <div className="space-y-5">
        <MissionsGroupedToolbar
          onAddMission={onAddMission}
          onRefresh={() => {
            void onRefresh();
          }}
          searchQuery={searchTerm}
          setSearchQuery={onSearchChange}
          totalMissions={totalCount}
          dealCount={0}
          visibleCount={0}
        />
        <MissionsGroupedEmptyState
          hasSearch={hasSearch}
          onAddMission={onAddMission}
          onClearSearch={onResetSearch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MissionsGroupedToolbar
        onAddMission={onAddMission}
        onRefresh={() => {
          void onRefresh();
        }}
        searchQuery={searchTerm}
        setSearchQuery={onSearchChange}
        totalMissions={totalCount}
        dealCount={0}
        visibleCount={groupedMissions.length}
      />

      <div className="space-y-3">
        {groupedMissions.map((mission, index) => (
          <MissionCardInDeal
            key={mission.id}
            mission={mission}
            index={index}
            canDelete={canDeleteMission(missions[index])}
            onEdit={() => { onEdit(missions[index]); }}
            onDelete={() => { onDelete(missions[index]); }}
          />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={MISSIONS_PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('missions.results')}
      />
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
