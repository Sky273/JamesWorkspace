/**
 * TemplatesPage Component
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentDuplicateIcon,
  StarIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  EyeIcon,
  XMarkIcon,
  SparklesIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger.frontend';
import { useTranslation } from 'react-i18next';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import { templateService } from '../utils/templateService';
import Pagination from '../components/Pagination';
import { SkeletonTemplateList } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';
import ExtractTemplateModal from '../components/ExtractTemplateModal';

interface Template {
  id: string;
  Name: string;
  Description?: string;
  HeaderContent?: string;
  TemplateContent?: string;
  FooterContent?: string;
  Stylesheet?: string;
  Status?: string;
  Popular?: boolean;
  Tags?: string[];
  FirmId?: string;
  FirmName?: string;
}

interface TemplateCardProps {
  template: Template;
  onDeleteClick: (template: Template) => void;
  onPreviewClick: (template: Template) => void;
  index: number;
}

interface Stats {
  total: number;
  popular: number;
}

const TemplateCard = ({ template, onDeleteClick, onPreviewClick, index }: TemplateCardProps): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleEditClick = (e: MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/templates/edit/${template.id}`);
  };

  return (
    <motion.div
      key={template.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
    >
      <div className="relative group cursor-pointer" onClick={() => onPreviewClick(template)}>
        <div className="h-48 bg-gray-50 dark:bg-gray-900 overflow-hidden">
          {template.Stylesheet && <style dangerouslySetInnerHTML={{ __html: template.Stylesheet }} />}
          <div className="p-3 text-xs transform scale-75 origin-top-left space-y-1" style={{ width: '133%' }}>
            {template.HeaderContent && <div dangerouslySetInnerHTML={createSafeHtml(template.HeaderContent)} />}
            <div dangerouslySetInnerHTML={createSafeHtml(template.TemplateContent || '')} />
            {template.FooterContent && <div dangerouslySetInnerHTML={createSafeHtml(template.FooterContent)} />}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 text-white">
            <EyeIcon className="w-6 h-6" />
            <span className="font-medium">{t('templates.card.preview')}</span>
          </div>
        </div>
        {template.Popular && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/80 dark:text-yellow-300 shadow">
              <StarIcon className="w-3 h-3" />
              {t('templates.card.popular')}
            </span>
          </div>
        )}
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

        {template.Tags && template.Tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.Tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{tag}</span>
            ))}
            {template.Tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">+{template.Tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleEditClick} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            <PencilSquareIcon className="w-4 h-4" />
            {t('templates.actions.edit')}
          </button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteClick(template); }} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors" title={t('templates.actions.delete')}>
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const TemplatesPage = (): JSX.Element => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('popular');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [mounted, setMounted] = useState<boolean>(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [, setHasMore] = useState<boolean>(false);
  const pageSize = 12;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchTemplates = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await templateService.getTemplatesPaginated({
        page: currentPage,
        pageSize,
        search: debouncedSearch
      });
      setTemplates(data.templates);
      setTotalCount(data.pagination.totalCount || data.templates.length);
      setHasMore(data.pagination.hasMore || false);
    } catch (err) {
      setError(t('templates.status.error'));
      toast.error(t('templates.status.error'));
      logger.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTemplates(); }, [currentPage, debouncedSearch]);

  // Calculate total pages (minimum 1 to avoid NaN)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize)) || 1;

  // Pagination handler
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const openDeleteConfirmModal = (template: Template): void => {
    setTemplateToDelete(template);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteConfirmModal = (): void => {
    setTemplateToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await templateService.deleteTemplate(templateToDelete.id);
      setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateToDelete.id));
      toast.success(t('templates.status.deleteSuccess'));
    } catch (err) {
      logger.error('Error deleting template:', err);
      toast.error(t('templates.status.deleteError'));
    } finally {
      setIsDeleting(false);
      closeDeleteConfirmModal();
    }
  };

  // Client-side sorting only (server handles filtering)
  const filteredTemplates = [...templates].sort((a, b) => {
    if (sortBy === 'popular') return (b.Popular ? 1 : 0) - (a.Popular ? 1 : 0);
    return a.Name.localeCompare(b.Name);
  });

  const stats: Stats = {
    total: totalCount,
    popular: templates.filter(t => t.Popular).length
  };

  if (!mounted) return <></>;

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <SkeletonTemplateList count={8} />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{t('templates.title')}</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{t('templates.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><DocumentTextIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('templates.stats.total')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg"><StarIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" /></div>
            <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('templates.stats.popular')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.popular}</div></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><DocumentDuplicateIcon className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
            <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('templates.stats.active')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{templates.length}</div></div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder={t('templates.searchPlaceholder')} value={searchTerm} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select value={sortBy} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)} className="appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 pl-3 pr-10 text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500">
                <option value="popular">{t('templates.sort.popular')}</option>
                <option value="name">{t('templates.sort.name')}</option>
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={fetchTemplates} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title={t('templates.refresh')}><ArrowPathIcon className="w-5 h-5" /></button>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title={t('common.resetFilters')}><XMarkIcon className="w-4 h-4" /><span className="hidden sm:inline">{t('common.resetFilters')}</span></button>
            )}
            <button onClick={() => setIsExtractModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors" title={t('templates.extract.title')}><SparklesIcon className="w-5 h-5" /><span className="hidden sm:inline">{t('templates.extract.buttonShort')}</span></button>
            <button onClick={() => navigate('/templates/new')} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"><PlusIcon className="w-5 h-5" />{t('templates.newTemplate')}</button>
          </div>
        </div>
      </div>

      {/* Top pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('templates.results')}
      />

      {error ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center"><p className="text-red-500 dark:text-red-400">{error}</p></div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('templates.status.empty')}</h3>
          <p className="text-gray-600 dark:text-gray-400">{searchTerm ? t('templates.noResults') : t('templates.createFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template, index) => (
            <TemplateCard key={template.id} template={template} index={index} onDeleteClick={openDeleteConfirmModal} onPreviewClick={setPreviewTemplate} />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('templates.results')}
      />

      {isDeleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('templates.delete.title')}</h3>
              <button onClick={closeDeleteConfirmModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-4">
              <p className="text-gray-700 dark:text-gray-300 mb-6">{t('templates.delete.message', { templateName: templateToDelete.Name })}</p>
              <div className="flex justify-end gap-3">
                <button onClick={closeDeleteConfirmModal} disabled={isDeleting} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">{t('common.cancel')}</button>
                <button onClick={handleConfirmDelete} disabled={isDeleting} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">{isDeleting ? t('templates.status.deleting') : t('common.delete')}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div><h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{previewTemplate.Name}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{previewTemplate.Description}</p></div>
              <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-auto max-h-[70vh] bg-gray-50 dark:bg-gray-900">
              {previewTemplate.Stylesheet && <style dangerouslySetInnerHTML={{ __html: previewTemplate.Stylesheet }} />}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
                {previewTemplate.HeaderContent && (
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('templates.editor.header.label')}</div>
                    <div dangerouslySetInnerHTML={createSafeHtml(previewTemplate.HeaderContent)} />
                  </div>
                )}
                <div>
                  {(previewTemplate.HeaderContent || previewTemplate.FooterContent) && (
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('templates.editor.content.label')}</div>
                  )}
                  <div dangerouslySetInnerHTML={createSafeHtml(previewTemplate.TemplateContent || '')} />
                </div>
                {previewTemplate.FooterContent && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('templates.editor.footer.label')}</div>
                    <div dangerouslySetInnerHTML={createSafeHtml(previewTemplate.FooterContent)} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setPreviewTemplate(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">{t('common.close')}</button>
              <button onClick={() => { navigate(`/templates/edit/${previewTemplate.id}`); setPreviewTemplate(null); }} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"><PencilSquareIcon className="w-4 h-4" />{t('templates.actions.edit')}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Extract Template Modal */}
      <ExtractTemplateModal
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
      />
    </motion.div>
  );
};

export default TemplatesPage;
