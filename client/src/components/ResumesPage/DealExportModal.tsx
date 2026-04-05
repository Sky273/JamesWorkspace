import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  BriefcaseIcon,
  CheckIcon,
  DocumentTextIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { templateService, Template } from '../../utils/templateService';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';

interface DealExportModalProps {
  dealId: string;
  dealTitle: string;
  resumeCount: number;
  adaptationCount: number;
  onClose: () => void;
}

const EXPORT_FORMATS = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'doc', label: 'DOC' },
] as const;

type ExportFormat = typeof EXPORT_FORMATS[number]['id'];

const DealExportModal = ({ dealId, dealTitle, resumeCount, adaptationCount, onClose }: DealExportModalProps): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authPost } = useAuthFetch();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set(['pdf']));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const allTemplates = await templateService.getAllTemplates();
        setTemplates(allTemplates);
        if (allTemplates.length > 0) {
          setSelectedTemplateId(allTemplates[0].id);
        }
      } catch (err) {
        logger.error('Failed to load templates:', err);
        toast.error(t('dealExport.errorLoadingTemplates'));
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [t]);

  const toggleFormat = (format: ExportFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        if (next.size > 1) next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedTemplateId || selectedFormats.size === 0) return;

    setSubmitting(true);
    try {
      const response = await authPost('/api/batch-jobs/deal-export', {
        dealId,
        templateId: selectedTemplateId,
        exportFormats: Array.from(selectedFormats),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du job');
      }

      const job = await response.json();
      toast.success(t('dealExport.jobCreated', { total: job.total_items }), { duration: 5000 });
      onClose();
      navigate('/batch-jobs');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      logger.error('Failed to create deal export job:', err);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = resumeCount + adaptationCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      <div className="cv-panel relative w-full max-w-2xl overflow-hidden rounded-[2rem]">
        <div className="border-b border-slate-200/70 px-6 py-5 dark:border-white/6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
                <ArrowDownTrayIcon className="h-6 w-6" />
              </span>
              <div>
                <div className="cv-kicker">{t('dealExport.title')}</div>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-[#dee5ff]">{dealTitle}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">
                  {t('dealExport.subtitle', { defaultValue: 'Préparez un export groupé des CV et adaptations liés à cette affaire.' })}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="cv-ghost-button rounded-[1rem] p-2.5 transition-colors" aria-label={t('common.close')}>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/6 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#8f99b8]">
                <DocumentTextIcon className="h-4 w-4 text-[var(--cv-secondary)]" />
                {t('resumes.groupedView.cvs')}
              </div>
              <div className="cv-display mt-2 text-2xl font-bold text-slate-950 dark:text-[#dee5ff]">{resumeCount}</div>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/6 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#8f99b8]">
                <BriefcaseIcon className="h-4 w-4 text-[var(--cv-primary)]" />
                {t('dealExport.adaptations')}
              </div>
              <div className="cv-display mt-2 text-2xl font-bold text-slate-950 dark:text-[#dee5ff]">{adaptationCount}</div>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/6 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#8f99b8]">
                <SparklesIcon className="h-4 w-4 text-[var(--cv-tertiary)]" />
                {t('dealExport.total', { defaultValue: 'Total' })}
              </div>
              <div className="cv-display mt-2 text-2xl font-bold text-slate-950 dark:text-[#dee5ff]">{totalItems}</div>
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-[#dee5ff]">{t('dealExport.template')}</label>
              <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">{t('dealExport.templateHint', { defaultValue: 'Choisissez le modèle utilisé pour tous les documents générés.' })}</p>
            </div>
            {loadingTemplates ? (
              <div className="h-12 animate-pulse rounded-[1rem] bg-slate-100 dark:bg-white/[0.06]" />
            ) : templates.length === 0 ? (
              <p className="rounded-[1rem] border border-[var(--cv-danger)]/20 bg-[var(--cv-danger-soft)] px-4 py-3 text-sm text-[var(--cv-danger)]">{t('dealExport.noTemplates')}</p>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="cv-search-input w-full rounded-[1rem] px-4 py-3 text-sm"
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.Name}</option>
                ))}
              </select>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-[#dee5ff]">{t('dealExport.formats')}</label>
              <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">{t('dealExport.formatsHint', { defaultValue: 'Vous pouvez lancer plusieurs formats en une seule opération.' })}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {EXPORT_FORMATS.map(({ id, label }) => {
                const isSelected = selectedFormats.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleFormat(id)}
                    className={`rounded-[1.1rem] border px-4 py-4 text-left transition-all ${
                      isSelected
                        ? 'border-[color:color-mix(in_srgb,var(--cv-primary)_30%,transparent)] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]'
                        : 'border-slate-200/70 bg-white/70 text-slate-600 hover:bg-slate-50 dark:border-white/6 dark:bg-white/[0.03] dark:text-[#a3aac4] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{label}</span>
                      {isSelected ? <CheckIcon className="h-5 w-5" /> : null}
                    </div>
                    <p className="mt-2 text-xs opacity-80">{t('dealExport.formatCardHint', { defaultValue: 'Ajouté au batch d’export.' })}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200/70 bg-white/50 px-6 py-5 dark:border-white/6 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-[#8f99b8]">
            {t('dealExport.summary', { total: totalItems, formats: selectedFormats.size })}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button onClick={onClose} className="cv-ghost-button rounded-[1rem] px-4 py-3 text-sm font-medium">{t('common.cancel')}</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedTemplateId || selectedFormats.size === 0 || totalItems === 0}
              className="cv-gradient-button inline-flex items-center justify-center gap-2 rounded-[1rem] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('dealExport.creating')}
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  {t('dealExport.launch')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealExportModal;
