/**
 * NewTemplatePage Component
 * TypeScript version
 */

import { useState, useEffect, useRef, useCallback, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { templateService } from '../utils/templateService';
import type { TemplateData } from '../utils/templateService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger.frontend';
import AdminFirmSelector from '../components/AdminFirmSelector';
import {
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  summarizeTemplatePayload,
} from '../utils/templateFragments';

import TiptapEditor from '../components/TiptapEditor/DeferredTiptapEditor';
import type { TiptapEditorRef } from '../components/TiptapEditor/TiptapEditor';

interface FormData {
  name: string;
  description: string;
  headerContent: string;
  templateContent: string;
  footerContent: string;
  footerHeight: number;
  stylesheet: string;
  status: string;
  popular: boolean;
  tags: string[];
  firmId: string;
}

const NewTemplatePage = (): JSX.Element => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const headerEditorRef = useRef<TiptapEditorRef | null>(null);
  const bodyEditorRef = useRef<TiptapEditorRef | null>(null);
  const footerEditorRef = useRef<TiptapEditorRef | null>(null);
  const editorsReadyCount = useRef<number>(0);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { t } = useTranslation();

  const handleEditorReady = useCallback(() => {
    editorsReadyCount.current++;
    if (editorsReadyCount.current >= 3) {
      setEditorReady(true);
    }
  }, []);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    headerContent: '',
    templateContent: '',
    footerContent: '',
    footerHeight: 25,
    stylesheet: '',
    status: 'Active',
    popular: false,
    tags: [],
    firmId: ''
  });

  useEffect(() => {
    const fetchTemplate = async (): Promise<void> => {
      // Check if we have an extracted template from sessionStorage
      const extractedTemplateJson = sessionStorage.getItem('extractedTemplate');
      if (extractedTemplateJson && !id) {
        try {
          const extractedTemplate = JSON.parse(extractedTemplateJson);
          const normalizedExtractedTemplate = {
            ...extractedTemplate,
            headerContent: normalizeTemplateFragment(extractedTemplate.headerContent, 'header'),
            footerContent: normalizeTemplateFragment(extractedTemplate.footerContent, 'footer'),
            stylesheet: normalizeTemplateStylesheet(extractedTemplate.stylesheet),
          };
          const newFormData = {
            name: normalizedExtractedTemplate.name || '',
            description: normalizedExtractedTemplate.description || '',
            headerContent: normalizedExtractedTemplate.headerContent || '',
            templateContent: normalizedExtractedTemplate.templateContent || '',
            footerContent: normalizedExtractedTemplate.footerContent || '',
            footerHeight: normalizedExtractedTemplate.footerHeight || 25,
            stylesheet: normalizedExtractedTemplate.stylesheet || '',
            status: 'Active',
            popular: false,
            tags: normalizedExtractedTemplate.tags || [],
            firmId: ''
          };
          setFormData(newFormData);
          // Clear sessionStorage after loading
          sessionStorage.removeItem('extractedTemplate');
          toast.success(t('templates.extract.templateLoaded'));
          return;
        } catch (parseError) {
          logger.error('Error parsing extracted template:', parseError);
          sessionStorage.removeItem('extractedTemplate');
        }
      }

      if (!id) {
        return;
      }
      try {
        setLoading(true);
        const template = await templateService.getTemplateById(id);
        const normalizedHeaderContent = normalizeTemplateFragment(template.HeaderContent, 'header');
        const normalizedFooterContent = normalizeTemplateFragment(template.FooterContent, 'footer');
        const normalizedStylesheet = normalizeTemplateStylesheet(template.Stylesheet);
        const newFormData = {
          name: template.Name || '',
          description: template.Description || '',
          headerContent: normalizedHeaderContent,
          templateContent: template.TemplateContent || '',
          footerContent: normalizedFooterContent,
          footerHeight: template.FooterHeight || 25,
          stylesheet: normalizedStylesheet,
          status: template.Status?.charAt(0).toUpperCase() + template.Status?.slice(1).toLowerCase() || 'Active',
          popular: template.Popular || false,
          tags: template.Tags || [],
          firmId: template.FirmId || template.firm_id || ''
        };
        setFormData(newFormData);
      } catch (error) {
        logger.error('Error fetching template:', error);
        toast.error(t('templates.editor.error.load'));
        navigate('/templates');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [id, navigate, t]);



  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error(t('templates.editor.validation.nameRequired')); return; }
    if (!formData.templateContent?.trim()) { toast.error(t('templates.editor.validation.contentRequired')); return; }

    try {
      const normalizedHeaderContent = normalizeTemplateFragment(formData.headerContent, 'header');
      const normalizedFooterContent = normalizeTemplateFragment(formData.footerContent, 'footer');
      const normalizedStylesheet = normalizeTemplateStylesheet(formData.stylesheet);
      const templateData: TemplateData = {
        name: formData.name,
        description: formData.description,
        headerContent: normalizedHeaderContent,
        templateContent: formData.templateContent,
        footerContent: normalizedFooterContent,
        footerHeight: formData.footerHeight,
        stylesheet: normalizedStylesheet,
        tags: Array.isArray(formData.tags) ? formData.tags : [],
        popular: Boolean(formData.popular),
        status: formData.status || 'Active'
      };
      logger.warn('Saving normalized template fragments', {
        templateId: id || 'new',
        ...summarizeTemplatePayload({
          HeaderContent: formData.headerContent,
          FooterContent: formData.footerContent,
          Stylesheet: formData.stylesheet,
        }),
      });
      
      // Always include firm_id for admin (empty string means global template)
      templateData.firm_id = formData.firmId || '';
      
      if (id) {
        await templateService.updateTemplate(id, templateData);
        toast.success(t('templates.editor.success.update'));
      } else {
        await templateService.createTemplate(templateData);
        toast.success(t('templates.editor.success.create'));
      }
      navigate('/templates');
    } catch (error) {
      logger.error('Error saving template:', error);
      toast.error(t(id ? 'templates.editor.error.update' : 'templates.editor.error.create'));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const target = e.target;
    const name = target.name;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-8 rounded-full bg-primary-500" />
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{t(id ? 'templates.editor.title.edit' : 'templates.editor.title.new')}</h1>
            </div>
          </div>
          <button onClick={() => navigate('/templates')} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">{t('common.cancel')}</button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin Firm Selector - visible for admins */}
            <AdminFirmSelector
              selectedFirmId={formData.firmId}
              onFirmChange={(firmId) => setFormData({ ...formData, firmId })}
              className="mb-2"
              t={t}
            />

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.name.label')}</label>
              <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} placeholder={t('templates.editor.name.placeholder')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.statusField.label')}</label>
              <select 
                id="status" 
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="Active">{t('templates.editor.statusField.active')}</option>
                <option value="Inactive">{t('templates.editor.statusField.inactive')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.description.label')}</label>
              <textarea id="description" name="description" rows={3} required value={formData.description} onChange={handleChange} placeholder={t('templates.editor.description.placeholder')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>

            <div className="mt-4">
              <label htmlFor="stylesheet" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.stylesheet.label')}</label>
              <textarea id="stylesheet" name="stylesheet" rows={4} placeholder={t('templates.editor.stylesheet.placeholder')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" value={formData.stylesheet || ''} onChange={(e) => setFormData({ ...formData, stylesheet: e.target.value })} />
            </div>

            {/* Header Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templates.editor.header.label')}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({t('templates.editor.header.hint')})</span>
              </label>
              <TiptapEditor
                ref={headerEditorRef}
                content={formData.headerContent}
                onChange={(html) => setFormData(prev => ({ ...prev, headerContent: html }))}
                onReady={handleEditorReady}
                height={250}
              />
            </div>

            {/* Body Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templates.editor.content.label')}
              </label>
              <TiptapEditor
                ref={bodyEditorRef}
                content={formData.templateContent}
                onChange={(html) => setFormData(prev => ({ ...prev, templateContent: html }))}
                onReady={handleEditorReady}
                height={400}
              />
            </div>

            {/* Footer Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templates.editor.footer.label')}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({t('templates.editor.footer.hint')})</span>
              </label>
              <TiptapEditor
                ref={footerEditorRef}
                content={formData.footerContent}
                onChange={(html) => setFormData(prev => ({ ...prev, footerContent: html }))}
                onReady={handleEditorReady}
                height={250}
              />
            </div>

            {/* Footer Height */}
            <div>
              <label htmlFor="footerHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('templates.editor.footerHeight.label', 'Hauteur du footer (mm)')}
              </label>
              <input 
                type="number" 
                id="footerHeight" 
                name="footerHeight" 
                min="10" 
                max="250" 
                value={formData.footerHeight} 
                onChange={(e) => setFormData({ ...formData, footerHeight: parseInt(e.target.value) || 25 })} 
                className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" 
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('templates.editor.footerHeight.hint', 'Hauteur réservée pour le footer dans le PDF (10-250mm)')}</p>
            </div>

            <div className="flex items-center">
              <input type="checkbox" id="popular" name="popular" checked={formData.popular} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
              <label htmlFor="popular" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">{t('templates.editor.popular.label')}</label>
            </div>

            <div className="flex justify-end space-x-4">
              <button type="button" onClick={() => navigate('/templates')} className="btn btn-secondary px-4 py-2">{t('common.cancel')}</button>
              <button type="submit" disabled={!editorReady} className={`btn btn-primary px-4 py-2 ${!editorReady ? 'opacity-50 cursor-not-allowed' : ''}`}>{t('common.save')}</button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default NewTemplatePage;
