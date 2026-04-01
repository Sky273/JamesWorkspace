/**
 * Email Templates Admin Page
 * Manage email templates for CV submissions.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
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
    try {
      const [templatesData, keywordsData] = await Promise.all([
        emailTemplateService.getTemplates(),
        emailTemplateService.getKeywords(),
      ]);
      setTemplates(templatesData);
      setKeywords(keywordsData);
    } catch {
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <EmailTemplatesHeader
        title={t('emailTemplates.title')}
        subtitle={t('emailTemplates.subtitle')}
        createLabel={t('emailTemplates.createNew')}
        onCreate={handleCreate}
      />

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
    </div>
  );
};

export default EmailTemplatesPage;
