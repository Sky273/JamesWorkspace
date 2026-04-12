import { FolderIcon, ListBulletIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import PaginationPair from '../components/page/PaginationPair';
import ViewModeToggle from '../components/page/ViewModeToggle';
import ExportModal from './AdaptationsPage_ExportModal';
import { AdaptationCard, AdaptationsDealsGroupedView, SearchAndFilters, StatsCards } from '../components/AdaptationsPage';
import { SkeletonAdaptationList } from '../components/ui/Skeleton';
import {
  ADAPTATIONS_PAGE_SIZE,
  type Adaptation,
  type AdaptationStats,
  type AdaptationsViewMode,
  type Template,
} from './AdaptationsPage.hooks';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';

export function AdaptationsHeader() {
  const { t } = useTranslation();

  return <PageHeader title={t('adaptations.title')} subtitle={t('adaptations.subtitle')} />;
}

export function AdaptationsViewModeToggle({
  onChange,
  value,
}: {
  onChange: (mode: AdaptationsViewMode) => void;
  value: AdaptationsViewMode;
}) {
  const { t } = useTranslation();

  return (
    <ViewModeToggle
      label={t('adaptations.viewMode', 'Affichage')}
      onChange={onChange}
      options={[
        { icon: FolderIcon, label: t('adaptations.viewByDeal', 'Par affaire'), value: 'byDeal' },
        { icon: ListBulletIcon, label: t('adaptations.viewList', 'Liste'), value: 'list' },
      ]}
      value={value}
    />
  );
}

export function AdaptationsListPanel({
  adaptations,
  clearFilters,
  currentPage,
  filterStatus,
  getMissionTitle,
  getResumeName,
  loading,
  onDelete,
  onExport,
  onOpen,
  onRefresh,
  onSearchChange,
  onStatusChange,
  searchTerm,
  stats,
  totalCount,
  totalPages,
  goToPage,
}: {
  adaptations: Adaptation[];
  clearFilters: () => void;
  currentPage: number;
  filterStatus: string;
  getMissionTitle: (adaptation: Adaptation) => string;
  getResumeName: (adaptation: Adaptation) => string;
  goToPage: (page: number) => void;
  loading: boolean;
  onDelete: (adaptationId: string) => Promise<void>;
  onExport: (adaptation: Adaptation) => void;
  onOpen: (adaptationId: string) => void;
  onRefresh: () => Promise<void>;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  searchTerm: string;
  stats: AdaptationStats;
  totalCount: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <>
      <StatsCards stats={stats} t={t} />
      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        filterStatus={filterStatus}
        onFilterChange={onStatusChange}
        onRefresh={() => {
          void onRefresh();
        }}
        onReset={clearFilters}
        t={t}
      />

      <PaginationPair
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={ADAPTATIONS_PAGE_SIZE}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('adaptations.results')}
      />

      <AdaptationsGrid
        adaptations={adaptations}
        filterStatus={filterStatus}
        getMissionTitle={getMissionTitle}
        getResumeName={getResumeName}
        loading={loading}
        onDelete={onDelete}
        onExport={onExport}
        onOpen={onOpen}
        searchTerm={searchTerm}
      />
    </>
  );
}

function AdaptationsGrid({
  adaptations,
  filterStatus,
  getMissionTitle,
  getResumeName,
  loading,
  onDelete,
  onExport,
  onOpen,
  searchTerm,
}: {
  adaptations: Adaptation[];
  filterStatus: string;
  getMissionTitle: (adaptation: Adaptation) => string;
  getResumeName: (adaptation: Adaptation) => string;
  loading: boolean;
  onDelete: (adaptationId: string) => Promise<void>;
  onExport: (adaptation: Adaptation) => void;
  onOpen: (adaptationId: string) => void;
  searchTerm: string;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <SkeletonAdaptationList count={6} />;
  }

  if (adaptations.length === 0) {
    return (
      <EmptyStateCard
        icon={SparklesIcon}
        title={t('adaptations.noAdaptations')}
        description={searchTerm || filterStatus !== 'all' ? t('adaptations.noAdaptationsFiltered') : t('adaptations.noAdaptationsPrompt')}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {adaptations.map((adaptation, index) => (
        <AdaptationCard
          key={adaptation.id}
          adaptation={adaptation}
          index={index}
          resumeName={getResumeName(adaptation)}
          candidateName={adaptation['Candidate Name'] as string | undefined}
          adaptedTitle={adaptation['Adapted Title'] as string | undefined}
          missionTitle={getMissionTitle(adaptation)}
          onView={() => onOpen(adaptation.id)}
          onExport={onExport}
          onDelete={(adaptationId) => {
            void onDelete(adaptationId);
          }}
          t={t}
        />
      ))}
    </div>
  );
}

export function AdaptationsByDealView({ refreshToken }: { refreshToken: number }) {
  return <AdaptationsDealsGroupedView refreshToken={refreshToken} />;
}

export function AdaptationsExportDialog({
  adaptation,
  isLoading,
  isOpen,
  loadingTemplates,
  onClose,
  onConfirm,
  selectedFormat,
  selectedTemplate,
  setSelectedFormat,
  setSelectedTemplate,
  templates,
}: {
  adaptation: Adaptation | null;
  isLoading: boolean;
  isOpen: boolean;
  loadingTemplates: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  selectedFormat: ExportFormat;
  selectedTemplate: string;
  setSelectedFormat: (value: ExportFormat) => void;
  setSelectedTemplate: (value: string) => void;
  templates: Template[];
}) {
  return (
    <ExportModal
      show={isOpen && Boolean(adaptation)}
      onClose={onClose}
      templates={templates}
      selectedTemplate={selectedTemplate}
      setSelectedTemplate={setSelectedTemplate}
      selectedFormat={selectedFormat}
      setSelectedFormat={setSelectedFormat}
      onConfirm={() => {
        void onConfirm();
      }}
      loading={isLoading}
      loadingTemplates={loadingTemplates}
    />
  );
}
