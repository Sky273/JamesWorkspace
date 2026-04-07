import {
  ArrowRightIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { EmailTemplateEditor, EmailTemplatePreview } from '../../components/EmailTemplates';
import type { EmailTemplate } from '../../types/entities';
import type {
  EmailTemplatesEditModalProps,
  EmailTemplatesPreviewModalProps,
} from './EmailTemplatesPage.types';

export const EmailTemplatesHeader = ({
  createLabel,
  defaultTemplatesCount,
  onCreate,
  systemTemplatesCount,
  totalTemplates,
}: {
  createLabel: string;
  defaultTemplatesCount: number;
  onCreate: () => void;
  systemTemplatesCount: number;
  totalTemplates: number;
}) => (
  <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)]">
          Organisez les modeles systeme et les variantes metier sans quitter l'espace d'administration.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="cv-gradient-button inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
      >
        <PlusIcon className="h-5 w-5" />
        {createLabel}
      </button>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/40">
        <p className="text-sm text-slate-500 dark:text-slate-400">Templates</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{totalTemplates}</p>
      </div>
      <div className="rounded-3xl border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-800/60 dark:bg-amber-900/15">
        <p className="text-sm text-amber-700 dark:text-amber-300">Par defaut</p>
        <p className="mt-2 text-3xl font-semibold text-amber-900 dark:text-amber-100">{defaultTemplatesCount}</p>
      </div>
      <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">Systeme</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{systemTemplatesCount}</p>
      </div>
    </div>
  </div>
);

export const EmailTemplatesList = ({
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
        <div
          key={template.id}
          className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {template.is_system && (
                <LockClosedIcon className="w-4 h-4 text-gray-400" title={systemTemplateLabel} />
              )}
              <h3 className="text-base font-semibold text-slate-950 dark:text-[var(--cv-text)]">{template.name}</h3>
            </div>
            {template.is_default && (
              <StarIconSolid className="w-5 h-5 text-yellow-500" title={defaultTemplateLabel} />
            )}
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

          <div className="mt-4 flex items-center gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
            <button
              onClick={() => onPreview(template)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
            <button
              onClick={() => onDuplicate(template)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={duplicateLabel}
              title={duplicateLabel}
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(template)}
              className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              aria-label={deleteLabel}
              title={deleteLabel}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onPreview(template)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              {previewLabel}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
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
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex min-h-screen items-start justify-center p-4 pt-16">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? t('emailTemplates.createNew') : t('emailTemplates.editTemplate')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('emailTemplates.nameLabel')} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={t('emailTemplates.namePlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('emailTemplates.descriptionLabel')}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => onChange('description', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={t('emailTemplates.descriptionPlaceholder')}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={(e) => onChange('isDefault', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
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

            <div className="lg:border-l lg:border-gray-200 lg:pl-6 lg:dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('emailTemplates.preview')}
                </span>
                <button type="button" onClick={onPreview} className="btn btn-secondary px-3 py-1 text-sm">
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

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
          <button onClick={onClose} className="btn btn-secondary px-4 py-2">
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className={`btn btn-primary px-4 py-2 ${saving ? 'cursor-not-allowed opacity-50' : ''}`}
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
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{template.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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
