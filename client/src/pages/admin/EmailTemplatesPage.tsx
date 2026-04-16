/**
 * Email Templates Admin Page
 * Manage email templates for CV submissions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useScopedViewRefresh } from '../../hooks/useScopedViewRefresh';
import { markEmailTemplatesViewDirty } from '../../utils/viewRefreshScopes';
import PaginationPair from '../../components/page/PaginationPair';
import PageHeader from '../../components/page/PageHeader';
import type { EmailTemplate, EmailTemplateKeywords } from '../../types/entities';
import emailTemplateService from '../../services/emailTemplateService';
import userService from '../../utils/userService';
import {
  EmailTemplatesDuplicateModal,
  EmailTemplatesEditModal,
  EmailTemplatesHeader,
  EmailTemplatesList,
  EmailTemplatesPreviewModal,
} from './EmailTemplatesPage.sections';
import type {
  DuplicateFirmOption,
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

const EMAIL_TEMPLATES_PAGE_SIZE = 9;

const EmailTemplatesPage = ({ embedded = false }: { embedded?: boolean } = {}): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';

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
  const [page, setPage] = useState(1);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [duplicateTemplateTarget, setDuplicateTemplateTarget] = useState<EmailTemplate | null>(null);
  const [duplicateFirmId, setDuplicateFirmId] = useState('');
  const [duplicateFirms, setDuplicateFirms] = useState<DuplicateFirmOption[]>([]);
  const [duplicating, setDuplicating] = useState(false);
  const templatesRequestIdRef = useRef(0);

  const loadData = useCallback(async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
    const requestId = ++templatesRequestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [templatesData, keywordsData] = await Promise.all([
        emailTemplateService.getTemplates({ forceRefresh }),
        emailTemplateService.getKeywords(),
      ]);
      if (requestId !== templatesRequestIdRef.current) {
        return;
      }
      setTemplates(templatesData);
      setKeywords(keywordsData);
    } catch {
      if (requestId !== templatesRequestIdRef.current) {
        return;
      }
      setLoadError(true);
      toast.error(t('emailTemplates.errors.loadFailed'));
    } finally {
      if (requestId === templatesRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useScopedViewRefresh({
    consumerId: embedded ? 'admin-workspace:email-templates-page' : 'email-templates-page',
    scopes: ['emailTemplates', 'administration'],
    onRefresh: () => {
      void loadData({ forceRefresh: true });
    },
  });

  const totalPages = Math.max(1, Math.ceil(templates.length / EMAIL_TEMPLATES_PAGE_SIZE));
  const paginatedTemplates = useMemo(() => {
    const startIndex = (page - 1) * EMAIL_TEMPLATES_PAGE_SIZE;
    return templates.slice(startIndex, startIndex + EMAIL_TEMPLATES_PAGE_SIZE);
  }, [page, templates]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

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
        const fullTemplate = await emailTemplateService.getTemplate(template.id, { forceRefresh: true });
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
        if (!isSuperAdmin) {
          return;
        }

        const response = await userService.getCustomersPaginated({ page: 1, pageSize: 100 });
        setDuplicateFirms((response.customers || []).filter((firm) => firm.id !== template.firm_id));
        setDuplicateTemplateTarget(template);
        setDuplicateFirmId('');
      } catch {
        toast.error(t('emailTemplates.duplicateLoadFirmsError'));
      }
    },
    [isSuperAdmin, t],
  );

  const closeDuplicateModal = useCallback(() => {
    setDuplicateTemplateTarget(null);
    setDuplicateFirmId('');
  }, []);

  const confirmDuplicate = useCallback(async () => {
    if (!duplicateTemplateTarget || !duplicateFirmId) {
      return;
    }

    setDuplicating(true);
    try {
      templatesRequestIdRef.current += 1;
      const duplicatedTemplate = await emailTemplateService.duplicateTemplate(duplicateTemplateTarget.id, duplicateFirmId);
      setTemplates((currentTemplates) => [duplicatedTemplate, ...currentTemplates]);
      markEmailTemplatesViewDirty();
      toast.success(t('emailTemplates.success.duplicated'));
      closeDuplicateModal();
    } catch {
      toast.error(t('emailTemplates.errors.duplicateFailed'));
    } finally {
      setDuplicating(false);
    }
  }, [closeDuplicateModal, duplicateFirmId, duplicateTemplateTarget, t]);

  const handleDelete = useCallback(
    async (template: EmailTemplate) => {
      const confirmMessage =
        template.is_system || template.is_default
          ? t('emailTemplates.confirmDeleteDefault')
          : t('emailTemplates.confirmDelete');

      if (!confirm(confirmMessage)) return;

      try {
        templatesRequestIdRef.current += 1;
        await emailTemplateService.deleteTemplate(template.id);
        setTemplates((currentTemplates) => currentTemplates.filter((currentTemplate) => currentTemplate.id !== template.id));
        markEmailTemplatesViewDirty();
        toast.success(t('emailTemplates.success.deleted'));
        void loadData({ forceRefresh: true });
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
        templatesRequestIdRef.current += 1;
        const createdTemplate = await emailTemplateService.createTemplate(data);
        setTemplates((currentTemplates) => [createdTemplate, ...currentTemplates]);
        setPage(1);
        markEmailTemplatesViewDirty();
        toast.success(t('emailTemplates.success.created'));
      } else if (modalMode === 'edit' && selectedTemplate) {
        templatesRequestIdRef.current += 1;
        const updatedTemplate = await emailTemplateService.updateTemplate(selectedTemplate.id, data);
        setTemplates((currentTemplates) => currentTemplates.map((currentTemplate) => (
          currentTemplate.id === selectedTemplate.id ? updatedTemplate : currentTemplate
        )));
        markEmailTemplatesViewDirty();
        toast.success(t('emailTemplates.success.updated'));
      }

      closeModal();
      if (modalMode === 'edit') {
        void loadData({ forceRefresh: true });
      }
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
      <div className={embedded ? 'max-w-6xl' : 'cv-surface app-page-shell max-w-6xl'}>
        {!embedded ? <PageHeader title={t('emailTemplates.title')} subtitle={t('emailTemplates.subtitle')} /> : null}
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
      className={embedded ? 'max-w-6xl space-y-6' : 'cv-surface app-page-shell max-w-6xl'}
    >
      {!embedded ? (
        <PageHeader
          title={t('emailTemplates.title')}
          subtitle={t('emailTemplates.subtitle')}
        />
      ) : null}

      <div className="space-y-6">
        <div className="section-shell rounded-[2rem] p-6 sm:p-7">
          <EmailTemplatesHeader
            createLabel={t('emailTemplates.createNew')}
            defaultTemplatesCount={defaultTemplatesCount}
            onCreate={handleCreate}
            onRefresh={() => {
              void loadData({ forceRefresh: true });
            }}
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
                  void loadData({ forceRefresh: true });
                }}
                className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
              >
                {t('common.retry')}
              </button>
            </div>
          </div>
        )}

        <div className="section-shell rounded-[2rem] p-6">
          <PaginationPair
            currentPage={page}
            totalPages={totalPages}
            totalCount={templates.length}
            pageSize={EMAIL_TEMPLATES_PAGE_SIZE}
            onPageChange={setPage}
            loading={loading}
            itemName={t('emailTemplates.stats.total').toLowerCase()}
          >
            <EmailTemplatesList
              canDuplicate={isSuperAdmin}
              firmLabel={t('emailTemplates.firmLabel')}
              globalFirmLabel={t('emailTemplates.globalFirm')}
              templates={paginatedTemplates}
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
          </PaginationPair>
        </div>
      </div>

      <EmailTemplatesDuplicateModal
        firms={duplicateFirms}
        isOpen={Boolean(duplicateTemplateTarget)}
        isSubmitting={duplicating}
        onClose={closeDuplicateModal}
        onConfirm={() => {
          void confirmDuplicate();
        }}
        onFirmChange={setDuplicateFirmId}
        selectedFirmId={duplicateFirmId}
        template={duplicateTemplateTarget}
        t={t}
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
    </motion.div>
  );
};

export default EmailTemplatesPage;
