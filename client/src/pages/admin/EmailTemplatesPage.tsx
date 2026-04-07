/**
 * Email Templates Admin Page
 * Manage email templates for CV submissions.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import PageHeader from '../../components/page/PageHeader';
import type { EmailTemplate, EmailTemplateKeywords } from '../../types/entities';
import emailTemplateService from '../../services/emailTemplateService';
import {
  EmailTemplatesEditModal,
  EmailTemplatesHeader,
  EmailTemplatesList,
  EmailTemplatesPreviewModal,
} from './EmailTemplatesPage.sections';
import type {
  EmailTemplateFormState,
  ModalMode,
} from './EmailTemplatesPage.types';

const EMPTY_FORM: EmailTemplateFormState = {
  name: '',
  description: '',
  subject: '',
  mjml: '',
  isDefault: false,
};

const EmailTemplatesPage = (): JSX.Element => {
  const { t } = useTranslation();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [keywords, setKeywords] = useState<EmailTemplateKeywords | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmailTemplateFormState>(EMPTY_FORM);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [templatesData, keywordsData] = await Promise.all([
        emailTemplateService.getTemplates(),
        emailTemplateService.getKeywords(),
      ]);
      setTemplates(templatesData);
      setKeywords(keywordsData);
    } catch {
      setLoadError(true);
      toast.error(t('emailTemplates.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateForm = useCallback(
    (field: keyof EmailTemplateFormState, value: string | boolean) => {
      setForm((current: EmailTemplateFormState) => ({ ...current, [field]: value }));
    },
    [],
  );

  const closeModal = useCallback(() => {
    setModalMode(null);
    setSelectedTemplate(null);
    setPreviewHtml('');
    setPreviewSubject('');
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedTemplate(null);
    setForm({
      ...EMPTY_FORM,
      subject: 'Candidature - {{resume.name}} - {{resume.title}}',
    });
    setModalMode('create');
  }, []);

  const handleEdit = useCallback(
    async (template: EmailTemplate) => {
      if (template.is_system) {
        toast.error(t('emailTemplates.errors.cannotEditSystem'));
        return;
      }

      try {
        const fullTemplate = await emailTemplateService.getTemplate(template.id);
        setSelectedTemplate(fullTemplate);
        setForm({
          name: fullTemplate.name,
          description: fullTemplate.description || '',
          subject: fullTemplate.subject_template,
          mjml: fullTemplate.mjml_content,
          isDefault: fullTemplate.is_default,
        });
        setModalMode('edit');
      } catch {
        toast.error(t('emailTemplates.errors.loadFailed'));
      }
    },
    [t],
  );

  const handlePreview = useCallback(
    async (template: EmailTemplate) => {
      setSelectedTemplate(template);
      setPreviewLoading(true);
      setModalMode('preview');

      try {
        const result = await emailTemplateService.previewTemplate(template.id);
        setPreviewHtml(result.html);
        setPreviewSubject(result.subject);
      } catch {
        toast.error(t('emailTemplates.errors.previewFailed'));
      } finally {
        setPreviewLoading(false);
      }
    },
    [t],
  );

  const handleDuplicate = useCallback(
    async (template: EmailTemplate) => {
      try {
        await emailTemplateService.duplicateTemplate(template.id);
        toast.success(t('emailTemplates.success.duplicated'));
        loadData();
      } catch {
        toast.error(t('emailTemplates.errors.duplicateFailed'));
      }
    },
    [loadData, t],
  );

  const handleDelete = useCallback(
    async (template: EmailTemplate) => {
      const confirmMessage =
        template.is_system || template.is_default
          ? t('emailTemplates.confirmDeleteDefault')
          : t('emailTemplates.confirmDelete');

      if (!confirm(confirmMessage)) return;

      try {
        await emailTemplateService.deleteTemplate(template.id);
        toast.success(t('emailTemplates.success.deleted'));
        loadData();
      } catch {
        toast.error(t('emailTemplates.errors.deleteFailed'));
      }
    },
    [loadData, t],
  );

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.mjml.trim()) {
      toast.error(t('emailTemplates.errors.requiredFields'));
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        subjectTemplate: form.subject,
        mjmlContent: form.mjml,
        isDefault: form.isDefault,
      };

      if (modalMode === 'create') {
        await emailTemplateService.createTemplate(data);
        toast.success(t('emailTemplates.success.created'));
      } else if (modalMode === 'edit' && selectedTemplate) {
        await emailTemplateService.updateTemplate(selectedTemplate.id, data);
        toast.success(t('emailTemplates.success.updated'));
      }

      closeModal();
      loadData();
    } catch {
      toast.error(
        modalMode === 'create'
          ? t('emailTemplates.errors.createFailed')
          : t('emailTemplates.errors.updateFailed'),
      );
    } finally {
      setSaving(false);
    }
  }, [closeModal, form, loadData, modalMode, selectedTemplate, t]);

  const handleEditorPreview = useCallback(async () => {
    if (!form.mjml.trim()) return;

    setPreviewLoading(true);
    try {
      const result = await emailTemplateService.compileMjml(
        form.mjml,
        form.subject,
      );
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    } catch {
      toast.error(t('emailTemplates.errors.compileFailed'));
    } finally {
      setPreviewLoading(false);
    }
  }, [form.mjml, form.subject, t]);

  const defaultTemplatesCount = templates.filter((template) => template.is_default).length;
  const systemTemplatesCount = templates.filter((template) => template.is_system).length;

  if (loading) {
    return (
      <div className="cv-surface app-page-shell max-w-6xl">
        <PageHeader title={t('emailTemplates.title')} subtitle={t('emailTemplates.subtitle')} />
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-primary-500" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-8 w-72 max-w-full animate-pulse rounded-full bg-gray-200/80 dark:bg-gray-700/70" />
                <div className="mt-3 h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-700/60" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="h-28 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                <div className="h-28 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
                <div className="h-28 rounded-3xl bg-gray-100 animate-pulse dark:bg-gray-800" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="cv-surface app-page-shell max-w-6xl"
    >
      <PageHeader
        title={t('emailTemplates.title')}
        subtitle={t('emailTemplates.subtitle')}
      />

      <div className="space-y-6">
        <div className="section-shell rounded-[2rem] p-6 sm:p-7">
          <EmailTemplatesHeader
            createLabel={t('emailTemplates.createNew')}
            defaultTemplatesCount={defaultTemplatesCount}
            onCreate={handleCreate}
            systemTemplatesCount={systemTemplatesCount}
            totalTemplates={templates.length}
            introLabel={t('emailTemplates.headerIntro')}
            hintLabel={t('emailTemplates.headerHint')}
            totalLabel={t('emailTemplates.stats.total')}
            defaultLabel={t('emailTemplates.stats.default')}
            systemLabel={t('emailTemplates.stats.system')}
          />
        </div>

        {loadError && (
          <div className="section-shell rounded-[2rem] border border-amber-200/70 bg-amber-50/80 p-4 dark:border-amber-800/70 dark:bg-amber-900/15">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-amber-500" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t('emailTemplates.errors.loadFailed')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadData();
                }}
                className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
              >
                {t('common.retry')}
              </button>
            </div>
          </div>
        )}

        <div className="section-shell rounded-[2rem] p-6">
          <EmailTemplatesList
            templates={templates}
            loading={loading}
            noTemplatesLabel={t('emailTemplates.noTemplates')}
            systemTemplateLabel={t('emailTemplates.systemTemplate')}
            defaultTemplateLabel={t('emailTemplates.defaultTemplate')}
            subjectLabel={t('emailTemplates.subjectLabel')}
            previewLabel={t('emailTemplates.preview')}
            editLabel={t('common.edit')}
            duplicateLabel={t('emailTemplates.duplicate')}
            deleteLabel={t('common.delete')}
            onPreview={handlePreview}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {(modalMode === 'create' || modalMode === 'edit') && (
        <EmailTemplatesEditModal
          mode={modalMode}
          form={form}
          keywords={keywords}
          previewHtml={previewHtml}
          previewSubject={previewSubject}
          previewLoading={previewLoading}
          saving={saving}
          onClose={closeModal}
          onPreview={handleEditorPreview}
          onSave={handleSave}
          onChange={updateForm}
          t={t as (key: string) => string}
        />
      )}

      {modalMode === 'preview' && selectedTemplate && (
        <EmailTemplatesPreviewModal
          template={selectedTemplate}
          previewHtml={previewHtml}
          previewSubject={previewSubject}
          previewLoading={previewLoading}
          onClose={closeModal}
        />
      )}
    </motion.div>
  );
};

export default EmailTemplatesPage;
