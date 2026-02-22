/**
 * Resume Analysis Component
 * TypeScript version
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tab } from '@headlessui/react';
import {
  ChartBarIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowPathIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import { useResume } from '../context/ResumeContext';
import { resumeService } from '../utils/resumeService';
import ImprovementAnimation from './ImprovementAnimation';
import ResumeAdaptation from './ResumeAdaptation';
import classNames from 'classnames';
import { templateService } from '../utils/templateService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger.frontend';
import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';

import type { TinyMCE, TinyMCEEditor } from '../types/tinymce.d';
import SkillsTagsTab from './ResumeAnalysis/SkillsTagsTab';
import OriginalTextTab from './ResumeAnalysis/OriginalTextTab';
import ImprovedTextTab from './ResumeAnalysis/ImprovedTextTab';
import CompareTab from './ResumeAnalysis/CompareTab';
import ExportTab from './ResumeAnalysis/ExportTab';
import OverviewTab from './ResumeAnalysis/OverviewTab';
import SendEmailModal from './ResumeAnalysis/SendEmailModal';

import { loadTinyMCE } from '../utils/lazyTinyMCE';
import { getVersions } from '../services/resumeVersionsService';

// Using any for Resume to maintain compatibility with ResumeContext
type Resume = any;

interface Template {
  id: string;
  Name: string;
  HeaderContent?: string;
  TemplateContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
  Stylesheet?: string;
}

interface TabConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  content: JSX.Element;
}

interface ResumeAnalysisProps {
  resume: Resume;
}

const ResumeAnalysis = ({ resume }: ResumeAnalysisProps): JSX.Element | null => {
  const { improveCurrentResume, loading, processingStep, updateImprovedContent, setCurrentResume } = useResume();
  const { t } = useTranslation();
  const [localResume, setLocalResume] = useState<Resume>(resume);

  useEffect(() => { setLocalResume(resume); }, [resume]);

  const updateResumeField = async (field: string, value: string): Promise<void> => {
    try {
      await resumeService.updateResume(resume.id, { [field]: value });
      const updatedResume = { ...localResume, [field]: value };
      setLocalResume(updatedResume);
      setCurrentResume(updatedResume);
    } catch (error) {
      logger.error(`Error updating ${field}:`, error);
      toast.error(`Failed to update ${field}`);
    }
  };

  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [isImproving, setIsImproving] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [showImprovement, setShowImprovement] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('improving');
  const [showAdaptationModal, setShowAdaptationModal] = useState<boolean>(false);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [tinymceLoaded, setTinymceLoaded] = useState<boolean>(false);
  const [currentVersion, setCurrentVersion] = useState<number>(resume['Current Version'] || 0);
  const [versionLoaded, setVersionLoaded] = useState<boolean>(false);

  const initializationInProgress = useRef<boolean>(false);
  const editorRef = useRef<{ getContent: () => string; setContent: (content: string) => void } | null>(null);

  useEffect(() => {
    let mounted = true;
    loadTinyMCE().then(() => { if (mounted) setTinymceLoaded(true); }).catch((err) => { logger.error('Failed to load TinyMCE:', err); });
    return () => { mounted = false; };
  }, []);

  // Load latest version when resume changes
  useEffect(() => {
    const loadLatestVersion = async () => {
      if (!resume?.id || versionLoaded) return;
      
      try {
        const response = await getVersions(resume.id, { limit: 1 });
        if (response.versions.length > 0) {
          const latestVersion = response.versions[0];
          setCurrentVersion(latestVersion.versionNumber);
          
          // If the resume's improved text differs from the latest version, update it
          if (latestVersion.improvedText && latestVersion.improvedText !== resume['Improved Text']) {
            const updatedResume = {
              ...localResume,
              'Improved Text': latestVersion.improvedText,
              'Current Version': latestVersion.versionNumber,
              'Improved Global Rating': latestVersion.improvedGlobalRating,
              'Improved Skills Score': latestVersion.improvedSkillsScore,
              'Improved Experience Score': latestVersion.improvedExperienceScore,
              'Improved Education Score': latestVersion.improvedEducationScore,
              'Improved ATS Score': latestVersion.improvedAtsScore,
              'Improved Executive Summary Score': latestVersion.improvedExecutiveSummaryScore,
              'Improved Hobbies Languages Score': latestVersion.improvedHobbiesLanguagesScore
            };
            setLocalResume(updatedResume);
            logger.info('Loaded latest version', { versionNumber: latestVersion.versionNumber });
          }
        }
        setVersionLoaded(true);
      } catch (error) {
        logger.error('Failed to load latest version:', error);
        setVersionLoaded(true);
      }
    };

    loadLatestVersion();
  }, [resume?.id, versionLoaded, localResume]);

  const getSkillsAndTags = useCallback((): Record<string, string[]> => {
    if (!resume) return {};
    const getFieldValue = (field: string): string[] => {
      const value = resume[field];
      if (!value) return [];
      if (Array.isArray(value)) return value as string[];
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch { return [value]; }
      }
      return [];
    };
    return {
      'Technical Skills': getFieldValue('Skills'),
      'Tools': getFieldValue('Tools'),
      'Industries': getFieldValue('Industries'),
      'Soft Skills': getFieldValue('Soft Skills')
    };
  }, [resume]);

  const handleSaveImprovedContent = useCallback(async (): Promise<void> => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      try {
        const result = await updateImprovedContent(resume.id, content);
        if (result.currentVersion && result.currentVersion > 0) {
          setCurrentVersion(result.currentVersion);
        }
        toast.success('Content saved successfully');
      } catch (error) {
        logger.error('Failed to save content:', error);
        toast.error('Failed to save content');
      }
    }
  }, [resume.id, updateImprovedContent]);

  // Generate PDF blob (shared between export and email)
  const generatePdfBlob = useCallback(async (): Promise<Blob> => {
    const template = await templateService.getTemplateById(selectedTemplate);
    if (!template) throw new Error('Template not found');

    const content = resume['Improved Text'] || resume['Original Text'] || '';
    const candidateName = resume['Name'] || 'Candidate Name';
    const candidateTitle = resume['Title'] || 'Professional Title';
    const firmName = resume['FirmName'] || '';
    
    // Use trigram if anonymized, otherwise use candidate name
    const isAnonymized = resume['Anonymized'] === true || resume['Anonymized'] === 'true';
    const exportName = isAnonymized 
      ? (resume['Trigram'] || candidateName.substring(0, 3).toUpperCase())
      : candidateName;
    
    // Format: CandidateName_FirmName (no spaces, no dashes)
    const baseFilename = firmName 
      ? `${exportName}_${firmName}`
      : exportName;
    
    const simplifiedFilename = baseFilename.replace(/[^a-zA-Z0-9_]/g, '') + '.pdf';

    const stylesheet = template.Stylesheet || '';
    // Format content - preserve HTML if already formatted, otherwise wrap lines in paragraphs
    const improvedContent = content.includes('<') ? content : content.split('\n').filter((line: string) => line.trim()).map((line: string) => `<p>${line}</p>`).join('');
    
    // Process body content
    let processedBody = template.TemplateContent || '';
    
    // Handle various encodings of placeholders (TinyMCE may encode them)
    processedBody = processedBody.replace(/-name-/g, candidateName);
    processedBody = processedBody.replace(/&lt;name&gt;/g, candidateName);
    processedBody = processedBody.replace(/-title-/g, candidateTitle);
    processedBody = processedBody.replace(/&lt;title&gt;/g, candidateTitle);
    processedBody = processedBody.replace(/-content-/g, improvedContent);
    processedBody = processedBody.replace(/&lt;content&gt;/g, improvedContent);
    processedBody = processedBody.replace(/<p>-content-<\/p>/g, improvedContent);
    processedBody = processedBody.replace(/<p>&lt;content&gt;<\/p>/g, improvedContent);
    
    // Process header content (if exists)
    let processedHeader = template.HeaderContent || '';
    if (processedHeader) {
      processedHeader = processedHeader.replace(/-name-/g, candidateName);
      processedHeader = processedHeader.replace(/-title-/g, candidateTitle);
    }
    
    // Process footer content (if exists)
    let processedFooter = template.FooterContent || '';
    if (processedFooter) {
      processedFooter = processedFooter.replace(/-name-/g, candidateName);
      processedFooter = processedFooter.replace(/-title-/g, candidateTitle);
    }

    const response = await fetchWithAuth('/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ 
        htmlContent: processedBody, 
        filename: simplifiedFilename,
        stylesheet: stylesheet,
        headerContent: processedHeader || undefined,
        footerContent: processedFooter || undefined,
        footerHeight: template.FooterHeight || 25
      })
    });

    if (!response.ok) throw new Error(`Failed to generate PDF. Status: ${response.status}`);

    return await response.blob();
  }, [selectedTemplate, resume]);

  const handleExportToPDF = useCallback(async (): Promise<void> => {
    try {
      setExportLoading(true);
      
      const blob = await generatePdfBlob();
      
      const candidateName = resume['Name'] || 'Candidate Name';
      const firmName = resume['FirmName'] || '';
      const isAnonymized = resume['Anonymized'] === true || resume['Anonymized'] === 'true';
      const exportName = isAnonymized 
        ? (resume['Trigram'] || candidateName.substring(0, 3).toUpperCase())
        : candidateName;
      const baseFilename = firmName 
        ? `${exportName}_${firmName}`
        : exportName;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF exported successfully');
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF: ' + (error as Error).message);
    } finally {
      setExportLoading(false);
    }
  }, [selectedTemplate, resume]);

  const handleImprove = async (): Promise<void> => {
    setIsImproving(true);
    setShowImprovement(true);
    setCurrentStep('improving');
    
    try {
      await improveCurrentResume();
      setCurrentStep('analyzing');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error('Failed to improve resume:', error);
      // Error toast is handled in ResumeContext
    } finally {
      setIsImproving(false);
      setShowImprovement(false);
      setCurrentStep('improving');
    }
  };

  const handleAIModify = async (instructions: string): Promise<string> => {
    try {
      const tinymce = window.tinymce as TinyMCE | undefined;
      const editor = tinymce?.get('templateEditor');
      const currentContent = editor?.getContent() || resume['Improved Text'] || '';
      
      // Get selected text from TinyMCE editor (if any)
      const selectedText = editor?.selection?.getContent({ format: 'html' }) || '';
      const hasSelection = selectedText.trim().length > 0;
      
      logger.debug('AI Modify request', { 
        hasSelection, 
        selectedTextLength: selectedText.length,
        contentLength: currentContent.length 
      });
      
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: currentContent,
          instructions: instructions,
          selectedText: hasSelection ? selectedText : undefined
        })
      });
      
      const response = await fetchWithAuth(`/api/resumes/${resume.id}/ai-modify`, authOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to modify resume' }));
        throw new Error(errorData.error || 'Failed to modify resume with AI');
      }

      const { modifiedContent, modifiedSelection, message } = await response.json();
      
      // Update TinyMCE editor with new content
      if (editor) {
        if (hasSelection && modifiedSelection) {
          // Replace only the selected content
          editor.selection.setContent(modifiedSelection);
        } else if (modifiedContent) {
          // Replace entire content
          editor.setContent(modifiedContent);
        }
      }
      
      // Return the message to be displayed in the UI
      const defaultMessage = hasSelection 
        ? 'Sélection modifiée avec succès par l\'IA'
        : 'CV modifié avec succès par l\'IA';
      return message || defaultMessage;
    } catch (error) {
      logger.error('Failed to modify resume with AI:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de la modification par IA');
      throw error;
    }
  };

  const handleVersionRestored = useCallback(async (newVersion: number) => {
    setCurrentVersion(newVersion);
    // Reload the resume from the API to get the restored content
    try {
      // Fetch the updated resume from the backend (which was updated by restoreVersion)
      const updatedResumeData = await resumeService.getResume(resume.id);
      
      if (updatedResumeData) {
        const updatedResume = {
          ...localResume,
          ...updatedResumeData,
          'Current Version': newVersion
        };
        setLocalResume(updatedResume);
        setCurrentResume(updatedResume);
        
        // Update TinyMCE editor content with the restored text
        const restoredText = updatedResumeData['Improved Text'] || updatedResumeData.improved_text || '';
        if (editorRef.current && restoredText) {
          editorRef.current.setContent(restoredText);
        }
        
        toast.success(`Version ${newVersion} chargée`);
      }
    } catch (error) {
      logger.error('Failed to reload after version restore:', error);
      toast.error('Erreur lors du rechargement du CV');
    }
  }, [resume.id, localResume, setCurrentResume]);

  const tabsConfig = useMemo((): TabConfig[] => {
    const baseConfig: TabConfig[] = [
      { name: t('resume.analysis.tabs.overview'), icon: ChartBarIcon, content: <OverviewTab resume={resume} t={t} /> },
      { name: t('resume.analysis.tabs.skillsTags'), icon: AcademicCapIcon, content: <SkillsTagsTab resume={resume} /> },
      { name: t('resume.analysis.tabs.original'), icon: DocumentTextIcon, content: <OriginalTextTab resume={resume} isImproving={isImproving} onImprove={handleImprove} /> }
    ];

    if (resume['Improved Text']) {
      baseConfig.push({ name: t('resume.analysis.tabs.improved'), icon: SparklesIcon, content: <ImprovedTextTab resume={{...resume, 'Current Version': currentVersion}} onSave={handleSaveImprovedContent} onUpdateField={updateResumeField} editorReady={editorReady} onAIModify={handleAIModify} onVersionRestored={handleVersionRestored} onAdaptToMission={() => setShowAdaptationModal(true)} /> });
      baseConfig.push({ name: t('resume.analysis.tabs.compare'), icon: ArrowsUpDownIcon, content: <CompareTab resume={resume} /> });
      baseConfig.push({ name: t('resume.analysis.tabs.export'), icon: ArrowPathIcon, content: <ExportTab resume={resume} templates={templates} selectedTemplate={selectedTemplate} onTemplateChange={setSelectedTemplate} loadingTemplates={loadingTemplates} exportLoading={exportLoading} onExport={handleExportToPDF} onSendEmail={() => setShowEmailModal(true)} /> });
    }
    return baseConfig;
  }, [resume, isImproving, t, selectedTemplate, templates, loadingTemplates, exportLoading, handleExportToPDF, handleSaveImprovedContent, updateResumeField, editorReady, currentVersion, handleVersionRestored]);

  const tabs = useMemo(() => tabsConfig, [tabsConfig]);
  const improvedTabIndex = useMemo(() => tabs.findIndex(tab => tab.name === t('resume.analysis.tabs.improved')), [tabs, t]);

  // Parse suggestions for annotations - use post-improvement suggestions if available
  const parseSuggestions = useCallback(() => {
    try {
      // Prioritize post-improvement suggestions (Improved Key Improvements)
      const raw = resume['Improved Key Improvements'] || resume['Key Improvements'];
      if (!raw) return {};
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string[]>;
      }
      return {};
    } catch {
      return {};
    }
  }, [resume]);

  // Section keywords mapping for detecting sections in content
  const sectionKeywords: Record<string, string[]> = useMemo(() => ({
    executiveSummary: ['profil', 'résumé', 'summary', 'profile', 'about', 'à propos', 'objectif', 'objective'],
    skills: ['compétences', 'skills', 'expertise', 'technologies', 'outils', 'tools', 'langages'],
    experiences: ['expérience', 'experience', 'parcours', 'emploi', 'poste', 'mission', 'work history'],
    education: ['formation', 'education', 'diplôme', 'études', 'certifications', 'degree', 'university'],
    hobbiesLanguages: ['langues', 'languages', 'loisirs', 'hobbies', 'intérêts', 'interests', 'centres d\'intérêt'],
    atsOptimization: ['mots-clés', 'keywords', 'ats']
  }), []);

  // Apply annotations to detected sections
  const applyAnnotationsToSections = useCallback((editor: TinyMCEEditor) => {
    const suggestions = parseSuggestions();
    if (Object.keys(suggestions).length === 0) return;

    const body = editor.getBody();
    const headings = body.querySelectorAll('h1, h2, h3, h4, strong, b');
    
    // Track if we've seen the first h1 to skip it
    let firstH1Found = false;
    
    headings.forEach((heading: Element) => {
      const text = heading.textContent?.toLowerCase() || '';
      
      // Skip the first h1 (usually the candidate name/title)
      if (heading.tagName === 'H1') {
        if (!firstH1Found) {
          firstH1Found = true;
          return; // Skip this first h1
        }
      }
      
      for (const [sectionKey, keywords] of Object.entries(sectionKeywords)) {
        const sectionSuggestions = suggestions[sectionKey];
        if (!sectionSuggestions || sectionSuggestions.length === 0) continue;
        
        const matchesSection = keywords.some(keyword => text.includes(keyword.toLowerCase()));
        if (matchesSection) {
          // CRITICAL: Never apply suggestions to body or global level
          // Only apply to specific elements within the CV content
          let targetElement = heading.parentElement;
          
          // Skip if parent is body or doesn't exist - use heading itself instead
          if (!targetElement || targetElement === body || targetElement.tagName === 'BODY') {
            targetElement = heading as HTMLElement;
          }
          
          // Additional safety check: ensure target is not body
          if (targetElement === body || targetElement.tagName === 'BODY') {
            logger.warn('Skipping suggestion application to body element', { section: sectionKey });
            continue; // Skip this suggestion to avoid breaking the editor
          }
          
          // Add annotation marker class and data attribute
          const suggestionText = sectionSuggestions.join(' • ');
          targetElement.setAttribute('data-suggestion', suggestionText);
          targetElement.setAttribute('data-section', sectionKey);
          targetElement.classList.add('has-suggestion');
          break;
        }
      }
    });
  }, [parseSuggestions, sectionKeywords]);

  useEffect(() => {
    const tinymce = window.tinymce as TinyMCE | undefined;
    if (!tinymceLoaded || !tinymce || initializationInProgress.current) return;
    if (selectedTab !== improvedTabIndex) return;

    const init = async (): Promise<void> => {
      try {
        initializationInProgress.current = true;
        const existingEditor = tinymce.get('templateEditor');
        if (existingEditor) existingEditor.remove();
        await new Promise(resolve => setTimeout(resolve, 100));

        const suggestions = parseSuggestions();
        const hasSuggestions = Object.keys(suggestions).length > 0;

        await tinymce.init({
          selector: '#templateEditor',
          height: 500,
          menubar: true,
          plugins: ['advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount'],
          toolbar: hasSuggestions 
            ? 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | showsuggestions | help'
            : 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
          content_style: `
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; padding-left: 30px !important; }
            .mce-annotation { background-color: #FEF3C7; border-bottom: 2px solid #F59E0B; cursor: help; }
            .mce-annotation:hover { background-color: #FDE68A; }
            .has-suggestion { 
              position: relative; 
              background-color: #FFFBEB;
              border-left: 3px solid #F59E0B;
              padding-left: 8px;
              margin-left: -11px;
            }
            .has-suggestion::before {
              content: '💡';
              position: absolute;
              left: -28px;
              top: 2px;
              font-size: 16px;
              cursor: help;
              z-index: 10;
            }
            .has-suggestion::after {
              content: attr(data-suggestion);
              position: absolute;
              left: 0;
              top: 100%;
              background: #1F2937;
              color: #F9FAFB;
              padding: 12px 16px;
              border-radius: 8px;
              font-size: 13px;
              line-height: 1.5;
              max-width: 400px;
              min-width: 250px;
              white-space: pre-wrap;
              box-shadow: 0 10px 25px rgba(0,0,0,0.3);
              opacity: 0;
              visibility: hidden;
              transition: opacity 0.2s, visibility 0.2s;
              z-index: 1000;
              pointer-events: none;
            }
            .has-suggestion:hover::after {
              opacity: 1;
              visibility: visible;
            }
            .has-suggestion:hover {
              background-color: #FEF3C7;
            }
          `,
          branding: false,
          promotion: false,
          license_key: 'gpl',
          setup: (editor: TinyMCEEditor) => {
            editorRef.current = editor;
            
            // Register suggestion annotation
            editor.on('init', () => {
              // Register the annotator
              if (editor.annotator) {
                editor.annotator.register('suggestion', {
                  persistent: true,
                  decorate: (uid: string, data: { comment?: string; section?: string }) => ({
                    attributes: {
                      'data-mce-comment': data.comment || '',
                      'data-mce-section': data.section || '',
                      'title': data.comment || ''
                    },
                    classes: ['suggestion-annotation']
                  })
                });
              }
              
              setEditorReady(true);
              editor.setContent(resume['Improved Text'] || '');
              
              // Apply annotations after content is set
              setTimeout(() => {
                applyAnnotationsToSections(editor);
              }, 500);
            });

            // Add button to toggle/show suggestions
            if (hasSuggestions) {
              editor.ui.registry.addButton('showsuggestions', {
                text: '💡 Suggestions',
                tooltip: 'Afficher les suggestions d\'amélioration',
                onAction: () => {
                  const suggestionsList = Object.entries(suggestions)
                    .filter(([, items]) => items && items.length > 0)
                    .map(([section, items]) => {
                      const sectionNames: Record<string, string> = {
                        executiveSummary: 'Résumé exécutif',
                        skills: 'Compétences',
                        experiences: 'Expériences',
                        education: 'Formation',
                        hobbiesLanguages: 'Loisirs & Langues',
                        atsOptimization: 'Optimisation ATS'
                      };
                      return `<h4 style="margin: 10px 0 5px; color: #4F46E5;">${sectionNames[section] || section}</h4><ul style="margin: 0; padding-left: 20px;">${(items as string[]).map(item => `<li style="margin: 3px 0;">${item}</li>`).join('')}</ul>`;
                    })
                    .join('');
                  
                  editor.windowManager.open({
                    title: 'Suggestions d\'amélioration',
                    body: {
                      type: 'panel',
                      items: [{
                        type: 'htmlpanel',
                        html: `<div style="max-height: 400px; overflow-y: auto; padding: 10px;">${suggestionsList || '<p>Aucune suggestion disponible</p>'}</div>`
                      }]
                    },
                    buttons: [{ type: 'cancel', text: 'Fermer' }]
                  });
                }
              });
            }
          }
        });
      } catch (error) {
        logger.error('TinyMCE initialization error:', error);
        toast.error('Failed to initialize editor');
      } finally {
        initializationInProgress.current = false;
      }
    };

    init();
    return () => { const tinymceCleanup = window.tinymce as TinyMCE | undefined; if (tinymceCleanup) tinymceCleanup.get('templateEditor')?.remove(); };
  }, [tinymceLoaded, selectedTab, improvedTabIndex, resume, parseSuggestions, applyAnnotationsToSections]);

  useEffect(() => {
    const fetchTemplates = async (): Promise<void> => {
      try {
        setLoadingTemplates(true);
        const fetchedTemplates = await templateService.getAllTemplates();
        setTemplates(fetchedTemplates);
        if (fetchedTemplates.length > 0) setSelectedTemplate(fetchedTemplates[0].id);
      } catch (error) {
        logger.error('Error fetching templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  if (!resume) return null;
  if (showImprovement) return <ImprovementAnimation currentStep={currentStep} isVisible={showImprovement} />;

  return (
    <div className="w-full px-2 py-16 sm:px-0">
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {tabs.map((tab) => (
            <Tab key={tab.name} className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5', 'ring-white/60 ring-offset-2 ring-offset-gray-400 focus:outline-none focus:ring-2', selected ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-gray-300')}>
              <div className="flex items-center justify-center space-x-2"><tab.icon className="w-5 h-5" /><span>{tab.name}</span></div>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-4">
          {tabs.map((tab, idx) => (
            <Tab.Panel key={idx} className={classNames('rounded-xl bg-white dark:bg-gray-800 p-3', 'ring-white/60 ring-offset-2 ring-offset-gray-400 focus:outline-none focus:ring-2')}>
              {tab.content}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>

      {showAdaptationModal && <ResumeAdaptation resume={localResume} onClose={() => setShowAdaptationModal(false)} />}

      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        resumeName={resume['Name'] || 'CV'}
        resumeId={resume.id}
        resumeTitle={resume['Title'] || ''}
        currentVersion={currentVersion}
        onGeneratePdf={generatePdfBlob}
      />
    </div>
  );
};

export default ResumeAnalysis;
