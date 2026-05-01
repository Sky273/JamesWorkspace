/**
 * PipelineInterviewModals - Interview list and schedule modals
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
  XCircleIcon,
  ClipboardDocumentListIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import type { PipelineEntry, Interview } from '../../services/pipelineService';
import type { InterviewFormValues } from './MissionPipelineKanban.types';

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

interface PipelineScheduleInterviewModalProps {
  isEnglish: boolean;
  newInterview: InterviewFormValues;
  setNewInterview: (v: InterviewFormValues) => void;
  onSchedule: () => void;
  onClose: () => void;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:border-white/10 dark:bg-slate-950/50 dark:text-[var(--cv-text)] dark:focus:ring-purple-500/10';

const getInterviewTypeLabel = (type: string, isEnglish: boolean) => {
  const labels: Record<string, { fr: string; en: string }> = {
    client: { fr: 'Entretien client', en: 'Client interview' },
    partner: { fr: 'Entretien partenaire', en: 'Partner interview' },
    technical: { fr: 'Entretien technique', en: 'Technical interview' },
    hr: { fr: 'Entretien RH', en: 'HR interview' },
  };
  return labels[type]?.[isEnglish ? 'en' : 'fr'] || type;
};

const getInterviewTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    client: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
    partner: 'bg-purple-50 text-purple-700 ring-1 ring-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20',
    technical: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    hr: 'bg-orange-50 text-orange-700 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20',
  };
  return colors[type] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-[var(--cv-muted)] dark:ring-white/10';
};

const getOutcomeBadgeClass = (outcome: string | null) => {
  switch (outcome) {
    case 'positive':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'negative':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20';
    case 'neutral':
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-[var(--cv-muted)] dark:ring-white/10';
    default:
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20';
  }
};

const formatDateTime = (dateStr: string, isEnglish: boolean) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(isEnglish ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
  onClose,
}: PipelineInterviewsListModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="cv-surface flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <div className="cv-kicker mb-2">{t('pipeline.missionKicker')}</div>
            <h3 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">{t('pipeline.manageInterviews')}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">{entry.resume_name}</p>
          </div>
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
            aria-label={t('common.close', 'Fermer')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loadingInterviews ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <ArrowPathIcon className="h-7 w-7 animate-spin text-purple-500" />
            </div>
          ) : interviews.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <ClipboardDocumentListIcon className="mb-3 h-9 w-9 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-[var(--cv-muted)]">{t('pipeline.noInterviews')}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                {t('pipeline.noInterviewsHelp')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {interviews.map((interview) => {
                const isCancelled = interview.status === 'cancelled';
                const isCompleted = interview.status === 'completed';

                return (
                  <article
                    key={interview.id}
                    className={`rounded-[1.6rem] border p-5 transition-colors ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                        : isCancelled
                          ? 'border-slate-200 bg-slate-50/80 opacity-75 dark:border-white/10 dark:bg-white/[0.03]'
                          : 'border-slate-200/80 bg-white shadow-[0_20px_40px_-32px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-slate-900 dark:text-[var(--cv-text)]">{interview.title}</h4>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getInterviewTypeColor(interview.interview_type)}`}>
                            {getInterviewTypeLabel(interview.interview_type, isEnglish)}
                          </span>
                          {isCompleted && interview.outcome ? (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getOutcomeBadgeClass(interview.outcome)}`}>
                              {t(`pipeline.outcomes.${interview.outcome === 'to_follow_up' ? 'toFollowUp' : interview.outcome}`)}
                            </span>
                          ) : null}
                          {isCancelled ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:text-[var(--cv-muted)] dark:ring-white/10">
                              {t('pipeline.status.cancelled')}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 dark:text-[var(--cv-muted)] sm:grid-cols-2 xl:grid-cols-4">
                          <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
                            <CalendarIcon className="h-4 w-4" />
                            {formatDateTime(interview.scheduled_at, isEnglish)}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
                            <ClockIcon className="h-4 w-4" />
                            {interview.duration_minutes} min
                          </span>
                          {interview.location ? (
                            <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
                              <MapPinIcon className="h-4 w-4" />
                              {interview.location}
                            </span>
                          ) : null}
                          {interview.meeting_link ? (
                            <a
                              href={interview.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
                            >
                              <VideoCameraIcon className="h-4 w-4" />
                              {t('pipeline.joinMeeting')}
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>

                        {interview.description ? (
                          <p className="mt-4 text-sm text-slate-600 dark:text-[var(--cv-muted)]">{interview.description}</p>
                        ) : null}

                        {interview.outcome_notes ? (
                          <div className="mt-4 rounded-[1.1rem] bg-white/70 px-4 py-3 text-sm italic text-slate-600 ring-1 ring-slate-200/70 dark:bg-slate-950/30 dark:text-slate-300 dark:ring-white/10">
                            {interview.outcome_notes}
                          </div>
                        ) : null}
                      </div>

                      {interview.status === 'scheduled' ? (
                        <div className="flex gap-2 lg:flex-col">
                          <button
                            onClick={() => onComplete(interview, 'positive')}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                            title={t('pipeline.outcomes.positive')}
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            {t('common.complete', 'Terminer')}
                          </button>
                          <button
                            onClick={() => onCancel(interview)}
                            className="cv-ghost-button inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-rose-600 dark:text-rose-300"
                            title={t('pipeline.cancelInterview')}
                          >
                            <XCircleIcon className="h-4 w-4" />
                            {t('pipeline.cancelInterview')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            {t('common.close')}
          </button>
          <button
            onClick={onSchedule}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
          >
            <PlusIcon className="h-4 w-4" />
            {t('pipeline.scheduleInterview')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PipelineScheduleInterviewModal({
  isEnglish,
  newInterview,
  setNewInterview,
  onSchedule,
  onClose,
}: PipelineScheduleInterviewModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="cv-surface flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <div className="cv-kicker mb-2">{t('pipeline.missionKicker')}</div>
            <h3 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">{t('pipeline.scheduleInterviewTitle')}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {t('pipeline.scheduleInterviewHelp')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
            aria-label={t('common.close', 'Fermer')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.interviewTitle')} *
              </label>
              <input
                type="text"
                value={newInterview.title}
                onChange={(e) => setNewInterview({ ...newInterview, title: e.target.value })}
                className={fieldClassName}
                placeholder={t('pipeline.interviewTitlePlaceholder')}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.interviewType')}
              </label>
              <select
                value={newInterview.interviewType}
                onChange={(e) =>
                  setNewInterview({
                    ...newInterview,
                    interviewType: e.target.value as 'client' | 'partner' | 'technical' | 'hr',
                  })
                }
                className={fieldClassName}
              >
                <option value="client">{t('pipeline.types.client')}</option>
                <option value="partner">{t('pipeline.types.partner')}</option>
                <option value="technical">{t('pipeline.types.technical')}</option>
                <option value="hr">{t('pipeline.types.hr')}</option>
              </select>
              {newInterview.interviewType === 'client' ? (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">
                  {isEnglish
                    ? 'This moves the candidate into the “Interview scheduled” stage.'
                    : 'Cela déplace automatiquement le candidat vers l’étape « Entretien planifié ».'}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.duration')}
              </label>
              <select
                value={newInterview.durationMinutes}
                onChange={(e) => setNewInterview({ ...newInterview, durationMinutes: parseInt(e.target.value, 10) })}
                className={fieldClassName}
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1h</option>
                <option value={90}>1h30</option>
                <option value={120}>2h</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.scheduledAt')} *
              </label>
              <input
                type="datetime-local"
                value={newInterview.scheduledAt}
                onChange={(e) => setNewInterview({ ...newInterview, scheduledAt: e.target.value })}
                className={fieldClassName}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.location')}
              </label>
              <input
                type="text"
                value={newInterview.location}
                onChange={(e) => setNewInterview({ ...newInterview, location: e.target.value })}
                className={fieldClassName}
                placeholder={t('pipeline.locationPlaceholder')}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.meetingLink')}
              </label>
              <input
                type="url"
                value={newInterview.meetingLink}
                onChange={(e) => setNewInterview({ ...newInterview, meetingLink: e.target.value })}
                className={fieldClassName}
                placeholder="https://meet.google.com/..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.interviewDescription')}
              </label>
              <textarea
                value={newInterview.description}
                onChange={(e) => setNewInterview({ ...newInterview, description: e.target.value })}
                rows={4}
                className={fieldClassName}
                placeholder={t('pipeline.interviewDescriptionPlaceholder')}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSchedule}
            disabled={!newInterview.title || !newInterview.scheduledAt}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('pipeline.schedule')}
          </button>
        </div>
      </div>
    </div>
  );
}
