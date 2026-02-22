/**
 * Email Templates Admin Page
 * Manage email templates for CV submissions
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  StarIcon,
  LockClosedIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { EmailTemplate, EmailTemplateKeywords } from '../../types/entities';
import emailTemplateService from '../../services/emailTemplateService';
import { EmailTemplateEditor, EmailTemplatePreview } from '../../components/EmailTemplates';
import Breadcrumbs from '../../components/Breadcrumbs';

type ModalMode = 'create' | 'edit' | 'preview' | null;

const EmailTemplatesPage = (): JSX.Element => {
  const { t } = useTranslation();
  
  // State
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [keywords, setKeywords] = useState<EmailTemplateKeywords | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formMjml, setFormMjml] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  
  // Preview state
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load templates and keywords
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, keywordsData] = await Promise.all([
        emailTemplateService.getTemplates(),
        emailTemplateService.getKeywords()
      ]);
      setTemplates(templatesData);
      setKeywords(keywordsData);
    } catch (error) {
      toast.error(t('emailTemplates.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open create modal
  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormSubject('Candidature - {{resume.name}} - {{resume.title}}');
    setFormMjml('');
    setFormIsDefault(false);
    setModalMode('create');
  };

  // Open edit modal
  const handleEdit = async (template: EmailTemplate) => {
    if (template.is_system) {
      toast.error(t('emailTemplates.errors.cannotEditSystem'));
      return;
    }
    
    try {
      const fullTemplate = await emailTemplateService.getTemplate(template.id);
      setSelectedTemplate(fullTemplate);
      setFormName(fullTemplate.name);
      setFormDescription(fullTemplate.description || '');
      setFormSubject(fullTemplate.subject_template);
      setFormMjml(fullTemplate.mjml_content);
      setFormIsDefault(fullTemplate.is_default);
      setModalMode('edit');
    } catch (error) {
      toast.error(t('emailTemplates.errors.loadFailed'));
    }
  };

  // Preview template
  const handlePreview = async (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    setModalMode('preview');
    
    try {
      const result = await emailTemplateService.previewTemplate(template.id);
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    } catch (error) {
      toast.error(t('emailTemplates.errors.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Duplicate template
  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      await emailTemplateService.duplicateTemplate(template.id);
      toast.success(t('emailTemplates.success.duplicated'));
      loadData();
    } catch (error) {
      toast.error(t('emailTemplates.errors.duplicateFailed'));
    }
  };

  // Delete template
  const handleDelete = async (template: EmailTemplate) => {
    if (template.is_system) {
      toast.error(t('emailTemplates.errors.cannotDeleteSystem'));
      return;
    }
    
    if (!confirm(t('emailTemplates.confirmDelete'))) {
      return;
    }
    
    try {
      await emailTemplateService.deleteTemplate(template.id);
      toast.success(t('emailTemplates.success.deleted'));
      loadData();
    } catch (error) {
      toast.error(t('emailTemplates.errors.deleteFailed'));
    }
  };

  // Save template
  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim() || !formMjml.trim()) {
      toast.error(t('emailTemplates.errors.requiredFields'));
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        name: formName,
        description: formDescription,
        subjectTemplate: formSubject,
        mjmlContent: formMjml,
        isDefault: formIsDefault
      };
      
      if (modalMode === 'create') {
        await emailTemplateService.createTemplate(data);
        toast.success(t('emailTemplates.success.created'));
      } else if (modalMode === 'edit' && selectedTemplate) {
        await emailTemplateService.updateTemplate(selectedTemplate.id, data);
        toast.success(t('emailTemplates.success.updated'));
      }
      
      setModalMode(null);
      loadData();
    } catch (error) {
      toast.error(modalMode === 'create' 
        ? t('emailTemplates.errors.createFailed')
        : t('emailTemplates.errors.updateFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  // Live preview in editor
  const handleEditorPreview = async () => {
    if (!formMjml.trim()) return;
    
    setPreviewLoading(true);
    try {
      const result = await emailTemplateService.compileMjml(formMjml, formSubject);
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    } catch (error) {
      toast.error(t('emailTemplates.errors.compileFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Close modal
  const closeModal = () => {
    setModalMode(null);
    setSelectedTemplate(null);
    setPreviewHtml('');
    setPreviewSubject('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-4" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('emailTemplates.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('emailTemplates.subtitle')}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          {t('emailTemplates.createNew')}
        </button>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {t('emailTemplates.noTemplates')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              {/* Template Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {template.is_system && (
                    <LockClosedIcon className="w-4 h-4 text-gray-400" title={t('emailTemplates.systemTemplate')} />
                  )}
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                </div>
                {template.is_default && (
                  <StarIconSolid className="w-5 h-5 text-yellow-500" title={t('emailTemplates.defaultTemplate')} />
                )}
              </div>

              {/* Description */}
              {template.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {template.description}
                </p>
              )}

              {/* Subject Preview */}
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-4 truncate">
                {t('emailTemplates.subjectLabel')}: {template.subject_template}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handlePreview(template)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title={t('emailTemplates.preview')}
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                
                {!template.is_system && (
                  <button
                    onClick={() => handleEdit(template)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title={t('common.edit')}
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={() => handleDuplicate(template)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title={t('emailTemplates.duplicate')}
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                </button>
                
                {!template.is_system && (
                  <button
                    onClick={() => handleDelete(template)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-auto"
                    title={t('common.delete')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-start justify-center p-4 pt-16">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {modalMode === 'create' 
                    ? t('emailTemplates.createNew')
                    : t('emailTemplates.editTemplate')
                  }
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Editor Column */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('emailTemplates.nameLabel')} *
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={t('emailTemplates.namePlaceholder')}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('emailTemplates.descriptionLabel')}
                      </label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                        placeholder={t('emailTemplates.descriptionPlaceholder')}
                      />
                    </div>

                    {/* Default checkbox */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={formIsDefault}
                        onChange={(e) => setFormIsDefault(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
                        {t('emailTemplates.setAsDefault')}
                      </label>
                    </div>

                    {/* Visual Editor */}
                    <EmailTemplateEditor
                      initialMjml={formMjml}
                      subjectTemplate={formSubject}
                      onSubjectChange={setFormSubject}
                      onMjmlChange={setFormMjml}
                      keywords={keywords || undefined}
                    />
                  </div>

                  {/* Preview Column */}
                  <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('emailTemplates.preview')}
                      </span>
                      <button
                        type="button"
                        onClick={handleEditorPreview}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
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

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {modalMode === 'preview' && selectedTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedTemplate.name}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
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
      )}
    </div>
  );
};

export default EmailTemplatesPage;
