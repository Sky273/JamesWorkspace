/**
 * NewTemplatePage Component
 * TypeScript version
 */

import { useState, useEffect, useRef, useCallback, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { templateService } from '../utils/templateService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger.frontend';
import AdminFirmSelector from '../components/AdminFirmSelector';

import { loadTinyMCE } from '../utils/lazyTinyMCE';

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

// TinyMCE types are declared in src/types/tinymce.d.ts

const NewTemplatePage = (): JSX.Element => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const headerEditorRef = useRef<{ setContent: (content: string) => void; getContent: () => string } | null>(null);
  const bodyEditorRef = useRef<{ setContent: (content: string) => void; getContent: () => string } | null>(null);
  const footerEditorRef = useRef<{ setContent: (content: string) => void; getContent: () => string } | null>(null);
  const initialContentRef = useRef<{ header: string; body: string; footer: string }>({ header: '', body: '', footer: '' });
  const editorsInitializedRef = useRef<boolean>(false);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [tinymceLoaded, setTinymceLoaded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [dataReady, setDataReady] = useState<boolean>(false);
  const { t } = useTranslation();

  useEffect(() => {
    let mounted = true;
    loadTinyMCE()
      .then(() => { if (mounted) setTinymceLoaded(true); })
      .catch((err) => { logger.error('Failed to load TinyMCE:', err); toast.error('Failed to load editor'); });
    return () => { mounted = false; };
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
          const newFormData = {
            name: extractedTemplate.name || '',
            description: extractedTemplate.description || '',
            headerContent: extractedTemplate.headerContent || '',
            templateContent: extractedTemplate.templateContent || '',
            footerContent: extractedTemplate.footerContent || '',
            footerHeight: extractedTemplate.footerHeight || 25,
            stylesheet: extractedTemplate.stylesheet || '',
            status: 'Active',
            popular: false,
            tags: extractedTemplate.tags || [],
            firmId: ''
          };
          setFormData(newFormData);
          // Store initial content for editors
          initialContentRef.current = {
            header: newFormData.headerContent,
            body: newFormData.templateContent,
            footer: newFormData.footerContent
          };
          // Clear sessionStorage after loading
          sessionStorage.removeItem('extractedTemplate');
          toast.success(t('templates.extract.templateLoaded'));
          setDataReady(true);
          return;
        } catch (parseError) {
          logger.error('Error parsing extracted template:', parseError);
          sessionStorage.removeItem('extractedTemplate');
        }
      }

      if (!id) {
        // New template - data is ready immediately
        setDataReady(true);
        return;
      }
      try {
        setLoading(true);
        const template = await templateService.getTemplateById(id);
        const newFormData = {
          name: template.Name || '',
          description: template.Description || '',
          headerContent: template.HeaderContent || '',
          templateContent: template.TemplateContent || '',
          footerContent: template.FooterContent || '',
          footerHeight: template.FooterHeight || 25,
          stylesheet: template.Stylesheet || '',
          status: template.Status?.charAt(0).toUpperCase() + template.Status?.slice(1).toLowerCase() || 'Active',
          popular: template.Popular || false,
          tags: template.Tags || [],
          firmId: template.FirmId || template.firm_id || ''
        };
        setFormData(newFormData);
        // Store initial content for editors
        initialContentRef.current = {
          header: newFormData.headerContent,
          body: newFormData.templateContent,
          footer: newFormData.footerContent
        };
        setDataReady(true);
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

  const handleFilePicker = (callback: (url: string, meta: { title: string; alt: string }) => void): void => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.addEventListener('change', function () {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function () {
        callback(reader.result as string, { title: file.name, alt: file.name });
      };
    });
    input.click();
  };

  const handleImageUpload = (blobInfo: { base64: () => string; blob: () => Blob }): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        if (blobInfo.base64()) {
          resolve('data:' + blobInfo.blob().type + ';base64,' + blobInfo.base64());
        } else {
          const reader = new FileReader();
          reader.readAsDataURL(blobInfo.blob());
          reader.onload = () => {
            const result = reader.result as string;
            const base64data = result.split(',')[1];
            resolve('data:' + blobInfo.blob().type + ';base64,' + base64data);
          };
          reader.onerror = (error) => reject(error);
        }
      } catch (error) {
        reject('Image upload failed');
      }
    });
  };

  // Configuration commune pour les éditeurs
  const baseEditorConfig = {
    skin: 'oxide',
    content_css: 'default',
    promotion: false,
    branding: false,
    license_key: 'gpl',
    convert_urls: false,
    relative_urls: false,
    remove_script_host: false,
    base_url: '/tinymce',
    document_base_url: window.location.origin,
    content_style: `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.4; margin: 1rem; }`,
    images_upload_handler: handleImageUpload,
    file_picker_callback: handleFilePicker,
  };

  // Configuration complète pour tous les éditeurs
  const fullEditorConfig = {
    ...baseEditorConfig,
    menubar: true,
    file_picker_types: 'file image media',
    plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
    toolbar1: 'undo redo | blocks | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist | link image',
    toolbar2: 'formatselect | forecolor backcolor | table | fullscreen code help',
    toolbar_mode: 'sliding',
    toolbar_sticky: true,
  };

  const initEditors = useCallback((): void => {
    const tinymce = window.tinymce;
    if (!tinymce || editorsInitializedRef.current) return;

    editorsInitializedRef.current = true;
    let editorsReady = 0;
    const totalEditors = 3;

    const checkAllEditorsReady = () => {
      editorsReady++;
      if (editorsReady === totalEditors) {
        setEditorReady(true);
      }
    };

    try {
      // Header Editor (complet)
      tinymce.init({
        ...fullEditorConfig,
        height: 250,
        selector: '#headerEditor',
        setup: (editor: { on: (event: string, callback: () => void) => void; setContent: (content: string) => void; getContent: () => string }) => {
          editor.on('init', () => {
            headerEditorRef.current = editor;
            editor.setContent(initialContentRef.current.header || '');
            checkAllEditorsReady();
          });
          editor.on('change', () => {
            const content = editor.getContent();
            setFormData(prev => ({ ...prev, headerContent: content }));
          });
        },
      });

      // Body Editor (complet)
      tinymce.init({
        ...fullEditorConfig,
        height: 400,
        selector: '#bodyEditor',
        setup: (editor: { on: (event: string, callback: () => void) => void; setContent: (content: string) => void; getContent: () => string }) => {
          editor.on('init', () => {
            bodyEditorRef.current = editor;
            editor.setContent(initialContentRef.current.body || '');
            checkAllEditorsReady();
          });
          editor.on('change', () => {
            const content = editor.getContent();
            setFormData(prev => ({ ...prev, templateContent: content }));
          });
        },
      });

      // Footer Editor (complet)
      tinymce.init({
        ...fullEditorConfig,
        height: 250,
        selector: '#footerEditor',
        setup: (editor: { on: (event: string, callback: () => void) => void; setContent: (content: string) => void; getContent: () => string }) => {
          editor.on('init', () => {
            footerEditorRef.current = editor;
            editor.setContent(initialContentRef.current.footer || '');
            checkAllEditorsReady();
          });
          editor.on('change', () => {
            const content = editor.getContent();
            setFormData(prev => ({ ...prev, footerContent: content }));
          });
        },
      });
    } catch (error) {
      logger.error('Error initializing TinyMCE editors:', error);
      editorsInitializedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && tinymceLoaded && dataReady && !editorsInitializedRef.current) {
      initEditors();
    }
    return () => {
      const tinymce = window.tinymce;
      if (tinymce) {
        tinymce.remove('#headerEditor');
        tinymce.remove('#bodyEditor');
        tinymce.remove('#footerEditor');
        headerEditorRef.current = null;
        bodyEditorRef.current = null;
        footerEditorRef.current = null;
        editorsInitializedRef.current = false;
      }
    };
  }, [loading, tinymceLoaded, dataReady, initEditors]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error(t('templates.editor.validation.nameRequired')); return; }
    if (!formData.templateContent?.trim()) { toast.error(t('templates.editor.validation.contentRequired')); return; }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateData: any = {
        name: formData.name,
        description: formData.description,
        headerContent: formData.headerContent,
        templateContent: formData.templateContent,
        footerContent: formData.footerContent,
        footerHeight: formData.footerHeight,
        stylesheet: formData.stylesheet,
        tags: Array.isArray(formData.tags) ? formData.tags : [],
        popular: Boolean(formData.popular),
        status: formData.status || 'Active'
      };
      
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t(id ? 'templates.editor.title.edit' : 'templates.editor.title.new')}</h1>
          <button onClick={() => navigate('/templates')} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">{t('common.cancel')}</button>
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
              <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} placeholder={t('templates.editor.name.placeholder')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.statusField.label')}</label>
              <select 
                id="status" 
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="Active">{t('templates.editor.statusField.active')}</option>
                <option value="Inactive">{t('templates.editor.statusField.inactive')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.description.label')}</label>
              <textarea id="description" name="description" rows={3} required value={formData.description} onChange={handleChange} placeholder={t('templates.editor.description.placeholder')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>

            <div className="mt-4">
              <label htmlFor="stylesheet" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('templates.editor.stylesheet.label')}</label>
              <textarea id="stylesheet" name="stylesheet" rows={4} placeholder={t('templates.editor.stylesheet.placeholder')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={formData.stylesheet || ''} onChange={(e) => setFormData({ ...formData, stylesheet: e.target.value })} />
            </div>

            {/* Header Editor */}
            <div>
              <label htmlFor="headerEditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templates.editor.header.label')}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({t('templates.editor.header.hint')})</span>
              </label>
              <div className="min-h-[250px] border rounded-md bg-white dark:bg-gray-800">
                <textarea id="headerEditor" defaultValue={formData.headerContent} className="hidden" />
              </div>
            </div>

            {/* Body Editor */}
            <div>
              <label htmlFor="bodyEditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templates.editor.content.label')}
              </label>
              <div className="min-h-[400px] border rounded-md bg-white dark:bg-gray-800">
                <textarea id="bodyEditor" defaultValue={formData.templateContent} className="hidden" />
              </div>
            </div>

            {/* Footer Editor */}
            <div>
              <label htmlFor="footerEditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templates.editor.footer.label')}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({t('templates.editor.footer.hint')})</span>
              </label>
              <div className="min-h-[250px] border rounded-md bg-white dark:bg-gray-800">
                <textarea id="footerEditor" defaultValue={formData.footerContent} className="hidden" />
              </div>
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
                className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('templates.editor.footerHeight.hint', 'Hauteur réservée pour le footer dans le PDF (10-250mm)')}</p>
            </div>

            <div className="flex items-center">
              <input type="checkbox" id="popular" name="popular" checked={formData.popular} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
              <label htmlFor="popular" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">{t('templates.editor.popular.label')}</label>
            </div>

            <div className="flex justify-end space-x-4">
              <button type="button" onClick={() => navigate('/templates')} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">{t('common.cancel')}</button>
              <button type="submit" disabled={!editorReady} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{t(id ? 'templates.editor.title.edit' : 'templates.editor.title.new')}</button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default NewTemplatePage;
