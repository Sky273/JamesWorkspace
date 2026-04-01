/**
 * Mission Pipeline Kanban Component
 * Displays a Kanban board view of the selection pipeline for a specific mission
 * Allows drag-and-drop to change candidate stages and adding new CVs to the pipeline
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { KanbanBoard, KanbanHeader, LoadingState } from './MissionPipelineKanban.parts';
import type { MissionPipelineKanbanProps, Resume } from './MissionPipelineKanban.types';
import PipelineNotesModal from './PipelineNotesModal';
import { PipelineInterviewsListModal, PipelineScheduleInterviewModal } from './PipelineInterviewModals';

export default function MissionPipelineKanban({
  missionId,
  missionTitle,
  onClose
}: MissionPipelineKanbanProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedEntry, setDraggedEntry] = useState<PipelineEntry | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [availableResumes, setAvailableResumes] = useState<Resume[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [addNotes, setAddNotes] = useState('');

  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null);
  const [editNotes, setEditNotes] = useState('');

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stagesData, entriesData] = await Promise.all([getStages(), getPipelineByMissionId(missionId)]);
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

  const loadAvailableResumes = useCallback(async () => {
    try {
      setLoadingResumes(true);
      const response = await fetchWithAuth('/api/resumes?limit=100');

      if (response.ok) {
        const data = await response.json();
        const resumes = data.data || data || [];
        const existingResumeIds = new Set(entries.map((entry) => entry.resume_id));
        const available = resumes.filter((resume: Resume) => !existingResumeIds.has(resume.id));
        setAvailableResumes(available);
      }
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error loading resumes:', error);
    } finally {
      setLoadingResumes(false);
    }
  }, [entries]);

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    void loadAvailableResumes();
  };

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
      await loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error adding to pipeline:', error);
      toast.error(t('pipeline.errors.addFailed'));
    }
  };

  const handleDragStart = (entry: PipelineEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragOver = (event: React.DragEvent, stageId: string) => {
    event.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (event: React.DragEvent, targetStageId: string) => {
    event.preventDefault();
    setDragOverStage(null);

    if (!draggedEntry || draggedEntry.stage === targetStageId) {
      setDraggedEntry(null);
      return;
    }

    try {
      await moveToStage(draggedEntry.id, targetStageId);
      toast.success(t('pipeline.stageUpdated'));
      await loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error moving stage:', error);
      toast.error(t('pipeline.errors.updateFailed'));
    } finally {
      setDraggedEntry(null);
    }
  };

  const handleRemove = async (entry: PipelineEntry) => {
    if (!window.confirm(t('pipeline.confirmRemove'))) {
      return;
    }

    try {
      await removeFromPipeline(entry.id);
      toast.success(t('pipeline.removedSuccess'));
      await loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error removing:', error);
      toast.error(t('pipeline.errors.removeFailed'));
    }
  };

  const handleOpenNotesModal = (entry: PipelineEntry) => {
    setEditingEntry(entry);
    setEditNotes(entry.notes || '');
    setShowNotesModal(true);
  };

  const handleSaveNotes = async () => {
    if (!editingEntry) {
      return;
    }

    try {
      await updatePipelineNotes(editingEntry.id, editNotes);
      toast.success(t('pipeline.notesUpdated'));
      setShowNotesModal(false);
      setEditingEntry(null);
      await loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error updating notes:', error);
      toast.error(t('pipeline.errors.updateFailed'));
    }
  };

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
      const interviews = await getInterviews(selectedEntryForInterview.id);
      setEntryInterviews(interviews);
      await loadData();
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

      await loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error completing interview:', error);
      toast.error(t('pipeline.errors.completeFailed'));
    }
  };

  const handleCancelInterview = async (interview: Interview) => {
    if (!window.confirm(t('pipeline.confirmCancelInterview'))) {
      return;
    }

    try {
      await cancelInterview(interview.id);
      toast.success(t('pipeline.interviewCancelled'));

      if (selectedEntryForInterview) {
        const interviews = await getInterviews(selectedEntryForInterview.id);
        setEntryInterviews(interviews);
      }

      await loadData();
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error cancelling interview:', error);
      toast.error(t('pipeline.errors.cancelFailed'));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  if (loading) {
    return <LoadingState loading={loading} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <KanbanHeader
        addCandidateLabel={t('pipeline.addCandidate')}
        candidateCount={entries.length}
        candidatesLabel={t('pipeline.candidates')}
        missionTitle={missionTitle}
        onAddCandidate={handleOpenAddModal}
        onClose={onClose}
        title={t('pipeline.title')}
      />

      <KanbanBoard
        draggedEntry={draggedEntry}
        dragOverStage={dragOverStage}
        entries={entries}
        formatDate={formatDate}
        isEnglish={isEnglish}
        noEntriesLabel={t('pipeline.noEntries')}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        onEditNotes={handleOpenNotesModal}
        onManageInterviews={handleOpenInterviewsModal}
        onRemove={handleRemove}
        stages={stages}
        texts={{
          interviews: t('pipeline.interviews'),
          manageInterviews: t('pipeline.manageInterviews'),
          remove: t('pipeline.remove'),
          scheduleInterview: t('pipeline.scheduleInterview'),
          unknownCandidate: t('pipeline.unknownCandidate'),
          viewResume: t('pipeline.viewResume'),
          editNotes: t('pipeline.editNotes')
        }}
      />

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

      {showNotesModal && editingEntry && (
        <PipelineNotesModal
          entry={editingEntry}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          onSave={handleSaveNotes}
          onClose={() => setShowNotesModal(false)}
        />
      )}

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
