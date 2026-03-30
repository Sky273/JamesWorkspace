import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  LinkIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { Interview, PipelineEntry, PipelineStage, PipelineTabTranslateFn } from './types';

interface PipelineCardProps {
  pipeline: PipelineEntry;
  stages: PipelineStage[];
  interviews: Interview[];
  isSelected: boolean;
  isEnglish: boolean;
  formatDate: (value: string) => string;
  formatRelativeTime: (value: string) => string;
  onSelect: () => void;
  onChangeStage: (pipelineId: string, stageId: string) => void;
  onNotesChange: (pipelineId: string, notes: string) => void;
  onNotesBlur: (pipelineId: string, notes: string) => void;
  onScheduleInterview: () => void;
  onOpenCompleteInterview: (interview: Interview) => void;
  onCancelInterview: (interviewId: string) => void;
  onViewHistory: (pipeline: PipelineEntry) => void;
  onRemove: (pipelineId: string) => void;
  t: PipelineTabTranslateFn;
}

function getStageInfo(stageId: string, stages: PipelineStage[]) {
  return stages.find(stage => stage.id === stageId) || { label: stageId, labelEn: stageId, color: '#6B7280' };
}

export default function PipelineCard({
  pipeline,
  stages,
  interviews,
  isSelected,
  isEnglish,
  formatDate,
  formatRelativeTime,
  onSelect,
  onChangeStage,
  onNotesChange,
  onNotesBlur,
  onScheduleInterview,
  onOpenCompleteInterview,
  onCancelInterview,
  onViewHistory,
  onRemove,
  t,
}: PipelineCardProps): JSX.Element {
  const stageInfo = getStageInfo(pipeline.stage, stages);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-all ${isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
      <div className="p-4 cursor-pointer" onClick={onSelect}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: stageInfo.color }}>
              {isEnglish ? stageInfo.labelEn : stageInfo.label}
            </span>

            <div>
              {pipeline.mission_title && <span className="text-gray-900 dark:text-gray-100 font-medium">{pipeline.mission_title}</span>}
              {pipeline.client_name && <span className="text-gray-500 dark:text-gray-400 ml-2">@ {pipeline.client_name}</span>}
              {!pipeline.mission_title && !pipeline.client_name && (
                <span className="text-gray-500 dark:text-gray-400 italic">{t('pipeline.noMissionAssigned')}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {pipeline.next_interview && (
              <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                <CalendarIcon className="h-4 w-4" />
                {formatRelativeTime(pipeline.next_interview)}
              </div>
            )}

            {pipeline.interview_count && pipeline.interview_count > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{pipeline.interview_count} {t('pipeline.interviews')}</span>
            )}

            <ChevronRightIcon className={`h-5 w-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('pipeline.changeStage')}</label>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => onChangeStage(pipeline.id, stage.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${pipeline.stage === stage.id ? 'text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:opacity-80'}`}
                  style={pipeline.stage === stage.id ? { backgroundColor: stage.color } : undefined}
                >
                  {isEnglish ? stage.labelEn : stage.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('pipeline.notes')}</label>
            <textarea
              value={pipeline.notes || ''}
              onChange={(e) => onNotesChange(pipeline.id, e.target.value)}
              onBlur={() => onNotesBlur(pipeline.id, pipeline.notes || '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={2}
              placeholder={t('pipeline.notesPlaceholder')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pipeline.scheduledInterviews')}</label>
              <button onClick={onScheduleInterview} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <PlusIcon className="h-4 w-4" />
                {t('pipeline.scheduleInterview')}
              </button>
            </div>

            {interviews.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('pipeline.noInterviews')}</p>
            ) : (
              <div className="space-y-2">
                {interviews.map((interview) => (
                  <div key={interview.id} className={`p-3 rounded-lg border ${interview.status === 'cancelled' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : interview.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{interview.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><CalendarIcon className="h-4 w-4" />{formatDate(interview.scheduled_at)}</span>
                          <span className="flex items-center gap-1"><ClockIcon className="h-4 w-4" />{interview.duration_minutes} min</span>
                          {interview.location && <span className="flex items-center gap-1"><MapPinIcon className="h-4 w-4" />{interview.location}</span>}
                          {interview.meeting_link && (
                            <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                              <LinkIcon className="h-4 w-4" />{t('pipeline.joinMeeting')}
                            </a>
                          )}
                        </div>
                        {interview.outcome && (
                          <div className="mt-2 text-sm flex items-center gap-2">
                            <span className="font-medium">{t('pipeline.outcome')}:</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${interview.outcome === 'positive' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : interview.outcome === 'negative' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : interview.outcome === 'neutral' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'}`}>
                              {interview.outcome === 'positive' && '✓ '}
                              {interview.outcome === 'negative' && '✗ '}
                              {interview.outcome === 'to_follow_up' && '→ '}
                              {t(`pipeline.outcomes.${interview.outcome === 'to_follow_up' ? 'toFollowUp' : interview.outcome}`)}
                            </span>
                            {interview.outcome_notes && <span className="text-gray-500 dark:text-gray-400 italic">- {interview.outcome_notes}</span>}
                          </div>
                        )}
                      </div>

                      {interview.status === 'scheduled' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => onOpenCompleteInterview(interview)} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded" title={t('pipeline.markComplete')}>
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => onCancelInterview(interview.id)} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title={t('pipeline.cancelInterview')}>
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

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => onViewHistory(pipeline)} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              {t('pipeline.viewHistory')}
            </button>
            <button onClick={() => onRemove(pipeline.id)} className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
              <TrashIcon className="h-4 w-4" />
              {t('pipeline.remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
