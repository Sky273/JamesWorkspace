import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import type { Interview } from '../../services/pipelineService';
import { getUpcomingInterviews } from '../../services/pipelineService';
import logger from '../../utils/logger.frontend';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfCalendarGrid(date: Date) {
  const firstDay = startOfMonth(date);
  const day = firstDay.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const result = new Date(firstDay);
  result.setDate(firstDay.getDate() - diff);
  return result;
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function getInterviewTypeTone(interviewType: Interview['interview_type']) {
  switch (interviewType) {
    case 'client':
      return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20';
    case 'technical':
      return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20';
    case 'partner':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20';
    case 'hr':
    default:
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20';
  }
}

function getInterviewTypeLabel(interviewType: Interview['interview_type'], isEnglish: boolean) {
  switch (interviewType) {
    case 'client':
      return isEnglish ? 'Client' : 'Client';
    case 'technical':
      return isEnglish ? 'Technical' : 'Technique';
    case 'partner':
      return isEnglish ? 'Partner' : 'Partenaire';
    case 'hr':
    default:
      return 'HR';
  }
}

export default function InterviewsTab(): JSX.Element {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const loadInterviews = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const days = Math.max(
        31,
        Math.ceil((endOfMonth(currentMonth).getTime() - now.getTime()) / DAY_IN_MS) + 1
      );
      const data = await getUpcomingInterviews(days);
      setInterviews(data.filter((interview) => interview.status === 'scheduled'));
    } catch (error) {
      logger.error('[InterviewsTab] Error loading interviews:', error);
      toast.error(t('crm.interviews.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentMonth, t]);

  useEffect(() => {
    void loadInterviews();
  }, [loadInterviews]);

  const interviewsByDay = useMemo(() => {
    const map = new Map<string, Interview[]>();

    for (const interview of interviews) {
      const date = new Date(interview.scheduled_at);
      const key = date.toISOString().slice(0, 10);
      const current = map.get(key) || [];
      current.push(interview);
      map.set(key, current);
    }

    for (const dayInterviews of map.values()) {
      dayInterviews.sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime());
    }

    return map;
  }, [interviews]);

  const calendarDays = useMemo(() => {
    const firstVisibleDay = startOfCalendarGrid(currentMonth);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstVisibleDay);
      date.setDate(firstVisibleDay.getDate() + index);
      return date;
    });
  }, [currentMonth]);

  const selectedDayInterviews = useMemo(() => {
    const key = selectedDate.toISOString().slice(0, 10);
    return interviewsByDay.get(key) || [];
  }, [interviewsByDay, selectedDate]);

  useEffect(() => {
    const currentMonthKey = getMonthKey(currentMonth);
    const selectedMonthKey = getMonthKey(selectedDate);
    if (currentMonthKey === selectedMonthKey) {
      return;
    }

    const firstInterviewOfMonth = interviews.find((interview) => {
      const date = new Date(interview.scheduled_at);
      return getMonthKey(date) === currentMonthKey;
    });

    setSelectedDate(firstInterviewOfMonth ? new Date(firstInterviewOfMonth.scheduled_at) : startOfMonth(currentMonth));
  }, [currentMonth, interviews, selectedDate]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'fr-FR', {
        month: 'long',
        year: 'numeric',
      }).format(currentMonth),
    [currentMonth, isEnglish]
  );

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'fr-FR', { weekday: 'short' });
    const monday = new Date(Date.UTC(2026, 0, 5));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + index);
      return formatter.format(date);
    });
  }, [isEnglish]);

  const monthInterviewCount = useMemo(
    () =>
      interviews.filter((interview) => getMonthKey(new Date(interview.scheduled_at)) === getMonthKey(currentMonth)).length,
    [currentMonth, interviews]
  );

  return (
    <section className="section-shell rounded-[13px]">
      <div className="flex flex-col gap-4 border-b border-[var(--cv-outline)] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="cv-kicker mb-2">{t('crm.interviews.kicker')}</div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{t('crm.interviews.title')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-[var(--cv-muted)]">{t('crm.interviews.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            void loadInterviews();
          }}
          className="app-button-secondary inline-flex items-center justify-center gap-2 rounded-[9px] px-4 py-2.5 text-sm"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('crm.interviews.refresh')}
        </button>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.7fr)_340px]">
        <div className="cv-card rounded-[13px] border border-slate-200/70 bg-white/75 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold capitalize text-slate-950 dark:text-[var(--cv-text)]">{monthLabel}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-[var(--cv-muted)]">
                {t('crm.interviews.monthSummary', { count: monthInterviewCount })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="app-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-[9px]"
                aria-label={t('crm.interviews.previousMonth')}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                className="app-button-secondary rounded-[9px] px-3 py-2 text-sm font-medium"
              >
                {t('crm.interviews.today')}
              </button>
              <button
                onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="app-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-[9px]"
                aria-label={t('crm.interviews.nextMonth')}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--cv-muted)]">
                {label}
              </div>
            ))}

            {calendarDays.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayInterviews = interviewsByDay.get(key) || [];
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, new Date());
              const isSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-28 rounded-[9px] border p-2 text-left transition-all ${
                    isSelected
                      ? 'border-[var(--cv-primary)] bg-[#ede9ff] shadow-[0_18px_36px_-32px_rgba(98,70,234,0.45)] dark:bg-[#263052]'
                      : 'border-slate-200/70 bg-white/80 hover:border-slate-300 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/15'
                  } ${!isCurrentMonth ? 'opacity-45' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                        isToday
                          ? 'bg-[var(--cv-primary)] text-white'
                          : 'text-slate-700 dark:text-[var(--cv-text)]'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayInterviews.length > 0 ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/5 dark:text-[var(--cv-text)]">
                        {dayInterviews.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    {dayInterviews.slice(0, 3).map((interview) => (
                      <div
                        key={interview.id}
                        className="rounded-[9px] bg-slate-100/90 px-2.5 py-2 text-xs text-slate-700 ring-1 ring-slate-200/80 dark:bg-white/[0.04] dark:text-[var(--cv-text)] dark:ring-white/10"
                      >
                        <div className="font-semibold">
                          {new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(interview.scheduled_at))}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-slate-600 dark:text-[var(--cv-muted)]">
                          {interview.resume_name || interview.title}
                        </div>
                      </div>
                    ))}
                    {dayInterviews.length > 3 ? (
                      <div className="px-1 text-xs font-medium text-slate-500 dark:text-[var(--cv-muted)]">
                        +{dayInterviews.length - 3} {t('crm.interviews.more')}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="cv-card rounded-[13px] border border-slate-200/70 bg-white/75 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[9px] bg-[#ede9ff] text-[var(--cv-primary)] ring-1 ring-purple-100 dark:bg-[#263052] dark:ring-purple-500/20">
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-[var(--cv-text)]">{t('crm.interviews.dayDetails')}</p>
              <p className="text-sm text-slate-500 dark:text-[var(--cv-muted)]">
                {new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(selectedDate)}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[13px] border border-dashed border-slate-200/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-[var(--cv-muted)]">
              {t('crm.interviews.loading')}
            </div>
          ) : selectedDayInterviews.length === 0 ? (
            <div className="rounded-[13px] border border-dashed border-slate-200/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-[var(--cv-muted)]">
              {t('crm.interviews.emptyDay')}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayInterviews.map((interview) => (
                <article
                  key={interview.id}
                  className="rounded-[13px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)] dark:border-white/8 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-start)_90%,black)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getInterviewTypeTone(interview.interview_type)}`}>
                      {getInterviewTypeLabel(interview.interview_type, isEnglish)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/5 dark:text-[var(--cv-text)]">
                      {interview.duration_minutes} min
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                    {interview.resume_name || t('crm.interviews.unknownCandidate')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-[var(--cv-muted)]">{interview.title}</p>

                  <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-slate-400" />
                      <span>
                        {new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(interview.scheduled_at))}
                      </span>
                    </div>
                    {interview.mission_title ? (
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
                        <span>{interview.mission_title}</span>
                      </div>
                    ) : null}
                    {interview.client_name ? (
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-slate-400" />
                        <span>{interview.client_name}</span>
                      </div>
                    ) : null}
                    {interview.location ? (
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-slate-400" />
                        <span>{interview.location}</span>
                      </div>
                    ) : null}
                    {interview.meeting_link ? (
                      <a
                        href={interview.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[var(--cv-primary)] hover:text-[#6246ea] dark:hover:text-[#c9ccff]"
                      >
                        <VideoCameraIcon className="h-4 w-4" />
                        {t('crm.interviews.openMeeting')}
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>

      {!loading && interviews.length === 0 ? (
        <div className="border-t border-[var(--cv-outline)] px-5 py-8 text-center text-sm text-slate-500 dark:text-[var(--cv-muted)] xl:px-6">
          {t('crm.interviews.emptyMonth')}
        </div>
      ) : null}
    </section>
  );
}
