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
import resumeAdaptationService from '../../utils/resumeAdaptationService';
import logger from '../../utils/logger.frontend';
import PipelineAddCandidateModal from './PipelineAddCandidateModal';
import { KanbanBoard, KanbanHeader, LoadingState } from './MissionPipelineKanban.parts';
import type { AdaptationOption, CandidateOption, InterviewFormValues, MissionPipelineKanbanProps, Resume } from './MissionPipelineKanban.types';
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
  const [availableCandidates, setAvailableCandidates] = useState<CandidateOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [addNotes, setAddNotes] = useState('');

  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showInterviewsListModal, setShowInterviewsListModal] = useState(false);
  const [selectedEntryForInterview, setSelectedEntryForInterview] = useState<PipelineEntry | null>(null);
  const [entryInterviews, setEntryInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [newInterview, setNewInterview] = useState<InterviewFormValues>({
    title: '',
    description: '',
    interviewType: 'client',
    scheduledAt: '',
    durationMinutes: 60,
    location: '',
    meetingLink: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stagesData, entriesData, adaptations] = await Promise.all([
        getStages(),
        getPipelineByMissionId(missionId),
        resumeAdaptationService.getAdaptationsByMission(missionId),
      ]);
      const missionAdaptedResumeIds = new Set(
        adaptations
          .map((adaptation) => {
            const rawAdaptation = adaptation as typeof adaptation & Record<string, unknown>;
            return String(rawAdaptation['Resume ID'] || adaptation.resumeId || '');
          })
          .filter(Boolean)
      );

      setStages(stagesData);
      setEntries(
        entriesData.map((entry) => ({
          ...entry,
          has_mission_adaptation: missionAdaptedResumeIds.has(String(entry.resume_id)),
        }))
      );
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

  const loadAvailableCandidates = useCallback(async () => {
    try {
      setLoadingResumes(true);
      const [response, adaptations] = await Promise.all([
        fetchWithAuth('/api/resumes?limit=100'),
        resumeAdaptationService.getAdaptationsByMission(missionId),
      ]);

      const existingResumeIds = new Set(entries.map((entry) => String(entry.resume_id)));
      const existingAdaptationIds = new Set(
        entries
          .map((entry) => entry.adaptation_id)
          .filter((adaptationId): adaptationId is string => Boolean(adaptationId))
      );
      const candidates: CandidateOption[] = [];
      const resumeNameById = new Map<string, string>();

      if (response.ok) {
        const data = await response.json();
        const resumes = data.data || data || [];
        for (const resume of resumes as Resume[]) {
          resumeNameById.set(String(resume.id), resume.Name);
        }
        const availableResumes = resumes.filter((resume: Resume) => !existingResumeIds.has(String(resume.id)));
        candidates.push(
          ...availableResumes.map((resume: Resume) => {
            const resumeId = String(resume.id);

            return {
            id: `resume:${resumeId}`,
            resumeId,
            name: resume.Name,
            title: resume.Title,
            score: resume['Global Score'],
            tags: resume.Tags,
            source: 'resume' as const,
            };
          })
        );
      }

      const missionAdaptations = adaptations
        .map((adaptation) => {
          const rawAdaptation = adaptation as typeof adaptation & Record<string, unknown>;
          return {
          id: adaptation.id,
          resumeId: String(rawAdaptation['Resume ID'] || adaptation.resumeId || ''),
          missionId: String(rawAdaptation['Mission ID'] || adaptation.missionId || ''),
          resumeName: String(rawAdaptation['Resume Name'] || ''),
          candidateName: rawAdaptation['Candidate Name'] as string | undefined,
          adaptedTitle: rawAdaptation['Adapted Title'] as string | undefined,
          matchScore: rawAdaptation['Match Score'] != null ? Number(rawAdaptation['Match Score']) : undefined,
          status: (rawAdaptation.Status as string | undefined) || adaptation.status,
        } satisfies AdaptationOption & { missionId: string };
        })
        .filter((adaptation) =>
          adaptation.resumeId &&
          adaptation.missionId === missionId
        );

      const availableAdaptations = missionAdaptations.filter(
        (adaptation) => !existingAdaptationIds.has(adaptation.id)
      );

      const adaptedResumeIds = new Set(missionAdaptations.map((adaptation) => adaptation.resumeId));

      candidates.push(
        ...availableAdaptations.map((adaptation) => ({
          id: `adaptation:${adaptation.id}`,
          resumeId: adaptation.resumeId,
          name: resumeNameById.get(adaptation.resumeId) || adaptation.resumeName || t('pipeline.unknownCandidate'),
          title: adaptation.adaptedTitle,
          score: adaptation.matchScore,
          source: 'adaptation' as const,
          hasMissionAdaptation: true,
          adaptationId: adaptation.id,
          adaptationStatus: adaptation.status,
        }))
      );

      for (const candidate of candidates) {
        if (candidate.source === 'resume' && adaptedResumeIds.has(candidate.resumeId)) {
          candidate.hasMissionAdaptation = true;
        }
      }

      candidates.sort((left, right) => {
        if (left.source !== right.source) {
          return left.source === 'adaptation' ? -1 : 1;
        }

        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      });

      setAvailableCandidates(candidates);
    } catch (error) {
      logger.error('[MissionPipelineKanban] Error loading candidates:', error);
    } finally {
      setLoadingResumes(false);
    }
  }, [entries, missionId, t]);

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    void loadAvailableCandidates();
  };

  const handleAddToPipeline = async () => {
    if (!selectedCandidateId) {
      toast.error(t('pipeline.errors.selectCandidate'));
      return;
    }

    const selectedCandidate = availableCandidates.find((candidate) => candidate.id === selectedCandidateId);
    if (!selectedCandidate) {
      toast.error(t('pipeline.errors.selectCandidate'));
      return;
    }

    try {
      await addToPipeline({
        resumeId: selectedCandidate.resumeId,
        adaptationId: selectedCandidate.source === 'adaptation' ? selectedCandidate.adaptationId : undefined,
        missionId,
        notes: selectedCandidate.source === 'adaptation'
          ? [addNotes.trim(), t('pipeline.selectedAdaptationNote', { adaptation: selectedCandidate.title || selectedCandidate.name })]
            .filter(Boolean)
            .join('\n\n')
          : (addNotes || undefined)
      });
      toast.success(t('pipeline.addedSuccess'));
      setShowAddModal(false);
      setSelectedCandidateId('');
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
    <div className="cv-panel overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
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
          editNotes: t('pipeline.editNotes'),
          dragAndDrop: t('pipeline.dragAndDrop', 'Glisser-déposer'),
          stage: t('pipeline.stage', 'Étape'),
          emptyNotes: t('pipeline.emptyNotes', 'Aucune note pour le moment.')
        }}
      />

      {showAddModal && (
        <PipelineAddCandidateModal
          availableCandidates={availableCandidates}
          loadingResumes={loadingResumes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCandidateId={selectedCandidateId}
          setSelectedCandidateId={setSelectedCandidateId}
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
