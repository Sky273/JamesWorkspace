import { lazy, Suspense, type MouseEvent } from 'react';
import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Firm } from './UsersManagement.hooks';

import CardActionButton from '../components/page/CardActionButton';
import AnimatedCard from '../components/page/AnimatedCard';
import ConfirmDialog from '../components/page/ConfirmDialog';
import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import PaginationPair from '../components/page/PaginationPair';
import SearchField from '../components/page/SearchField';
import StatCardsGrid from '../components/page/StatCardsGrid';
import { SkeletonTemplateList } from '../components/ui/Skeleton';
import { TEMPLATES_PAGE_SIZE, type Template, type TemplateSort, type TemplateStats } from './TemplatesPage.hooks';

const ExtractTemplateModal = lazy(() => import('../components/ExtractTemplateModal'));
const TemplatePreviewFrame = lazy(() => import('../components/TemplatePreviewFrame'));

function TemplateCard({
  canDuplicate,
  index,
  onDuplicateClick,
  onDeleteClick,
  onPreviewClick,
  template,
}: {
  canDuplicate: boolean;
  index: number;
  onDuplicateClick: (template: Template) => void;
  onDeleteClick: (template: Template) => void;
  onPreviewClick: (template: Template) => void;
  template: Template;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleEditClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(`/templates/edit/${template.id}`);
  };

  return (
    <AnimatedCard index={index} className="shadow-md overflow-hidden">
      <div className="relative group cursor-pointer" onClick={() => onPreviewClick(template)}>
        <div className="h-48 bg-gray-50 dark:bg-gray-900 overflow-hidden">
          <Suspense fallback={<div className="flex h-full min-h-48 items-center justify-center text-xs text-gray-400 dark:text-gray-500">Chargement de l'apercu...</div>}>
          <TemplatePreviewFrame
            title={template.Name}
            stylesheet={template.Stylesheet}
            headerContent={template.HeaderContent}
            templateContent={template.TemplateContent || ''}
            footerContent={template.FooterContent}
            className="h-full w-full border-0 bg-white pointer-events-none"
            scale={0.75}
          />
          </Suspense>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 text-white">
            <EyeIcon className="w-6 h-6" />
            <span className="font-medium">{t('templates.card.preview')}</span>
          </div>
        </div>
        {template.Popular ? (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/80 dark:text-yellow-300 shadow">
              <StarIcon className="w-3 h-3" />
              {t('templates.card.popular')}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{template.Name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              template.Status?.toLowerCase() === 'active'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {template.Status?.toLowerCase() === 'active'
                ? t('templates.editor.statusField.active')
                : t('templates.editor.statusField.inactive')}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{template.Description || t('templates.card.noDescription')}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            <span className="inline-flex items-center gap-1">
              <BuildingOfficeIcon className="w-3 h-3" />
              {template.FirmName || t('templates.card.global')}
            </span>
          </p>
        </div>

        {template.Tags && template.Tags.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.Tags.slice(0, 3).map((tag, tagIndex) => (
              <span key={`${template.id}-${tag}-${tagIndex}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {tag}
              </span>
            ))}
            {template.Tags.length > 3 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                +{template.Tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <CardActionButton icon={PencilSquareIcon} label={t('templates.actions.edit')} onClick={handleEditClick} className="btn btn-primary flex-1 px-3 py-2" tone="primary" />
          {canDuplicate ? (
            <CardActionButton
              icon={DocumentDuplicateIcon}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDuplicateClick(template);
              }}
              title={t('templates.actions.duplicate')}
              tone="info"
            />
          ) : null}
          <CardActionButton
            icon={TrashIcon}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDeleteClick(template);
            }}
            title={t('templates.actions.delete')}
            tone="danger"
          />
        </div>
      </div>
    </AnimatedCard>
  );
}

export function TemplatesHeader() {
  const { t } = useTranslation();

  return <PageHeader title={t('templates.title')} subtitle={t('templates.subtitle')} />;
}

export function TemplatesLoadingState() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
      <SkeletonTemplateList count={8} />
    </div>
  );
}

export function TemplatesStats({ stats }: { stats: TemplateStats }) {
  const { t } = useTranslation();

  return (
    <StatCardsGrid
      items={[
        {
          icon: DocumentTextIcon,
          iconBgClassName: 'bg-blue-100 dark:bg-blue-900/30',
          iconClassName: 'text-blue-600 dark:text-blue-400',
          label: t('templates.stats.total'),
          value: stats.total,
        },
        {
          icon: StarIcon,
          iconBgClassName: 'bg-yellow-100 dark:bg-yellow-900/30',
          iconClassName: 'text-yellow-600 dark:text-yellow-400',
          label: t('templates.stats.popular'),
          value: stats.popular,
        },
        {
          icon: DocumentDuplicateIcon,
          iconBgClassName: 'bg-green-100 dark:bg-green-900/30',
          iconClassName: 'text-green-600 dark:text-green-400',
          label: t('templates.stats.active'),
          value: stats.active,
        },
      ]}
    />
  );
}

export function TemplatesToolbar({
  onCreate,
  onExtract,
  onRefresh,
  onResetSearch,
  onSearchChange,
  onSortChange,
  searchTerm,
  sortBy,
}: {
  onCreate: () => void;
  onExtract: () => void;
  onRefresh: () => Promise<void>;
  onResetSearch: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: TemplateSort) => void;
  searchTerm: string;
  sortBy: TemplateSort;
}) {
  const { t } = useTranslation();

  return (
    <div className="section-shell mb-6 rounded-[2rem]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
        <SearchField value={searchTerm} onChange={onSearchChange} placeholder={t('templates.searchPlaceholder')} />
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as TemplateSort)}
              className="cv-search-input appearance-none rounded-2xl py-2.5 pl-3 pr-10 text-sm font-medium"
            >
              <option value="popular">{t('templates.sort.popular')}</option>
              <option value="name">{t('templates.sort.name')}</option>
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => void onRefresh()}
            className="app-button-secondary rounded-2xl p-2.5"
            title={t('templates.refresh')}
            aria-label={t('templates.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          {searchTerm ? (
            <button onClick={onResetSearch} className="app-button-secondary inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium" title={t('common.resetFilters')}><XMarkIcon className="w-4 h-4" /><span className="hidden sm:inline">{t('common.resetFilters')}</span></button>
          ) : null}
          <button onClick={onExtract} className="app-button-secondary flex items-center gap-2 rounded-2xl px-4 py-2.5" title={t('templates.extract.title')}><SparklesIcon className="w-5 h-5" /><span className="hidden sm:inline">{t('templates.extract.buttonShort')}</span></button>
          <button onClick={onCreate} className="app-button-primary flex items-center gap-2 rounded-2xl px-4 py-2.5"><PlusIcon className="w-5 h-5" />{t('templates.newTemplate')}</button>
        </div>
      </div>
    </div>
  );
}

export function TemplatesResults({
  canDuplicate,
  currentPage,
  error,
  loading,
  onDuplicateClick,
  onDeleteClick,
  onPageChange,
  onPreviewClick,
  searchTerm,
  templates,
  totalCount,
  totalPages,
}: {
  canDuplicate: boolean;
  currentPage: number;
  error: string | null;
  loading: boolean;
  onDuplicateClick: (template: Template) => void;
  onDeleteClick: (template: Template) => void;
  onPageChange: (page: number) => void;
  onPreviewClick: (template: Template) => void;
  searchTerm: string;
  templates: Template[];
  totalCount: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <>
      <PaginationPair
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={TEMPLATES_PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('templates.results')}
      />

      {error ? (
        <div className="section-shell rounded-[2rem] p-12 text-center"><p className="text-red-500 dark:text-red-400">{error}</p></div>
      ) : templates.length === 0 ? (
        <EmptyStateCard icon={DocumentTextIcon} title={t('templates.status.empty')} description={searchTerm ? t('templates.noResults') : t('templates.createFirst')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, index) => (
            <TemplateCard
              key={template.id}
              canDuplicate={canDuplicate}
              template={template}
              index={index}
              onDeleteClick={onDeleteClick}
              onDuplicateClick={onDuplicateClick}
              onPreviewClick={onPreviewClick}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function TemplatesDuplicateModal({
  firms,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  onFirmChange,
  selectedFirmId,
  template,
}: {
  firms: Firm[];
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onFirmChange: (firmId: string) => void;
  selectedFirmId: string;
  template: Template | null;
}) {
  const { t } = useTranslation();

  if (!isOpen || !template) {
    return null;
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        void onConfirm();
      }}
      disabled={isSubmitting || !selectedFirmId}
      title={t('templates.duplicate.title')}
      cancelLabel={t('common.cancel')}
      confirmLabel={isSubmitting ? t('common.saving') : t('templates.actions.duplicate')}
      content={(
        <div className="space-y-4">
          <p>{t('templates.duplicate.message', { templateName: template.Name })}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('templates.duplicate.targetFirm')}
            </label>
            <select
              value={selectedFirmId}
              onChange={(event) => onFirmChange(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">{t('templates.duplicate.selectFirm')}</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    />
  );
}

export function TemplatesDeleteModal({
  isDeleting,
  isOpen,
  onClose,
  onConfirm,
  template,
}: {
  isDeleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  template: Template | null;
}) {
  const { t } = useTranslation();

  if (!template) {
    return null;
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        void onConfirm();
      }}
      disabled={isDeleting}
      title={t('templates.delete.title')}
      cancelLabel={t('common.cancel')}
      confirmLabel={isDeleting ? t('templates.status.deleting') : t('common.delete')}
      content={<p>{t('templates.delete.message', { templateName: template.Name })}</p>}
    />
  );
}

export function TemplatesPreviewModal({
  onClose,
  onEdit,
  template,
}: {
  onClose: () => void;
  onEdit: (templateId: string) => void;
  template: Template | null;
}) {
  const { t } = useTranslation();

  if (!template) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{template.Name}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{template.Description}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="p-6 overflow-auto max-h-[70vh] bg-gray-50 dark:bg-gray-900">
          <div className="rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700">
            <Suspense fallback={<div className="flex h-full min-h-48 items-center justify-center text-xs text-gray-400 dark:text-gray-500">Chargement de l'apercu...</div>}>
          <TemplatePreviewFrame
              title={template.Name}
              stylesheet={template.Stylesheet}
              headerContent={template.HeaderContent}
              templateContent={template.TemplateContent || ''}
              footerContent={template.FooterContent}
              className="h-[60vh] w-full border-0 bg-white"
            />
          </Suspense>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">{t('common.close')}</button>
          <button onClick={() => onEdit(template.id)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"><PencilSquareIcon className="w-4 h-4" />{t('templates.actions.edit')}</button>
        </div>
      </motion.div>
    </div>
  );
}

export function TemplatesExtractDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Suspense fallback={null}>
      <ExtractTemplateModal isOpen={isOpen} onClose={onClose} />
    </Suspense>
  );
}
