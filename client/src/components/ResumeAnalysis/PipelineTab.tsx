/**
 * Pipeline Tab Component for Resume Analysis
 * Displays candidate selection pipeline entries and interviews for a resume
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import {
  getStages,
  getPipelineByResumeId,
  addToPipeline,
  moveToStage,
  removeFromPipeline,
  getPipelineHistory,
  getInterviews,
  scheduleInterview,
  completeInterview,
  cancelInterview,
  updatePipelineNotes
} from '../../services/pipelineService';
import { fetchWithAuth } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import PipelineAddModal from './PipelineAddModal';
import PipelineScheduleModal from './PipelineScheduleModal';
import PipelineCompleteModal from './PipelineCompleteModal';
import PipelineHistoryModal from './PipelineHistoryModal';
import PipelineTabHeader from './pipelineTab/PipelineTabHeader';
import PipelineCard from './pipelineTab/PipelineCard';
import { formatPipelineDate, formatRelativePipelineTime } from './pipelineTab/helpers';
import type {
  Client,
  Interview,
  InterviewOutcomeState,
  Mission,
  NewInterviewState,
  NewPipelineState,
  PipelineEntry,
  PipelineHistory,
  PipelineStage,
  PipelineTabTranslateFn,
} from './pipelineTab/types';

interface PipelineTabProps {
  resumeId: string;
  resumeName: string;
}

export default function PipelineTab({ resumeId, resumeName: _resumeName }: PipelineTabProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const locale = isEnglish ? 'en-US' : 'fr-FR';
  const tr = useCallback<PipelineTabTranslateFn>((key: string, options?: unknown) => String(t(key, options as never)), [t]);

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelines, setPipelines] = useState<PipelineEntry[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineEntry | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [history, setHistory] = useState<PipelineHistory[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  const [newPipeline, setNewPipeline] = useState<NewPipelineState>({ missionId: '', clientId: '', notes: '' });
  const [newInterview, setNewInterview] = useState<NewInterviewState>({
    title: '',
    description: '',
    interviewType: 'client',
    scheduledAt: '',
    durationMinutes: 60,
    location: '',
    meetingLink: '',
    attendees: []
  });
  const [interviewOutcome, setInterviewOutcome] = useState<InterviewOutcomeState>({ outcome: '', outcomeNotes: '' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stagesData, pipelinesData, missionsRes, clientsRes] = await Promise.all([
        getStages(),
        getPipelineByResumeId(resumeId),
        fetchWithAuth('/api/missions?limit=100'),
        fetchWithAuth('/api/clients?limit=100')
      ]);
      setStages(stagesData);
      setPipelines(pipelinesData);

      if (missionsRes.ok) {
        const missionsData = await missionsRes.json();
        setMissions((missionsData.data || missionsData || []).map((m: { id: string; Title?: string; title?: string; 'Client Name'?: string; client_name?: string }) => ({
          id: m.id,
          title: m.Title || m.title || '',
          client: m['Client Name'] || m.client_name || ''
        })));
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        const clientsList = clientsData.data || clientsData || [];
        setClients(clientsList.map((c: { id: string; name: string; type?: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type
        })));
      }
    } catch (error) {
      logger.error('[PipelineTab] Error loading data:', error);
      toast.error(t('pipeline.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [resumeId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedPipeline) {
      void getInterviews(selectedPipeline.id)
        .then(setInterviews)
        .catch(err => logger.error('[PipelineTab] Error loading interviews:', err));
    }
  }, [selectedPipeline]);

  const handleAddToPipeline = useCallback(async () => {
    try {
      await addToPipeline({
        resumeId,
        missionId: newPipeline.missionId || undefined,
        clientId: newPipeline.clientId || undefined,
        notes: newPipeline.notes || undefined
      });
      toast.success(t('pipeline.addedSuccess'));
      setShowAddModal(false);
      setNewPipeline({ missionId: '', clientId: '', notes: '' });
      void loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error adding to pipeline:', error);
      toast.error(t('pipeline.errors.addFailed'));
    }
  }, [loadData, newPipeline, resumeId, t]);

  const handleStageChange = useCallback(async (pipelineId: string, newStage: string) => {
    try {
      await moveToStage(pipelineId, newStage);
      toast.success(t('pipeline.stageUpdated'));
      void loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error changing stage:', error);
      toast.error(t('pipeline.errors.updateFailed'));
    }
  }, [loadData, t]);

  const handleRemove = useCallback(async (pipelineId: string) => {
    if (!window.confirm(t('pipeline.confirmRemove'))) return;
    try {
      await removeFromPipeline(pipelineId);
      toast.success(t('pipeline.removedSuccess'));
      setSelectedPipeline(null);
      void loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error removing from pipeline:', error);
      toast.error(t('pipeline.errors.removeFailed'));
    }
  }, [loadData, t]);

  const handleScheduleInterview = useCallback(async () => {
    if (!selectedPipeline || !newInterview.title || !newInterview.scheduledAt) {
      toast.error(t('pipeline.errors.interviewRequired'));
      return;
    }

    try {
      await scheduleInterview(selectedPipeline.id, {
        title: newInterview.title,
        description: newInterview.description || undefined,
        interviewType: newInterview.interviewType,
        scheduledAt: newInterview.scheduledAt,
        durationMinutes: newInterview.durationMinutes,
        location: newInterview.location || undefined,
        meetingLink: newInterview.meetingLink || undefined,
        attendees: newInterview.attendees.filter(a => a.name && a.email)
      });
      toast.success(t('pipeline.interviewScheduled'));
      setShowInterviewModal(false);
      setNewInterview({
        title: '',
        description: '',
        interviewType: 'client',
        scheduledAt: '',
        durationMinutes: 60,
        location: '',
        meetingLink: '',
        attendees: []
      });
      const updatedInterviews = await getInterviews(selectedPipeline.id);
      setInterviews(updatedInterviews);
      void loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error scheduling interview:', error);
      toast.error(t('pipeline.errors.scheduleFailed'));
    }
  }, [loadData, newInterview, selectedPipeline, t]);

  const handleCompleteInterview = useCallback(async () => {
    if (!selectedInterview || !interviewOutcome.outcome) {
      toast.error(t('pipeline.errors.outcomeRequired'));
      return;
    }

    try {
      await completeInterview(selectedInterview.id, interviewOutcome.outcome, interviewOutcome.outcomeNotes);
      toast.success(t('pipeline.interviewCompleted'));
      setShowCompleteModal(false);
      setSelectedInterview(null);
      setInterviewOutcome({ outcome: '', outcomeNotes: '' });
      if (selectedPipeline) {
        const updatedInterviews = await getInterviews(selectedPipeline.id);
        setInterviews(updatedInterviews);
      }
      void loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error completing interview:', error);
      toast.error(t('pipeline.errors.completeFailed'));
    }
  }, [interviewOutcome, loadData, selectedInterview, selectedPipeline, t]);

  const handleCancelInterview = useCallback(async (interviewId: string) => {
    if (!window.confirm(t('pipeline.confirmCancelInterview'))) return;
    try {
      await cancelInterview(interviewId);
      toast.success(t('pipeline.interviewCancelled'));
      if (selectedPipeline) {
        const updatedInterviews = await getInterviews(selectedPipeline.id);
        setInterviews(updatedInterviews);
      }
    } catch (error) {
      logger.error('[PipelineTab] Error cancelling interview:', error);
      toast.error(t('pipeline.errors.cancelFailed'));
    }
  }, [selectedPipeline, t]);

  const handleViewHistory = useCallback(async (pipeline: PipelineEntry) => {
    try {
      const historyData = await getPipelineHistory(pipeline.id);
      setHistory(historyData);
      setShowHistoryModal(true);
    } catch (error) {
      logger.error('[PipelineTab] Error loading history:', error);
      toast.error(t('pipeline.errors.historyFailed'));
    }
  }, [t]);

  const handlePipelineNotesChange = useCallback((pipelineId: string, notes: string) => {
    setPipelines(prev => prev.map(p => (p.id === pipelineId ? { ...p, notes } : p)));
  }, []);

  const handlePipelineNotesBlur = useCallback((pipelineId: string, notes: string) => {
    void updatePipelineNotes(pipelineId, notes);
  }, []);

  const formatDate = useCallback((value: string) => formatPipelineDate(value, locale), [locale]);
  const formatRelativeTime = useCallback((value: string) => formatRelativePipelineTime(value, locale, isEnglish), [isEnglish, locale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PipelineTabHeader hasEntries={pipelines.length > 0} onAdd={() => setShowAddModal(true)} t={tr} />

      {pipelines.length > 0 && (
        <div className="grid gap-4">
          {pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              stages={stages}
              interviews={selectedPipeline?.id === pipeline.id ? interviews : []}
              isSelected={selectedPipeline?.id === pipeline.id}
              isEnglish={isEnglish}
              formatDate={formatDate}
              formatRelativeTime={formatRelativeTime}
              onSelect={() => setSelectedPipeline(selectedPipeline?.id === pipeline.id ? null : pipeline)}
              onChangeStage={handleStageChange}
              onNotesChange={handlePipelineNotesChange}
              onNotesBlur={handlePipelineNotesBlur}
              onScheduleInterview={() => setShowInterviewModal(true)}
              onOpenCompleteInterview={(interview) => {
                setSelectedInterview(interview);
                setShowCompleteModal(true);
              }}
              onCancelInterview={handleCancelInterview}
              onViewHistory={handleViewHistory}
              onRemove={handleRemove}
              t={tr}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <PipelineAddModal
          missions={missions}
          clients={clients}
          newPipeline={newPipeline}
          setNewPipeline={setNewPipeline}
          onAdd={handleAddToPipeline}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showInterviewModal && (
        <PipelineScheduleModal
          newInterview={newInterview}
          setNewInterview={setNewInterview}
          onSchedule={handleScheduleInterview}
          onClose={() => setShowInterviewModal(false)}
        />
      )}

      {showCompleteModal && selectedInterview && (
        <PipelineCompleteModal
          interviewOutcome={interviewOutcome}
          setInterviewOutcome={setInterviewOutcome}
          onComplete={handleCompleteInterview}
          onClose={() => {
            setShowCompleteModal(false);
            setSelectedInterview(null);
          }}
        />
      )}

      {showHistoryModal && (
        <PipelineHistoryModal
          history={history}
          stages={stages}
          isEnglish={isEnglish}
          formatDate={formatDate}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
