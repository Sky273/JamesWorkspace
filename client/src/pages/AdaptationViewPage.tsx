/**
 * AdaptationViewPage Component
 * Displays a single adaptation by ID from URL parameter
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { createAuthOptionsWithCsrf, fetchWithAuth, fetchWithCsrfRetry } from '../utils/apiInterceptor';
import { templateService } from '../utils/templateService';
import type { TiptapEditorRef } from '../components/TiptapEditor';
import SendEmailModal from '../components/ResumeAnalysis/SendEmailModal';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import i18n from '../i18n';
import { removeSuggestionMarkers } from '../components/TiptapEditor';
import { normalizeTemplateStylesheet, summarizeTemplatePayload } from '../utils/templateFragments';
import AdaptationHeader from './AdaptationHeader';
import AdaptationExportModal from './AdaptationExportModal';
import {
  AdaptationBackButton,
  AdaptationErrorState,
  AdaptationLoadingState,
  AdaptationPanel,
  AdaptationTabContent,
  AdaptationTabs,
} from './AdaptationViewPage.sections';
import type { Adaptation, AdaptationViewTab, Template } from './AdaptationViewPage.types';
import {
  buildEmailAttachmentHtml,
  buildTemplateHtml,
  formatAdaptationDate,
} from './AdaptationViewPage.utils';

const AdaptationViewPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromDealsView =
    (location.state as { from?: string } | null)?.from === 'dealsGroupedView' ||
    sessionStorage.getItem('dealsGroupedViewState') !== null;
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();

  const [adaptation, setAdaptation] = useState<Adaptation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdaptationViewTab>('adapted');

  const [_editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);

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

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const fetchedTemplates = await templateService.getAllTemplates();
        const activeTemplates = fetchedTemplates.filter((template: Template) =>
          template.Status?.toLowerCase() === 'active'
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

  const handleSave = async (): Promise<void> => {
    if (!editorRef.current || !adaptation) return;

    try {
      setSaving(true);
      const content = editorRef.current.getContent();
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'Adapted Text': content }),
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

  const handleSaveTitle = async (): Promise<void> => {
    if (!adaptation) return;

    try {
      setSavingTitle(true);
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'Adapted Title': editedTitle }),
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

  const handleExportToPDF = async (): Promise<void> => {
    if (!adaptation || !selectedTemplate) return;

    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) throw new Error('Template not found');

      const rawContent = editorRef.current?.getContent() || adaptation['Adapted Text'] || '';
      const content = removeSuggestionMarkers(rawContent);
      const { processedBody, processedHeader, processedFooter, name } = buildTemplateHtml(
        template,
        adaptation,
        content,
      );
      logger.warn('Adaptation view PDF export payload normalized', {
        templateId: template.id,
        filename: `${name.replace(/[^a-zA-Z]/g, '_')}_adapted.pdf`,
        htmlLength: processedBody.length,
        ...summarizeTemplatePayload(template),
      });

      const exportOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          htmlContent: processedBody,
          filename: `${name.replace(/[^a-zA-Z]/g, '_')}_adapted.pdf`,
          stylesheet: normalizeTemplateStylesheet(template.Stylesheet),
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25,
        }),
      });

      const response = await fetchWithCsrfRetry('/generate-pdf', exportOptions, 300000);
      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${name.replace(/\s+/g, '_')}_adapted_${template.Name}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
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

  if (loading) {
    return <AdaptationLoadingState />;
  }

  if (error || !adaptation) {
    return (
      <AdaptationErrorState
        error={error || t('errors.adaptationNotFoundDescription')}
        onBack={handleBack}
        t={t}
      />
    );
  }

  return (
    <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="cv-surface mx-auto max-w-5xl rounded-[2.5rem] p-6 sm:p-8">
        <AdaptationBackButton onBack={handleBack} t={t} />

        <AdaptationPanel>
          <AdaptationHeader
            adaptation={adaptation}
            editingTitle={editingTitle}
            editedTitle={editedTitle}
            savingTitle={savingTitle}
            onEditedTitleChange={setEditedTitle}
            onStartEditTitle={() => {
              setEditedTitle((adaptation['Adapted Title'] as string) || '');
              setEditingTitle(true);
            }}
            onSaveTitle={handleSaveTitle}
            onCancelEditTitle={() => setEditingTitle(false)}
            onViewResume={handleViewResume}
            onViewMission={handleViewMission}
            formatAdaptationDate={(dateString) => formatAdaptationDate(dateString, i18n.language)}
          />

          <AdaptationTabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />

          <div className="p-6">
            <AdaptationTabContent
              activeTab={activeTab}
              adaptation={adaptation}
              editorRef={editorRef}
              hasChanges={hasChanges}
              saving={saving}
              onEditorChange={() => setHasChanges(true)}
              onEditorReady={() => setEditorReady(true)}
              onExport={() => setShowExportModal(true)}
              onSendEmail={() => setShowEmailModal(true)}
              onSave={handleSave}
              t={t}
            />
          </div>
        </AdaptationPanel>
      </div>

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

      {showEmailModal && adaptation && (
        <SendEmailModal
          isOpen={showEmailModal}
          resumeId={adaptation['Resume ID'] || adaptation.Resume?.[0] || ''}
          resumeName={adaptation['Resume Name'] || adaptation.ResumeName || ''}
          resumeTitle={adaptation.ResumeTitle || adaptation['Mission Title'] || ''}
          currentVersion={1}
          onClose={() => setShowEmailModal(false)}
          onGenerateAttachment={async (format) => {
            const allTemplates = await templateService.getAllTemplates();
            if (!allTemplates || allTemplates.length === 0) {
              throw new Error('No CV template available');
            }

            let template: Template | null = null;
            if (selectedTemplate) {
              template = allTemplates.find((currentTemplate: Template) => currentTemplate.id === selectedTemplate) || null;
            }
            if (!template) {
              template = allTemplates[0];
            }

            const rawContent = editorRef.current?.getContent() || adaptation['Adapted Text'] || '';
            const content = removeSuggestionMarkers(rawContent);
            const { htmlContent, filenameBase } = buildEmailAttachmentHtml(template, adaptation, content);

            const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
            const fileExtension = format === 'pdf' ? 'pdf' : format;
            const filename = `${filenameBase}.${fileExtension}`;

            const options = await createAuthOptionsWithCsrf({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                htmlContent,
                filename,
                footerHeight: template.FooterHeight || 50,
                format,
              }),
            });

            const response = await fetchWithCsrfRetry(endpoint, options, 300000);
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
