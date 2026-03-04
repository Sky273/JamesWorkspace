/**
 * Mission Pipeline Kanban Component
 * Displays a Kanban board view of the selection pipeline for a specific mission
 * Allows drag-and-drop to change candidate stages and adding new CVs to the pipeline
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  UserIcon,
  CalendarIcon,
  StarIcon,
  ChevronRightIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  VideoCameraIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import {
  PipelineEntry,
  PipelineStage,
  Interview,
  getStages,
  getPipelineByMissionId,
  addToPipeline,
  moveToStage,
  removeFromPipeline,
  updatePipelineNotes,
  getInterviews,
  scheduleInterview,
  completeInterview,
  cancelInterview
} from '../../services/pipelineService';
import { fetchWithAuth } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';

interface Resume {
  id: string;
  Name: string;
  Title?: string;
  'Global Score'?: number;
  Tags?: string[];
}

interface MissionPipelineKanbanProps {
  missionId: string;
  missionTitle: string;
  onClose?: () => void;
}

export default function MissionPipelineKanban({ 
  missionId, 
  missionTitle,
  onClose 
}: MissionPipelineKanbanProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  // State
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedEntry, setDraggedEntry] = useState<PipelineEntry | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Add CV modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableResumes, setAvailableResumes] = useState<Resume[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [addNotes, setAddNotes] = useState('');

  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null);
  const [editNotes, setEditNotes] = useState('');

  // Interview modal state
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showInterviewsListModal, setShowInterviewsListModal] = useState(false);
  const [selectedEntryForInterview, setSelectedEntryForInterview] = useState<PipelineEntry | null>(null);
  const [entryInterviews, setEntryInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [newInterview, setNewInterview] = useState({
    title: '',
    description: '',
    interviewType: 'client' as 'client' | 'partner' | 'technical' | 'hr',
    scheduledAt: '',
    durationMinutes: 60,
    location: '',
    meetingLink: ''
  });

  // Load pipeline data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stagesData, entriesData] = await Promise.all([
        getStages(),
        getPipelineByMissionId(missionId)
      ]);
      setStages(stagesData);
      setEntries(entriesData);
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error loading data:', error);
      toast.error(t('pipeline.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [missionId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load available resumes for adding to pipeline
  const loadAvailableResumes = useCallback(async () => {
    try {
      setLoadingResumes(true);
      const response = await fetchWithAuth('/api/resumes?limit=100');
      if (response.ok) {
        const data = await response.json();
        const resumes = data.data || data || [];
        
        // Filter out resumes already in this mission's pipeline
        const existingResumeIds = new Set(entries.map(e => e.resume_id));
        const available = resumes.filter((r: Resume) => !existingResumeIds.has(r.id));
        setAvailableResumes(available);
      }
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error loading resumes:', error);
    } finally {
      setLoadingResumes(false);
    }
  }, [entries]);

  // Open add modal
  const handleOpenAddModal = () => {
    setShowAddModal(true);
    loadAvailableResumes();
  };

  // Add resume to pipeline
  const handleAddToPipeline = async () => {
    if (!selectedResumeId) {
      toast.error(t('pipeline.errors.selectResume'));
      return;
    }

    try {
      await addToPipeline({
        resumeId: selectedResumeId,
        missionId,
        notes: addNotes || undefined
      });
      toast.success(t('pipeline.addedSuccess'));
      setShowAddModal(false);
      setSelectedResumeId('');
      setAddNotes('');
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error adding to pipeline:', error);
      toast.error(t('pipeline.errors.addFailed'));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (entry: PipelineEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedEntry || draggedEntry.stage === targetStageId) {
      setDraggedEntry(null);
      return;
    }

    try {
      await moveToStage(draggedEntry.id, targetStageId);
      toast.success(t('pipeline.stageUpdated'));
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error moving stage:', error);
      toast.error(t('pipeline.errors.updateFailed'));
    } finally {
      setDraggedEntry(null);
    }
  };

  // Remove from pipeline
  const handleRemove = async (entry: PipelineEntry) => {
    if (!window.confirm(t('pipeline.confirmRemove'))) return;

    try {
      await removeFromPipeline(entry.id);
      toast.success(t('pipeline.removedSuccess'));
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error removing:', error);
      toast.error(t('pipeline.errors.removeFailed'));
    }
  };

  // Update notes
  const handleOpenNotesModal = (entry: PipelineEntry) => {
    setEditingEntry(entry);
    setEditNotes(entry.notes || '');
    setShowNotesModal(true);
  };

  const handleSaveNotes = async () => {
    if (!editingEntry) return;

    try {
      await updatePipelineNotes(editingEntry.id, editNotes);
      toast.success(t('pipeline.notesUpdated'));
      setShowNotesModal(false);
      setEditingEntry(null);
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error updating notes:', error);
      toast.error(t('pipeline.errors.updateFailed'));
    }
  };

  // Interview handlers
  const handleOpenInterviewsModal = async (entry: PipelineEntry) => {
    setSelectedEntryForInterview(entry);
    setShowInterviewsListModal(true);
    setLoadingInterviews(true);
    try {
      const interviews = await getInterviews(entry.id);
      setEntryInterviews(interviews);
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error loading interviews:', error);
      toast.error(t('pipeline.errors.loadFailed'));
    } finally {
      setLoadingInterviews(false);
    }
  };

  const handleOpenScheduleModal = () => {
    setShowInterviewModal(true);
    setNewInterview({
      title: '',
      description: '',
      interviewType: 'client',
      scheduledAt: '',
      durationMinutes: 60,
      location: '',
      meetingLink: ''
    });
  };

  const handleScheduleInterview = async () => {
    if (!selectedEntryForInterview || !newInterview.title || !newInterview.scheduledAt) {
      toast.error(t('pipeline.errors.interviewRequired'));
      return;
    }

    try {
      await scheduleInterview(selectedEntryForInterview.id, {
        title: newInterview.title,
        description: newInterview.description || undefined,
        interviewType: newInterview.interviewType,
        scheduledAt: newInterview.scheduledAt,
        durationMinutes: newInterview.durationMinutes,
        location: newInterview.location || undefined,
        meetingLink: newInterview.meetingLink || undefined
      });
      toast.success(t('pipeline.interviewScheduled'));
      setShowInterviewModal(false);
      // Reload interviews list
      const interviews = await getInterviews(selectedEntryForInterview.id);
      setEntryInterviews(interviews);
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error scheduling interview:', error);
      toast.error(t('pipeline.errors.scheduleFailed'));
    }
  };

  const handleCompleteInterview = async (interview: Interview, outcome: string) => {
    try {
      await completeInterview(interview.id, outcome);
      toast.success(t('pipeline.interviewCompleted'));
      if (selectedEntryForInterview) {
        const interviews = await getInterviews(selectedEntryForInterview.id);
        setEntryInterviews(interviews);
      }
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error completing interview:', error);
      toast.error(t('pipeline.errors.completeFailed'));
    }
  };

  const handleCancelInterview = async (interview: Interview) => {
    if (!window.confirm(t('pipeline.confirmCancelInterview'))) return;
    
    try {
      await cancelInterview(interview.id);
      toast.success(t('pipeline.interviewCancelled'));
      if (selectedEntryForInterview) {
        const interviews = await getInterviews(selectedEntryForInterview.id);
        setEntryInterviews(interviews);
      }
      loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error cancelling interview:', error);
      toast.error(t('pipeline.errors.cancelFailed'));
    }
  };

  // Get interview type label
  const getInterviewTypeLabel = (type: string) => {
    const labels: Record<string, { fr: string; en: string }> = {
      client: { fr: 'Entretien client', en: 'Client interview' },
      partner: { fr: 'Entretien partenaire', en: 'Partner interview' },
      technical: { fr: 'Entretien technique', en: 'Technical interview' },
      hr: { fr: 'Entretien RH', en: 'HR interview' }
    };
    return labels[type]?.[isEnglish ? 'en' : 'fr'] || type;
  };

  // Get interview type color
  const getInterviewTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      client: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      partner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
      technical: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      hr: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // Format datetime for display
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get entries for a specific stage
  const getEntriesForStage = (stageId: string) => {
    return entries.filter(e => e.stage === stageId);
  };

  // Filter resumes by search
  const filteredResumes = availableResumes.filter(r => 
    r.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.Title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render score stars
  const renderScore = (score?: number) => {
    if (!score) return null;
    const stars = Math.round(score / 20); // Convert 0-100 to 0-5 stars
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          i <= stars ? (
            <StarIconSolid key={i} className="w-3 h-3 text-yellow-400" />
          ) : (
            <StarIcon key={i} className="w-3 h-3 text-gray-300 dark:text-gray-600" />
          )
        ))}
      </div>
    );
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="w-6 h-6 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('pipeline.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {missionTitle} • {entries.length} {t('pipeline.candidates')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            {t('pipeline.addCandidate')}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {stages.map(stage => {
            const stageEntries = getEntriesForStage(stage.id);
            const isDropTarget = dragOverStage === stage.id;

            return (
              <div
                key={stage.id}
                className={`w-72 flex-shrink-0 rounded-lg transition-all ${
                  isDropTarget 
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'bg-gray-50 dark:bg-gray-900/50'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div 
                  className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
                  style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {isEnglish ? stage.labelEn : stage.label}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
                      {stageEntries.length}
                    </span>
                  </div>
                </div>

                {/* Stage Cards */}
                <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
                  {stageEntries.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                      {t('pipeline.noEntries')}
                    </div>
                  ) : (
                    stageEntries.map(entry => (
                      <div
                        key={entry.id}
                        draggable
                        onDragStart={() => handleDragStart(entry)}
                        className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                          draggedEntry?.id === entry.id ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Candidate Name */}
                        <div className="flex items-start justify-between mb-2">
                          <Link
                            to={`/resumes/${entry.resume_id}/analysis`}
                            className="font-medium text-gray-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                          >
                            <UserIcon className="w-4 h-4" />
                            {entry.resume_name || t('pipeline.unknownCandidate')}
                          </Link>
                          {renderScore(entry.global_score)}
                        </div>

                        {/* Tags */}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {entry.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{entry.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Notes preview */}
                        {entry.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                            {entry.notes}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <CalendarIcon className="w-3 h-3" />
                            {formatDate(entry.moved_at || entry.created_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenInterviewsModal(entry)}
                              className="p-1 text-gray-400 hover:text-purple-500 rounded"
                              title={t('pipeline.manageInterviews')}
                            >
                              <VideoCameraIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenNotesModal(entry)}
                              className="p-1 text-gray-400 hover:text-blue-500 rounded"
                              title={t('pipeline.editNotes')}
                            >
                              <ChatBubbleLeftIcon className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/resumes/${entry.resume_id}/analysis`}
                              className="p-1 text-gray-400 hover:text-blue-500 rounded"
                              title={t('pipeline.viewResume')}
                            >
                              <EyeIcon className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleRemove(entry)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                              title={t('pipeline.remove')}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Interview indicator - clickable */}
                        <button
                          onClick={() => handleOpenInterviewsModal(entry)}
                          className="mt-2 w-full flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        >
                          <VideoCameraIcon className="w-3 h-3" />
                          {entry.interview_count && entry.interview_count > 0 ? (
                            <>
                              {entry.interview_count} {t('pipeline.interviews')}
                              {entry.next_interview && (
                                <span className="text-gray-400">
                                  • {formatDate(entry.next_interview)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span>{t('pipeline.scheduleInterview')}</span>
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add CV Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('pipeline.addCandidate')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pipeline.searchResumes')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Resume List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingResumes ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : filteredResumes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('pipeline.noResumesAvailable')}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredResumes.map(resume => (
                    <button
                      key={resume.id}
                      onClick={() => setSelectedResumeId(resume.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedResumeId === resume.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {resume.Name}
                          </div>
                          {resume.Title && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {resume.Title}
                            </div>
                          )}
                        </div>
                        {renderScore(resume['Global Score'])}
                      </div>
                      {resume.Tags && resume.Tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {resume.Tags.slice(0, 5).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('pipeline.notes')} ({t('common.optional')})
              </label>
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder={t('pipeline.notesPlaceholder')}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddToPipeline}
                disabled={!selectedResumeId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('pipeline.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('pipeline.editNotes')}
              </h3>
              <button
                onClick={() => setShowNotesModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {editingEntry.resume_name}
              </p>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder={t('pipeline.notesPlaceholder')}
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interviews List Modal */}
      {showInterviewsListModal && selectedEntryForInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('pipeline.manageInterviews')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedEntryForInterview.resume_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInterviewsListModal(false);
                  setSelectedEntryForInterview(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Interviews List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingInterviews ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : entryInterviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('pipeline.noInterviews')}
                </div>
              ) : (
                <div className="space-y-3">
                  {entryInterviews.map(interview => (
                    <div
                      key={interview.id}
                      className={`p-4 rounded-lg border ${
                        interview.status === 'completed'
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : interview.status === 'cancelled'
                          ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-60'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {interview.title}
                          </h4>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${getInterviewTypeColor(interview.interview_type)}`}>
                            {getInterviewTypeLabel(interview.interview_type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {interview.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => handleCompleteInterview(interview, 'positive')}
                                className="p-1 text-green-500 hover:text-green-700 rounded"
                                title={t('pipeline.outcomes.positive')}
                              >
                                <CheckCircleIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleCancelInterview(interview)}
                                className="p-1 text-red-500 hover:text-red-700 rounded"
                                title={t('pipeline.cancelInterview')}
                              >
                                <XCircleIcon className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {interview.status === 'completed' && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ {t('pipeline.outcomes.' + (interview.outcome || 'positive'))}
                            </span>
                          )}
                          {interview.status === 'cancelled' && (
                            <span className="text-xs text-gray-500">
                              {isEnglish ? 'Cancelled' : 'Annulé'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          {formatDateTime(interview.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {interview.duration_minutes} min
                        </span>
                        {interview.location && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />
                            {interview.location}
                          </span>
                        )}
                        {interview.meeting_link && (
                          <a
                            href={interview.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <VideoCameraIcon className="w-4 h-4" />
                            {t('pipeline.joinMeeting')}
                          </a>
                        )}
                      </div>

                      {interview.description && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          {interview.description}
                        </p>
                      )}

                      {interview.outcome_notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">
                          {interview.outcome_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - Add Interview Button */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => {
                  setShowInterviewsListModal(false);
                  setSelectedEntryForInterview(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                onClick={handleOpenScheduleModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                {t('pipeline.scheduleInterview')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showInterviewModal && selectedEntryForInterview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('pipeline.scheduleInterviewTitle')}
              </h3>
              <button
                onClick={() => setShowInterviewModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.interviewTitle')} *
                </label>
                <input
                  type="text"
                  value={newInterview.title}
                  onChange={(e) => setNewInterview({ ...newInterview, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  placeholder={t('pipeline.interviewTitlePlaceholder')}
                />
              </div>

              {/* Interview Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.interviewType')}
                </label>
                <select
                  value={newInterview.interviewType}
                  onChange={(e) => setNewInterview({ ...newInterview, interviewType: e.target.value as 'client' | 'partner' | 'technical' | 'hr' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="client">{t('pipeline.types.client')}</option>
                  <option value="partner">{t('pipeline.types.partner')}</option>
                  <option value="technical">{t('pipeline.types.technical')}</option>
                  <option value="hr">{t('pipeline.types.hr')}</option>
                </select>
                {newInterview.interviewType === 'client' && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {isEnglish 
                      ? '→ This will move the candidate to "Interview Scheduled" stage'
                      : '→ Cela déplacera le candidat à l\'étape "Entretien planifié"'}
                  </p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('pipeline.scheduledAt')} *
                  </label>
                  <input
                    type="datetime-local"
                    value={newInterview.scheduledAt}
                    onChange={(e) => setNewInterview({ ...newInterview, scheduledAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('pipeline.duration')}
                  </label>
                  <select
                    value={newInterview.durationMinutes}
                    onChange={(e) => setNewInterview({ ...newInterview, durationMinutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1h</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2h</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.location')}
                </label>
                <input
                  type="text"
                  value={newInterview.location}
                  onChange={(e) => setNewInterview({ ...newInterview, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  placeholder={t('pipeline.locationPlaceholder')}
                />
              </div>

              {/* Meeting Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.meetingLink')}
                </label>
                <input
                  type="url"
                  value={newInterview.meetingLink}
                  onChange={(e) => setNewInterview({ ...newInterview, meetingLink: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  placeholder="https://meet.google.com/..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.interviewDescription')}
                </label>
                <textarea
                  value={newInterview.description}
                  onChange={(e) => setNewInterview({ ...newInterview, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  placeholder={t('pipeline.interviewDescriptionPlaceholder')}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowInterviewModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleScheduleInterview}
                disabled={!newInterview.title || !newInterview.scheduledAt}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('pipeline.schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
