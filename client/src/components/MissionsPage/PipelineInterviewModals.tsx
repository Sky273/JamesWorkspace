/**
 * PipelineInterviewModals - Interview list and schedule modals
 * Extracted from MissionPipelineKanban.tsx
 */

import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  CalendarIcon,
  ClockIcon,
  VideoCameraIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import type { PipelineEntry, Interview } from '../../services/pipelineService';

interface NewInterviewForm {
  title: string;
  description: string;
  interviewType: 'client' | 'partner' | 'technical' | 'hr';
  scheduledAt: string;
  durationMinutes: number;
  location: string;
  meetingLink: string;
}

// ============================================================
// Interviews List Modal
// ============================================================

interface PipelineInterviewsListModalProps {
  entry: PipelineEntry;
  interviews: Interview[];
  loadingInterviews: boolean;
  isEnglish: boolean;
  onComplete: (interview: Interview, outcome: string) => void;
  onCancel: (interview: Interview) => void;
  onSchedule: () => void;
  onClose: () => void;
}

const getInterviewTypeLabel = (type: string, isEnglish: boolean) => {
  const labels: Record<string, { fr: string; en: string }> = {
    client: { fr: 'Entretien client', en: 'Client interview' },
    partner: { fr: 'Entretien partenaire', en: 'Partner interview' },
    technical: { fr: 'Entretien technique', en: 'Technical interview' },
    hr: { fr: 'Entretien RH', en: 'HR interview' }
  };
  return labels[type]?.[isEnglish ? 'en' : 'fr'] || type;
};

const getInterviewTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    client: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    partner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    technical: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    hr: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
  };
  return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

const formatDateTime = (dateStr: string, isEnglish: boolean) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function PipelineInterviewsListModal({
  entry,
  interviews,
  loadingInterviews,
  isEnglish,
  onComplete,
  onCancel,
  onSchedule,
  onClose
}: PipelineInterviewsListModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('pipeline.manageInterviews')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {entry.resume_name}
            </p>
          </div>
          <button
            onClick={onClose}
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
          ) : interviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('pipeline.noInterviews')}
            </div>
          ) : (
            <div className="space-y-3">
              {interviews.map(interview => (
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
                        {getInterviewTypeLabel(interview.interview_type, isEnglish)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {interview.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => onComplete(interview, 'positive')}
                            className="p-1 text-green-500 hover:text-green-700 rounded"
                            title={t('pipeline.outcomes.positive')}
                          >
                            <CheckCircleIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onCancel(interview)}
                            className="p-1 text-red-500 hover:text-red-700 rounded"
                            title={t('pipeline.cancelInterview')}
                          >
                            <XCircleIcon className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {interview.status === 'completed' && interview.outcome && (
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
                      {formatDateTime(interview.scheduled_at, isEnglish)}
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
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
          <button
            onClick={onSchedule}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            {t('pipeline.scheduleInterview')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Schedule Interview Modal
// ============================================================

interface PipelineScheduleInterviewModalProps {
  isEnglish: boolean;
  newInterview: NewInterviewForm;
  setNewInterview: (v: NewInterviewForm) => void;
  onSchedule: () => void;
  onClose: () => void;
}

export function PipelineScheduleInterviewModal({
  isEnglish,
  newInterview,
  setNewInterview,
  onSchedule,
  onClose
}: PipelineScheduleInterviewModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('pipeline.scheduleInterviewTitle')}
          </h3>
          <button
            onClick={onClose}
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
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSchedule}
            disabled={!newInterview.title || !newInterview.scheduledAt}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('pipeline.schedule')}
          </button>
        </div>
      </div>
    </div>
  );
}
