import {
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
  title,
  subtitle,
  createLabel,
  onCreate,
}: {
  title: string;
  subtitle: string;
  createLabel: string;
  onCreate: () => void;
}) => (
  <div className="flex items-center justify-between mb-8">
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-1 h-8 rounded-full bg-primary-500" />
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {title}
        </h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{subtitle}</p>
    </div>
    <button onClick={onCreate} className="btn btn-primary flex items-center gap-2 px-4 py-2">
      <PlusIcon className="w-5 h-5" />
      {createLabel}
    </button>
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">{noTemplatesLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {template.is_system && (
                <LockClosedIcon className="w-4 h-4 text-gray-400" title={systemTemplateLabel} />
              )}
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h3>
            </div>
            {template.is_default && (
              <StarIconSolid className="w-5 h-5 text-yellow-500" title={defaultTemplateLabel} />
            )}
          </div>

          {template.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
              {template.description}
            </p>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-500 mb-4 truncate">
            {subjectLabel}: {template.subject_template}
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => onPreview(template)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              title={previewLabel}
            >
              <EyeIcon className="w-4 h-4" />
            </button>
            {!template.is_system && (
              <button
                onClick={() => onEdit(template)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                title={editLabel}
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onDuplicate(template)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              title={duplicateLabel}
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(template)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-auto"
              title={deleteLabel}
            >
              <TrashIcon className="w-4 h-4" />
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
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? t('emailTemplates.createNew') : t('emailTemplates.editTemplate')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('emailTemplates.nameLabel')} *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t('emailTemplates.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('emailTemplates.descriptionLabel')}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => onChange('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                  placeholder={t('emailTemplates.descriptionPlaceholder')}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={(e) => onChange('isDefault', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
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

            <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
              <div className="flex items-center justify-between mb-3">
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

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn btn-secondary px-4 py-2">
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className={`btn btn-primary px-4 py-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
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
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
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
