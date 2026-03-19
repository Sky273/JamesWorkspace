/**
 * AdaptationViewPage Component
 * Displays a single adaptation by ID from URL parameter
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeftIcon, 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';
import { templateService } from '../utils/templateService';
import { TiptapEditor } from '../components/TiptapEditor';
import type { TiptapEditorRef } from '../components/TiptapEditor';
import AdaptationAnalysisView from '../components/AdaptationAnalysisView';
import SendEmailModal from '../components/ResumeAnalysis/SendEmailModal';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { formatDate } from '../utils/dateFormatter';
import i18n from '../i18n';
import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';
import AdaptationHeader from './AdaptationHeader';
import AdaptationExportModal from './AdaptationExportModal';

interface Template {
  id: string;
  Name: string;
  Status?: string;
  TemplateContent?: string;
  Stylesheet?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
}

interface Adaptation {
  id: string;
  Resume?: string[];
  Mission?: string[];
  'Resume ID'?: string;
  'Mission ID'?: string;
  'Resume Name'?: string;
  'Candidate Name'?: string;
  'Adapted Title'?: string;
  'Adapted Text'?: string;
  'Match Score'?: number;
  'Match Analysis'?: string;
  'Mission Title'?: string;
  'Mission Content'?: string;
  'Mission Client ID'?: string;
  'Mission Contact ID'?: string;
  Status?: string;
  'Created At'?: string;
  ResumeName?: string;
  ResumeTitle?: string;
  [key: string]: unknown;
}

const AdaptationViewPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromDealsView = (location.state as { from?: string } | null)?.from === 'dealsGroupedView'
    || sessionStorage.getItem('dealsGroupedViewState') !== null;
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const [adaptation, setAdaptation] = useState<Adaptation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'adapted' | 'analysis' | 'mission'>('adapted');
  
  // Editor state
  const [_editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Adapted title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    const loadAdaptation = async () => {
      if (!id) {
        setError('No adaptation ID provided');
        setLoading(false);
        return;
      }

      try {
        logger.log('[AdaptationViewPage] Fetching adaptation:', id);
        const response = await authGet(`/api/adaptations/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAdaptation(data);
        } else {
          setError('Adaptation not found');
        }
      } catch (err) {
        logger.error('[AdaptationViewPage] Error fetching adaptation:', err);
        setError('Failed to load adaptation');
        toast.error(t('errors.loadAdaptation'));
      } finally {
        setLoading(false);
      }
    };

    loadAdaptation();
  }, [id, authGet, t]);

  const handleBack = () => {
    if (fromDealsView) {
      navigate('/resumes', { state: { viewMode: 'byDeal' } });
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/adaptations');
    }
  };

  const handleViewResume = () => {
    if (adaptation?.Resume && adaptation.Resume.length > 0) {
      navigate(`/resumes/${adaptation.Resume[0]}`);
    }
  };

  const handleViewMission = () => {
    if (adaptation?.Mission && adaptation.Mission.length > 0) {
      navigate(`/missions/${adaptation.Mission[0]}`);
    }
  };


  // Load templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const fetchedTemplates = await templateService.getAllTemplates();
        // Filter active templates (case-insensitive)
        const activeTemplates = fetchedTemplates.filter((t: Template) => 
          t.Status?.toLowerCase() === 'active'
        );
        logger.log('Fetched templates', { total: fetchedTemplates.length, active: activeTemplates.length });
        setTemplates(activeTemplates.length > 0 ? activeTemplates : fetchedTemplates);
        if (fetchedTemplates.length > 0) {
          setSelectedTemplate(activeTemplates.length > 0 ? activeTemplates[0].id : fetchedTemplates[0].id);
        }
      } catch (err) {
        logger.error('Error fetching templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);


  // Save adaptation
  const handleSave = async (): Promise<void> => {
    if (!editorRef.current || !adaptation) return;
    
    try {
      setSaving(true);
      const content = editorRef.current.getContent();
      const authOptions = await createAuthOptionsWithCsrf({ 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 'Adapted Text': content }) 
      });
      
      const response = await fetchWithAuth(`/api/adaptations/${adaptation.id}`, authOptions);
      if (!response.ok) throw new Error('Failed to save');
      
      setAdaptation({ ...adaptation, 'Adapted Text': content });
      setHasChanges(false);
      toast.success(t('common.saved'));
    } catch (err) {
      logger.error('Error saving adaptation:', err);
      toast.error(t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Save adapted title
  const handleSaveTitle = async (): Promise<void> => {
    if (!adaptation) return;
    
    try {
      setSavingTitle(true);
      const authOptions = await createAuthOptionsWithCsrf({ 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 'Adapted Title': editedTitle }) 
      });
      
      const response = await fetchWithAuth(`/api/adaptations/${adaptation.id}`, authOptions);
      if (!response.ok) throw new Error('Failed to save title');
      
      setAdaptation({ ...adaptation, 'Adapted Title': editedTitle });
      setEditingTitle(false);
      toast.success(t('common.saved'));
    } catch (err) {
      logger.error('Error saving adapted title:', err);
      toast.error(t('errors.saveFailed'));
    } finally {
      setSavingTitle(false);
    }
  };

  // Export to PDF
  const handleExportToPDF = async (): Promise<void> => {
    if (!adaptation || !selectedTemplate) return;
    
    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) throw new Error('Template not found');

      // Clean suggestion markers from content before export
      const rawContent = editorRef.current?.getContent() || adaptation['Adapted Text'] || '';
      const content = removeSuggestionMarkers(rawContent);
      const name = adaptation['Resume Name'] || adaptation['Candidate Name'] || 'Candidat';
      const title = adaptation['Adapted Title'] || adaptation['Mission Title'] || 'CV Adapté';

      let processedBody = template.TemplateContent || '';
      processedBody = processedBody.replace(/-name-/g, name);
      processedBody = processedBody.replace(/-title-/g, title);
      processedBody = processedBody.replace(/-content-/g, content);

      let processedHeader = template.HeaderContent || '';
      if (processedHeader) {
        processedHeader = processedHeader.replace(/-name-/g, name);
        processedHeader = processedHeader.replace(/-title-/g, title);
      }

      let processedFooter = template.FooterContent || '';
      if (processedFooter) {
        processedFooter = processedFooter.replace(/-name-/g, name);
        processedFooter = processedFooter.replace(/-title-/g, title);
      }

      const response = await fetchWithAuth('/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ 
          htmlContent: processedBody, 
          filename: `${name.replace(/[^a-zA-Z]/g, '_')}_adapted.pdf`,
          stylesheet: template.Stylesheet || '',
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25
        })
      }, 300000); // 5 minutes for PDF generation

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\s+/g, '_')}_adapted_${template.Name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('adaptations.exportSuccess'));
      setShowExportModal(false);
    } catch (err) {
      logger.error('Error exporting PDF:', err);
      toast.error(t('errors.exportFailed'));
    } finally {
      setExportLoading(false);
    }
  };


  const formatAdaptationDate = (dateString?: string) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return formatDate(dateString, 'long', locale) || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !adaptation) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {t('errors.adaptationNotFound')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {error || t('errors.adaptationNotFoundDescription')}
              </p>
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                {t('common.back')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('common.back')}
          </button>
        </motion.div>

        {/* Adaptation content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Header - Candidate Name + Adapted Title */}
          <AdaptationHeader
            adaptation={adaptation}
            editingTitle={editingTitle}
            editedTitle={editedTitle}
            savingTitle={savingTitle}
            onEditedTitleChange={setEditedTitle}
            onStartEditTitle={() => {
              setEditedTitle(adaptation['Adapted Title'] as string || '');
              setEditingTitle(true);
            }}
            onSaveTitle={handleSaveTitle}
            onCancelEditTitle={() => setEditingTitle(false)}
            onViewResume={handleViewResume}
            onViewMission={handleViewMission}
            formatAdaptationDate={formatAdaptationDate}
          />

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('adapted')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'adapted'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('adaptations.tabs.adaptedCV')}
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'analysis'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('adaptations.tabs.analysis')}
              </button>
              <button
                onClick={() => setActiveTab('mission')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'mission'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('adaptations.tabs.mission')}
              </button>
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'adapted' && (
              <div className="space-y-4">
                {adaptation['Adapted Text'] ? (
                  <>
                    {/* Action buttons */}
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setShowEmailModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <EnvelopeIcon className="w-4 h-4" />
                        {t('adaptations.sendEmail', 'Envoyer par email')}
                      </button>
                      <button 
                        onClick={() => setShowExportModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        {t('adaptations.exportPDF')}
                      </button>
                      <button 
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          hasChanges 
                            ? 'text-white bg-blue-600 hover:bg-blue-700' 
                            : 'text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                        }`}
                      >
                        {saving ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                    
                    {/* Tiptap Editor */}
                    <TiptapEditor
                      ref={editorRef}
                      content={adaptation['Adapted Text']}
                      onChange={() => setHasChanges(true)}
                      onReady={() => setEditorReady(true)}
                      height={500}
                    />
                  </>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    {t('adaptations.noAdaptedText')}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div>
                {adaptation['Match Analysis'] ? (
                  <AdaptationAnalysisView adaptation={adaptation} />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    {t('adaptations.noAnalysis')}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'mission' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {adaptation['Mission Title'] || t('adaptations.card.unknownMission')}
                </h3>
                {adaptation['Mission Content'] ? (
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={createSafeHtml(adaptation['Mission Content'])}
                  />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    {t('missions.noDescription')}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <AdaptationExportModal
          templates={templates}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          loadingTemplates={loadingTemplates}
          exportLoading={exportLoading}
          onExport={handleExportToPDF}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Email Modal */}
      {showEmailModal && adaptation && (
        <SendEmailModal
          isOpen={showEmailModal}
          resumeId={adaptation['Resume ID'] || (adaptation.Resume && adaptation.Resume[0]) || ''}
          resumeName={adaptation['Resume Name'] || adaptation.ResumeName || ''}
          resumeTitle={adaptation.ResumeTitle || adaptation['Mission Title'] || ''}
          currentVersion={1}
          onClose={() => setShowEmailModal(false)}
          onGenerateAttachment={async (format) => {
            // Always fetch templates to ensure we have one for document generation
            const allTemplates = await templateService.getAllTemplates();
            if (!allTemplates || allTemplates.length === 0) {
              throw new Error('No CV template available');
            }
            // Use selectedTemplate if valid, otherwise use first available
            let template: Template | null = null;
            if (selectedTemplate) {
              template = allTemplates.find((t: Template) => t.id === selectedTemplate) || null;
            }
            if (!template) {
              template = allTemplates[0];
            }
            
            // Clean suggestion markers from content before export
            const rawContent = editorRef.current?.getContent() || adaptation['Adapted Text'] || '';
            const content = removeSuggestionMarkers(rawContent);
            const name = adaptation['Resume Name'] || adaptation.ResumeName || 'Candidat';
            const title = adaptation['Mission Title'] || 'CV Adapté';

            let processedBody = template.TemplateContent || '';
            processedBody = processedBody.replace(/-name-/g, name);
            processedBody = processedBody.replace(/-title-/g, title);
            processedBody = processedBody.replace(/-content-/g, content);

            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>${template.Stylesheet || ''}</style>
              </head>
              <body>
                ${template.HeaderContent || ''}
                ${processedBody}
                ${template.FooterContent || ''}
              </body>
              </html>
            `;

            // Determine endpoint and filename based on format
            const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
            const fileExtension = format === 'pdf' ? 'pdf' : format;
            const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
            
            const options = await createAuthOptionsWithCsrf({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                htmlContent,
                filename,
                footerHeight: template.FooterHeight || 50,
                format
              })
            });

            const response = await fetchWithAuth(endpoint, options, 300000); // 5 minutes for PDF/DOCX generation
            if (!response.ok) throw new Error(`Failed to generate ${format.toUpperCase()}`);
            return await response.blob();
          }}
          prefilledClientId={adaptation['Mission Client ID'] as string | undefined}
          prefilledContactId={adaptation['Mission Contact ID'] as string | undefined}
          missionTitle={adaptation['Mission Title']}
          isAdaptation={true}
        />
      )}
    </div>
  );
};

export default AdaptationViewPage;
