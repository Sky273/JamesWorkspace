import {
  ArrowPathIcon,
  Bars3BottomLeftIcon,
  BuildingOfficeIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  LockClosedIcon,
  PaintBrushIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { EmailTemplateEditor, EmailTemplatePreview } from '../../components/EmailTemplates';
import type { EmailTemplate } from '../../types/entities';
import type {
  DuplicateFirmOption,
  EmailTemplatesEditModalProps,
  EmailTemplatesPreviewModalProps,
} from './EmailTemplatesPage.types';

export const EmailTemplatesHeader = ({
  createLabel,
  defaultTemplatesCount,
  onCreate,
  onRefresh,
  systemTemplatesCount,
  totalTemplates,
  introLabel,
  hintLabel,
  totalLabel,
  defaultLabel,
  systemLabel,
}: {
  createLabel: string;
  defaultTemplatesCount: number;
  onCreate: () => void;
  onRefresh: () => void;
  systemTemplatesCount: number;
  totalTemplates: number;
  introLabel: string;
  hintLabel: string;
  totalLabel: string;
  defaultLabel: string;
  systemLabel: string;
}) => (
  <div className="space-y-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        <p className="cv-kicker">Administration email</p>
        <p className="text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)]">{introLabel}</p>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          <PaintBrushIcon className="h-4 w-4 text-primary-500" />
          {hintLabel}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="cv-ghost-button inline-flex min-h-11 min-w-11 items-center justify-center rounded-[1rem] p-3"
          title="Actualiser"
          aria-label="Actualiser"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
        <button
          onClick={onCreate}
          className="cv-gradient-button inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          <PlusIcon className="h-5 w-5" />
          {createLabel}
        </button>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{totalLabel}</p>
          <div className="rounded-2xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Bars3BottomLeftIcon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{totalTemplates}</p>
      </div>

      <div className="rounded-[1.75rem] border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-900/15">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">{defaultLabel}</p>
          <div className="rounded-2xl bg-amber-100/90 p-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <StarIcon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-3xl font-semibold text-amber-900 dark:text-amber-100">{defaultTemplatesCount}</p>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{systemLabel}</p>
          <div className="rounded-2xl bg-slate-200/80 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <LockClosedIcon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{systemTemplatesCount}</p>
      </div>
    </div>
  </div>
);

export const EmailTemplatesList = ({
  canDuplicate,
  firmLabel,
  globalFirmLabel,
  templates,
  loading,
  noTemplatesLabel,
  systemTemplateLabel,
  defaultTemplateLabel,
  subjectLabel,
  previewLabel,
  editLabel,
  duplicateLabel,
  deleteLabel,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  canDuplicate: boolean;
  firmLabel: string;
  globalFirmLabel: string;
  templates: EmailTemplate[];
  loading: boolean;
  noTemplatesLabel: string;
  systemTemplateLabel: string;
  defaultTemplateLabel: string;
  subjectLabel: string;
  previewLabel: string;
  editLabel: string;
  duplicateLabel: string;
  deleteLabel: string;
  onPreview: (template: EmailTemplate) => void;
  onEdit: (template: EmailTemplate) => void;
  onDuplicate: (template: EmailTemplate) => void;
  onDelete: (template: EmailTemplate) => void;
}) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-[1.75rem] border border-slate-200/80 bg-slate-100/80 dark:border-slate-700/80 dark:bg-slate-800/70"
          />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-slate-300/80 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700/80 dark:bg-slate-900/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-800">
          <DocumentDuplicateIcon className="h-6 w-6 text-slate-500 dark:text-slate-300" />
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{noTemplatesLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <article
          key={template.id}
          className="cv-card rounded-[1.75rem] p-5 transition-all hover:-translate-y-0.5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {template.is_system && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <LockClosedIcon className="h-3.5 w-3.5" />
                    {systemTemplateLabel}
                  </span>
                )}
                {template.is_default && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-700/70 dark:bg-amber-900/20 dark:text-amber-300">
                    <StarIconSolid className="h-3.5 w-3.5" />
                    {defaultTemplateLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/80 bg-sky-50/90 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-700/70 dark:bg-sky-900/20 dark:text-sky-300">
                  <BuildingOfficeIcon className="h-3.5 w-3.5" />
                  {firmLabel}: {template.firm_name || globalFirmLabel}
                </span>
              </div>
              <h3 className="truncate text-base font-semibold text-slate-950 dark:text-[var(--cv-text)]">{template.name}</h3>
            </div>
            <div className="rounded-2xl bg-primary-50 p-2 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
              <PaintBrushIcon className="h-5 w-5" />
            </div>
          </div>

          {template.description && (
            <p className="mb-4 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {template.description}
            </p>
          )}

          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
            <div className="mb-1 font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {subjectLabel}
            </div>
            <div className="truncate text-sm font-medium normal-case tracking-normal text-slate-700 dark:text-slate-200">
              {template.subject_template}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
            <button
              onClick={() => onPreview(template)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label={previewLabel}
              title={previewLabel}
            >
              <EyeIcon className="h-4 w-4" />
              <span>{previewLabel}</span>
            </button>

            {!template.is_system && (
              <button
                onClick={() => onEdit(template)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={editLabel}
                title={editLabel}
              >
                <PencilSquareIcon className="h-4 w-4" />
              </button>
            )}

            {canDuplicate ? (
              <button
                onClick={() => onDuplicate(template)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={duplicateLabel}
                title={duplicateLabel}
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </button>
            ) : null}

            <button
              onClick={() => onDelete(template)}
              className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              aria-label={deleteLabel}
              title={deleteLabel}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};

export const EmailTemplatesDuplicateModal = ({
  firms,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  onFirmChange,
  selectedFirmId,
  template,
  t,
}: {
  firms: DuplicateFirmOption[];
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFirmChange: (firmId: string) => void;
  selectedFirmId: string;
  template: EmailTemplate | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  if (!isOpen || !template) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                {t('emailTemplates.duplicateTitle')}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('emailTemplates.duplicateMessage', { name: template.name })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-6">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('emailTemplates.targetFirmLabel')}
            </label>
            <select
              value={selectedFirmId}
              onChange={(event) => onFirmChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-[color:color-mix(in_srgb,var(--cv-primary)_55%,transparent)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--cv-primary)_12%,transparent)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--cv-text)]"
            >
              <option value="">{t('emailTemplates.selectTargetFirm')}</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium">
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting || !selectedFirmId}
              className={`cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold ${isSubmitting || !selectedFirmId ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {isSubmitting ? t('common.saving') : t('emailTemplates.duplicate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const EmailTemplatesEditModal = ({
  mode,
  form,
  keywords,
  previewHtml,
  previewSubject,
  previewLoading,
  saving,
  onClose,
  onPreview,
  onSave,
  onChange,
  t,
}: EmailTemplatesEditModalProps) => (
  <div className="fixed inset-0 z-[60] overflow-y-auto">
    <div className="flex min-h-screen items-start justify-center p-4 pt-8 sm:p-6 sm:pt-10">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-slate-700/80 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/80 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
              {mode === 'create' ? t('emailTemplates.createNew') : t('emailTemplates.editTemplate')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('emailTemplates.headerIntro')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="section-shell rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-primary-50 p-2 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
                  <PencilSquareIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {mode === 'create' ? t('emailTemplates.createNew') : t('emailTemplates.editTemplate')}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('emailTemplates.subjectLabel')} · MJML</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('emailTemplates.nameLabel')} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => onChange('name', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-[color:color-mix(in_srgb,var(--cv-primary)_55%,transparent)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--cv-primary)_12%,transparent)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--cv-text)]"
                    placeholder={t('emailTemplates.namePlaceholder')}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('emailTemplates.descriptionLabel')}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => onChange('description', e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-[color:color-mix(in_srgb,var(--cv-primary)_55%,transparent)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--cv-primary)_12%,transparent)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--cv-text)]"
                    placeholder={t('emailTemplates.descriptionPlaceholder')}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/70">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={form.isDefault}
                    onChange={(e) => onChange('isDefault', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--cv-primary)] focus:ring-[var(--cv-primary)]"
                  />
                  <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">
                    {t('emailTemplates.setAsDefault')}
                  </label>
                </div>

                <EmailTemplateEditor
                  initialMjml={form.mjml}
                  subjectTemplate={form.subject}
                  onSubjectChange={(value) => onChange('subject', value)}
                  onMjmlChange={(value) => onChange('mjml', value)}
                  keywords={keywords || undefined}
                />
              </div>
            </div>

            <div className="section-shell rounded-[1.75rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('emailTemplates.preview')}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{previewSubject || t('emailTemplates.subjectLabel')}</p>
                </div>
                <button
                  type="button"
                  onClick={onPreview}
                  className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
                >
                  {t('emailTemplates.refreshPreview')}
                </button>
              </div>
              <EmailTemplatePreview
                html={previewHtml}
                subject={previewSubject}
                loading={previewLoading}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 px-5 py-4 dark:border-slate-700/80 sm:px-6">
          <button onClick={onClose} className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium">
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className={`cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold ${saving ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const EmailTemplatesPreviewModal = ({
  template,
  previewHtml,
  previewSubject,
  previewLoading,
  onClose,
}: EmailTemplatesPreviewModalProps) => (
  <div className="fixed inset-0 z-[60] overflow-y-auto">
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-slate-700/80 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/80 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">{template.name}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{previewSubject}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <EmailTemplatePreview
            html={previewHtml}
            subject={previewSubject}
            loading={previewLoading}
          />
        </div>
      </div>
    </div>
  </div>
);
