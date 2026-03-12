/**
 * Pipeline Tab Component for Resume Analysis
 * Displays candidate selection pipeline entries and interviews for a resume
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  LinkIcon,
  UserGroupIcon,
  ChevronRightIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import {
  PipelineEntry,
  PipelineStage,
  Interview,
  PipelineHistory,
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

interface Mission {
  id: string;
  title: string;
  client: string;
}

interface Client {
  id: string;
  name: string;
  type?: string;
}

interface PipelineTabProps {
  resumeId: string;
  resumeName: string;
}

export default function PipelineTab({ resumeId, resumeName }: PipelineTabProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  // State
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [pipelines, setPipelines] = useState<PipelineEntry[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineEntry | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [history, setHistory] = useState<PipelineHistory[]>([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  // Form states
  const [newPipeline, setNewPipeline] = useState({
    missionId: '',
    clientId: '',
    notes: ''
  });
  const [newInterview, setNewInterview] = useState({
    title: '',
    description: '',
    interviewType: 'client',
    scheduledAt: '',
    durationMinutes: 60,
    location: '',
    meetingLink: '',
    attendees: [] as { name: string; email: string }[]
  });
  const [interviewOutcome, setInterviewOutcome] = useState({
    outcome: '',
    outcomeNotes: ''
  });

  // Load data
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
      
      // Parse missions
      if (missionsRes.ok) {
        const missionsData = await missionsRes.json();
        setMissions((missionsData.data || missionsData || []).map((m: { id: string; Title?: string; title?: string; 'Client Name'?: string; client_name?: string }) => ({
          id: m.id,
          title: m.Title || m.title || '',
          client: m['Client Name'] || m.client_name || ''
        })));
      }
      
      // Parse clients (prospects/clients)
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
    loadData();
  }, [loadData]);

  // Load interviews when pipeline is selected
  useEffect(() => {
    if (selectedPipeline) {
      getInterviews(selectedPipeline.id)
        .then(setInterviews)
        .catch(err => logger.error('[PipelineTab] Error loading interviews:', err));
    }
  }, [selectedPipeline]);

  // Get stage info
  const getStageInfo = (stageId: string) => {
    return stages.find(s => s.id === stageId) || { label: stageId, labelEn: stageId, color: '#6B7280' };
  };

  // Handle add to pipeline
  const handleAddToPipeline = async () => {
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
      loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error adding to pipeline:', error);
      toast.error(t('pipeline.errors.addFailed'));
    }
  };

  // Handle stage change
  const handleStageChange = async (pipelineId: string, newStage: string) => {
    try {
      await moveToStage(pipelineId, newStage);
      toast.success(t('pipeline.stageUpdated'));
      loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error changing stage:', error);
      toast.error(t('pipeline.errors.updateFailed'));
    }
  };

  // Handle remove from pipeline
  const handleRemove = async (pipelineId: string) => {
    if (!window.confirm(t('pipeline.confirmRemove'))) return;
    
    try {
      await removeFromPipeline(pipelineId);
      toast.success(t('pipeline.removedSuccess'));
      setSelectedPipeline(null);
      loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error removing from pipeline:', error);
      toast.error(t('pipeline.errors.removeFailed'));
    }
  };

  // Handle schedule interview
  const handleScheduleInterview = async () => {
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
      // Reload interviews
      const updatedInterviews = await getInterviews(selectedPipeline.id);
      setInterviews(updatedInterviews);
      loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error scheduling interview:', error);
      toast.error(t('pipeline.errors.scheduleFailed'));
    }
  };

  // Handle complete interview
  const handleCompleteInterview = async () => {
    if (!selectedInterview || !interviewOutcome.outcome) {
      toast.error(t('pipeline.errors.outcomeRequired'));
      return;
    }

    try {
      await completeInterview(
        selectedInterview.id,
        interviewOutcome.outcome,
        interviewOutcome.outcomeNotes
      );
      toast.success(t('pipeline.interviewCompleted'));
      setShowCompleteModal(false);
      setSelectedInterview(null);
      setInterviewOutcome({ outcome: '', outcomeNotes: '' });
      // Reload
      if (selectedPipeline) {
        const updatedInterviews = await getInterviews(selectedPipeline.id);
        setInterviews(updatedInterviews);
      }
      loadData();
    } catch (error) {
      logger.error('[PipelineTab] Error completing interview:', error);
      toast.error(t('pipeline.errors.completeFailed'));
    }
  };

  // Handle cancel interview
  const handleCancelInterview = async (interviewId: string) => {
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
  };

  // Handle view history
  const handleViewHistory = async (pipeline: PipelineEntry) => {
    try {
      const historyData = await getPipelineHistory(pipeline.id);
      setHistory(historyData);
      setShowHistoryModal(true);
    } catch (error) {
      logger.error('[PipelineTab] Error loading history:', error);
      toast.error(t('pipeline.errors.historyFailed'));
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return isEnglish ? 'Today' : "Aujourd'hui";
    if (diffDays === 1) return isEnglish ? 'Tomorrow' : 'Demain';
    if (diffDays > 0 && diffDays <= 7) return isEnglish ? `In ${diffDays} days` : `Dans ${diffDays} jours`;
    return formatDate(dateStr);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('pipeline.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('pipeline.description')}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          {t('pipeline.addToProcess')}
        </button>
      </div>

      {/* Pipeline entries */}
      {pipelines.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <UserGroupIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {t('pipeline.noEntries')}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('pipeline.addFirst')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {pipelines.map((pipeline) => {
            const stageInfo = getStageInfo(pipeline.stage);
            const isSelected = selectedPipeline?.id === pipeline.id;

            return (
              <div
                key={pipeline.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                {/* Card header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedPipeline(isSelected ? null : pipeline)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Stage badge */}
                      <span
                        className="px-3 py-1 rounded-full text-sm font-medium text-white"
                        style={{ backgroundColor: stageInfo.color }}
                      >
                        {isEnglish ? stageInfo.labelEn : stageInfo.label}
                      </span>
                      
                      {/* Mission/Client info */}
                      <div>
                        {pipeline.mission_title && (
                          <span className="text-gray-900 dark:text-white font-medium">
                            {pipeline.mission_title}
                          </span>
                        )}
                        {pipeline.client_name && (
                          <span className="text-gray-500 dark:text-gray-400 ml-2">
                            @ {pipeline.client_name}
                          </span>
                        )}
                        {!pipeline.mission_title && !pipeline.client_name && (
                          <span className="text-gray-500 dark:text-gray-400 italic">
                            {t('pipeline.noMissionAssigned')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Next interview indicator */}
                      {pipeline.next_interview && (
                        <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                          <CalendarIcon className="h-4 w-4" />
                          {formatRelativeTime(pipeline.next_interview)}
                        </div>
                      )}
                      
                      {/* Interview count */}
                      {pipeline.interview_count && pipeline.interview_count > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {pipeline.interview_count} {t('pipeline.interviews')}
                        </span>
                      )}

                      <ChevronRightIcon
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          isSelected ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isSelected && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    {/* Stage selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('pipeline.changeStage')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {stages.map((stage) => (
                          <button
                            key={stage.id}
                            onClick={() => handleStageChange(pipeline.id, stage.id)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                              pipeline.stage === stage.id
                                ? 'text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:opacity-80'
                            }`}
                            style={
                              pipeline.stage === stage.id
                                ? { backgroundColor: stage.color }
                                : undefined
                            }
                          >
                            {isEnglish ? stage.labelEn : stage.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('pipeline.notes')}
                      </label>
                      <textarea
                        value={pipeline.notes || ''}
                        onChange={(e) => {
                          const newNotes = e.target.value;
                          setPipelines(prev =>
                            prev.map(p =>
                              p.id === pipeline.id ? { ...p, notes: newNotes } : p
                            )
                          );
                        }}
                        onBlur={() => {
                          if (pipeline.notes !== null) {
                            updatePipelineNotes(pipeline.id, pipeline.notes || '');
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={2}
                        placeholder={t('pipeline.notesPlaceholder')}
                      />
                    </div>

                    {/* Interviews section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('pipeline.scheduledInterviews')}
                        </label>
                        <button
                          onClick={() => setShowInterviewModal(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <PlusIcon className="h-4 w-4" />
                          {t('pipeline.scheduleInterview')}
                        </button>
                      </div>

                      {interviews.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          {t('pipeline.noInterviews')}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {interviews.map((interview) => (
                            <div
                              key={interview.id}
                              className={`p-3 rounded-lg border ${
                                interview.status === 'cancelled'
                                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                  : interview.status === 'completed'
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {interview.title}
                                  </h4>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                      <CalendarIcon className="h-4 w-4" />
                                      {formatDate(interview.scheduled_at)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <ClockIcon className="h-4 w-4" />
                                      {interview.duration_minutes} min
                                    </span>
                                    {interview.location && (
                                      <span className="flex items-center gap-1">
                                        <MapPinIcon className="h-4 w-4" />
                                        {interview.location}
                                      </span>
                                    )}
                                    {interview.meeting_link && (
                                      <a
                                        href={interview.meeting_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                      >
                                        <LinkIcon className="h-4 w-4" />
                                        {t('pipeline.joinMeeting')}
                                      </a>
                                    )}
                                  </div>
                                  {interview.outcome && (
                                    <div className="mt-2 text-sm flex items-center gap-2">
                                      <span className="font-medium">{t('pipeline.outcome')}:</span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                        interview.outcome === 'positive' 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                                          : interview.outcome === 'negative'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                          : interview.outcome === 'neutral'
                                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
                                      }`}>
                                        {interview.outcome === 'positive' && '✓ '}
                                        {interview.outcome === 'negative' && '✗ '}
                                        {interview.outcome === 'to_follow_up' && '→ '}
                                        {t(`pipeline.outcomes.${interview.outcome === 'to_follow_up' ? 'toFollowUp' : interview.outcome}`)}
                                      </span>
                                      {interview.outcome_notes && (
                                        <span className="text-gray-500 dark:text-gray-400 italic">- {interview.outcome_notes}</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {interview.status === 'scheduled' && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedInterview(interview);
                                        setShowCompleteModal(true);
                                      }}
                                      className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                                      title={t('pipeline.markComplete')}
                                    >
                                      <CheckCircleIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                      onClick={() => handleCancelInterview(interview.id)}
                                      className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                      title={t('pipeline.cancelInterview')}
                                    >
                                      <XCircleIcon className="h-5 w-5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleViewHistory(pipeline)}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        {t('pipeline.viewHistory')}
                      </button>
                      <button
                        onClick={() => handleRemove(pipeline.id)}
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {t('pipeline.remove')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add to Pipeline Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('pipeline.addToProcessTitle')}
            </h3>

            <div className="space-y-4">
              {/* Mission selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.selectMission')}
                </label>
                <select
                  value={newPipeline.missionId}
                  onChange={(e) => setNewPipeline({ ...newPipeline, missionId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('pipeline.noMission')}</option>
                  {missions.map((mission) => (
                    <option key={mission.id} value={mission.id}>
                      {mission.title} - {mission.client}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.selectClient')}
                </label>
                <select
                  value={newPipeline.clientId}
                  onChange={(e) => setNewPipeline({ ...newPipeline, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('pipeline.noClient')}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.type ? `(${client.type})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.notes')}
                </label>
                <textarea
                  value={newPipeline.notes}
                  onChange={(e) => setNewPipeline({ ...newPipeline, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder={t('pipeline.notesPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddToPipeline}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('pipeline.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showInterviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('pipeline.scheduleInterviewTitle')}
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.interviewTitle')} *
                </label>
                <input
                  type="text"
                  value={newInterview.title}
                  onChange={(e) => setNewInterview({ ...newInterview, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('pipeline.interviewTitlePlaceholder')}
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.interviewType')}
                </label>
                <select
                  value={newInterview.interviewType}
                  onChange={(e) => setNewInterview({ ...newInterview, interviewType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="client">{t('pipeline.types.client')}</option>
                  <option value="partner">{t('pipeline.types.partner')}</option>
                  <option value="technical">{t('pipeline.types.technical')}</option>
                  <option value="hr">{t('pipeline.types.hr')}</option>
                </select>
              </div>

              {/* Date/Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.scheduledAt')} *
                </label>
                <input
                  type="datetime-local"
                  value={newInterview.scheduledAt}
                  onChange={(e) => setNewInterview({ ...newInterview, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.duration')}
                </label>
                <select
                  value={newInterview.durationMinutes}
                  onChange={(e) => setNewInterview({ ...newInterview, durationMinutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1h</option>
                  <option value={90}>1h30</option>
                  <option value={120}>2h</option>
                </select>
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder={t('pipeline.interviewDescriptionPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInterviewModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleScheduleInterview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('pipeline.schedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Interview Modal */}
      {showCompleteModal && selectedInterview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('pipeline.completeInterviewTitle')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.outcome')} *
                </label>
                <select
                  value={interviewOutcome.outcome}
                  onChange={(e) => setInterviewOutcome({ ...interviewOutcome, outcome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('pipeline.selectOutcome')}</option>
                  <option value="positive">{t('pipeline.outcomes.positive')}</option>
                  <option value="neutral">{t('pipeline.outcomes.neutral')}</option>
                  <option value="negative">{t('pipeline.outcomes.negative')}</option>
                  <option value="to_follow_up">{t('pipeline.outcomes.toFollowUp')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pipeline.outcomeNotes')}
                </label>
                <textarea
                  value={interviewOutcome.outcomeNotes}
                  onChange={(e) => setInterviewOutcome({ ...interviewOutcome, outcomeNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder={t('pipeline.outcomeNotesPlaceholder')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedInterview(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCompleteInterview}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('pipeline.complete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('pipeline.historyTitle')}
            </h3>

            {history.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                {t('pipeline.noHistory')}
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => {
                  const fromStage = entry.from_stage ? getStageInfo(entry.from_stage) : null;
                  const toStage = getStageInfo(entry.to_stage);

                  return (
                    <div
                      key={entry.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        {fromStage && (
                          <>
                            <span
                              className="px-2 py-0.5 rounded text-white text-xs"
                              style={{ backgroundColor: fromStage.color }}
                            >
                              {isEnglish ? fromStage.labelEn : fromStage.label}
                            </span>
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <span
                          className="px-2 py-0.5 rounded text-white text-xs"
                          style={{ backgroundColor: toStage.color }}
                        >
                          {isEnglish ? toStage.labelEn : toStage.label}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {entry.changed_by_name && <span>{entry.changed_by_name} • </span>}
                        {formatDate(entry.created_at)}
                      </div>
                      {entry.notes && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
