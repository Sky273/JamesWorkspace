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
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  VideoCameraIcon
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
import PipelineAddCandidateModal from './PipelineAddCandidateModal';
import PipelineNotesModal from './PipelineNotesModal';
import { PipelineInterviewsListModal, PipelineScheduleInterviewModal } from './PipelineInterviewModals';

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

  // Get entries for a specific stage
  const getEntriesForStage = (stageId: string) => {
    return entries.filter(e => e.stage === stageId);
  };

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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
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
                            className="font-medium text-gray-900 dark:text-gray-100 text-sm hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
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
        <PipelineAddCandidateModal
          availableResumes={availableResumes}
          loadingResumes={loadingResumes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedResumeId={selectedResumeId}
          setSelectedResumeId={setSelectedResumeId}
          addNotes={addNotes}
          setAddNotes={setAddNotes}
          onAdd={handleAddToPipeline}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Notes Modal */}
      {showNotesModal && editingEntry && (
        <PipelineNotesModal
          entry={editingEntry}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          onSave={handleSaveNotes}
          onClose={() => setShowNotesModal(false)}
        />
      )}

      {/* Interviews List Modal */}
      {showInterviewsListModal && selectedEntryForInterview && (
        <PipelineInterviewsListModal
          entry={selectedEntryForInterview}
          interviews={entryInterviews}
          loadingInterviews={loadingInterviews}
          isEnglish={isEnglish}
          onComplete={handleCompleteInterview}
          onCancel={handleCancelInterview}
          onSchedule={handleOpenScheduleModal}
          onClose={() => {
            setShowInterviewsListModal(false);
            setSelectedEntryForInterview(null);
          }}
        />
      )}

      {/* Schedule Interview Modal */}
      {showInterviewModal && selectedEntryForInterview && (
        <PipelineScheduleInterviewModal
          isEnglish={isEnglish}
          newInterview={newInterview}
          setNewInterview={setNewInterview}
          onSchedule={handleScheduleInterview}
          onClose={() => setShowInterviewModal(false)}
        />
      )}
    </div>
  );
}
