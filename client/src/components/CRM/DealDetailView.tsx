import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  CurrencyEuroIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
  PencilSquareIcon,
  TagIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import ConsentBadge, { type ConsentStatus } from '../ConsentBadge';
import { getResumePreviewTags } from '../../pages/ResumesPage.hooks';
import logger from '../../utils/logger.frontend';
import { PRIORITY_CONFIG, STATUS_CONFIG } from './dealsTab.types';
import { type DealDetail, type DealMission, type DealResume, normalizeDeal, normalizeMission, normalizeResume } from './DealDetailView.adapters';
import { formatBudget, formatDealDate, getResumeStatusBadgeClass } from './DealDetailView.formatters';

interface DealDetailViewProps {
  dealId: string;
  onBack?: () => void;
  onEdit?: (dealId: string) => void;
  restoreScrollY?: number | null;
}

export default function DealDetailView({ dealId, onBack, onEdit, restoreScrollY = null }: DealDetailViewProps): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authGet } = useAuthFetch();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [missions, setMissions] = useState<DealMission[]>([]);
  const [resumes, setResumes] = useState<DealResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadDeal = async () => {
      setLoading(true);
      setError(null);

      try {
        const [dealResponse, missionsResponse, resumesResponse] = await Promise.all([
          authGet(`/api/deals/${dealId}`),
          authGet(`/api/deals/${dealId}/missions`),
          authGet(`/api/deals/${dealId}/resumes`),
        ]);

        if (!dealResponse.ok) {
          throw new Error(t('crm.deals.loadError'));
        }

        const dealPayload = await dealResponse.json();
        const missionsPayload = missionsResponse.ok ? await missionsResponse.json() : [];
        const resumesPayload = resumesResponse.ok ? await resumesResponse.json() : [];

        if (!active) {
          return;
        }

        setDeal(normalizeDeal((dealPayload || {}) as Record<string, unknown>));
        setMissions(Array.isArray(missionsPayload) ? missionsPayload.map((item) => normalizeMission(item as Record<string, unknown>)) : []);
        setResumes(Array.isArray(resumesPayload) ? resumesPayload.map((item) => normalizeResume(item as Record<string, unknown>)) : []);
      } catch (loadError) {
        logger.error('[DealDetailView] Error loading deal:', loadError);
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : t('crm.deals.loadError'));
        toast.error(t('crm.deals.loadError'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDeal();

    return () => {
      active = false;
    };
  }, [authGet, dealId, t]);

  useEffect(() => {
    if (loading || !deal || restoreScrollY == null) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoreScrollY, behavior: 'auto' });
    });
  }, [deal, loading, restoreScrollY]);

  const budgetLabel = useMemo(
    () => formatBudget(deal?.budget_min, deal?.budget_max),
    [deal?.budget_max, deal?.budget_min]
  );

  if (loading) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <div className="cv-panel flex items-center justify-center rounded-[2rem] py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--cv-primary)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="cv-panel rounded-[2rem] p-8 text-center sm:p-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                <BriefcaseIcon className="h-8 w-8" />
              </div>
              <h1 className="cv-display text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">
                {t('crm.deals.notFound')}
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-base">
                {error || t('crm.deals.notFoundDescription')}
              </p>
              {onBack ? (
                <button
                  onClick={onBack}
                  className="cv-ghost-button mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                  {t('crm.deals.backToDeals')}
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-4 flex items-center justify-between gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="cv-ghost-button inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              {t('crm.deals.backToDeals')}
            </button>
          ) : <span />}
          {onEdit ? (
            <button
              onClick={() => onEdit(deal.id)}
              className="cv-gradient-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              <PencilSquareIcon className="h-5 w-5" />
              {t('common.edit')}
            </button>
          ) : null}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <section className="glass-panel-strong overflow-hidden rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATUS_CONFIG[deal.status].color}`}>
                    {STATUS_CONFIG[deal.status].label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                    <span className={PRIORITY_CONFIG[deal.priority].color}>{PRIORITY_CONFIG[deal.priority].icon}</span>
                    {PRIORITY_CONFIG[deal.priority].label}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] shadow-sm">
                    <BriefcaseIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="cv-kicker text-[var(--cv-primary)]">{t('crm.deals.details')}</p>
                    <h1 className="cv-display text-3xl font-bold text-slate-950 dark:text-[var(--cv-text)] sm:text-4xl">
                      {deal.title}
                    </h1>
                    {deal.description ? (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-base">
                        {deal.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                  {deal.client_name ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                      <BuildingOfficeIcon className="h-4 w-4" />
                      {deal.client_name}
                    </span>
                  ) : null}
                  {deal.contact_name ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                      <UserIcon className="h-4 w-4" />
                      <span>{deal.contact_name}</span>
                      {deal.contact_role ? <span className="text-slate-400 dark:text-[#7f8ab0]">| {deal.contact_role}</span> : null}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                    <DocumentTextIcon className="h-4 w-4" />
                    {resumes.length} CV(s)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                    <BriefcaseIcon className="h-4 w-4" />
                    {missions.length} {t('crm.deals.missions')}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {t('crm.deals.dates')}
                </h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-[var(--cv-text)]">{t('crm.deals.expectedStart')}</p>
                  <p>{formatDealDate(deal.expected_start_date) || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-[var(--cv-text)]">{t('crm.deals.expectedEnd')}</p>
                  <p>{formatDealDate(deal.expected_end_date) || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-[var(--cv-text)]">{t('crm.deals.createdAt')}</p>
                  <p>{formatDealDate(deal.created_at) || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-[var(--cv-text)]">{t('crm.deals.updatedAt')}</p>
                  <p>{formatDealDate(deal.updated_at) || '-'}</p>
                </div>
              </div>
            </div>

            <div className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <CurrencyEuroIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {t('crm.deals.budget')}
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                {budgetLabel || '-'}
              </p>
            </div>

            <div className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {t('crm.deals.notes')}
                </h2>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                {deal.notes || '-'}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <BriefcaseIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {t('crm.deals.associatedMissions')}
                </h2>
              </div>
              {missions.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-[var(--cv-muted)]">
                  {t('crm.deals.noAssociatedMissions')}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {missions.map((mission) => (
                    <article
                      key={mission.id}
                      className="cv-card group flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/85 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:border-white/8 dark:bg-[rgba(15,23,42,0.72)]"
                    >
                      <div className="border-b border-slate-200/70 p-5 dark:border-white/6">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] shadow-sm">
                            <BriefcaseIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              {mission.status ? (
                                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                                  {mission.status}
                                </span>
                              ) : null}
                              {mission.adaptations_count != null ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                                  <TagIcon className="h-3.5 w-3.5" />
                                  {mission.adaptations_count} adaptation(s)
                                </span>
                              ) : null}
                            </div>
                            <h3 className="cv-display line-clamp-2 text-xl font-semibold leading-tight text-slate-950 dark:text-[var(--cv-text)]">
                              {mission.title || mission.id}
                            </h3>
                            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-[var(--cv-muted)]">
                              {mission.client_name ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/6">
                                  <BuildingOfficeIcon className="h-4 w-4" />
                                  {mission.client_name}
                                </span>
                              ) : null}
                              {mission.contact_name ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/6">
                                  <UserIcon className="h-4 w-4" />
                                  <span>{mission.contact_name}</span>
                                  {mission.contact_role ? <span className="text-slate-400 dark:text-[#7f8ab0]">· {mission.contact_role}</span> : null}
                                </span>
                              ) : null}
                              {mission.created_at ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/6">
                                  <CalendarIcon className="h-4 w-4" />
                                  {formatDealDate(mission.created_at)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-5">
                        <button
                          onClick={() => navigate(`/missions/${mission.id}`)}
                          className="cv-ghost-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                        >
                          <EyeIcon className="h-5 w-5" />
                          {t('missions.view')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {t('crm.deals.associatedResumes')}
                </h2>
              </div>
              {resumes.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-[var(--cv-muted)]">
                  {t('crm.deals.noAssociatedResumes')}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {resumes.map((resume) => {
                    const displayName = resume.Name || resume.name || t('resumes.untitled');
                    const rating = Number(resume['Improved Global Rating'] ?? resume['Global Rating'] ?? 0);
                    const tags = (['Skills', 'Industries', 'Tools', 'Soft Skills'] as const).flatMap((category) =>
                      getResumePreviewTags(resume, category).slice(0, 2)
                    );

                    return (
                      <article
                        key={resume.id}
                        className="cv-card group overflow-hidden rounded-[2rem] transition-all"
                      >
                        <div className="border-b border-slate-200/70 p-5 dark:border-white/6">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
                                  <DocumentTextIcon className="h-5 w-5" />
                                </div>
                                <h3 className="cv-display truncate text-lg font-bold text-slate-950 dark:text-[#dee5ff]">
                                  {displayName}
                                </h3>
                              </div>
                              {resume.Title ? (
                                <p className="mt-2 truncate pl-12 text-sm text-slate-600 dark:text-[#a3aac4]">
                                  {resume.Title}
                                </p>
                              ) : null}
                            </div>
                            <span className={`cv-pill inline-flex w-fit flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getResumeStatusBadgeClass(resume.Status)}`}>
                              {t(`resumes.status.${resume.Status?.toLowerCase() || 'new'}`)}
                            </span>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <ChartBarIcon className="h-5 w-5 text-slate-400 dark:text-[#7f8ab0]" />
                              <span className="text-sm text-slate-600 dark:text-[#a3aac4]">{t('resumes.score_label')}</span>
                            </div>
                            <span className="cv-display text-2xl font-bold text-slate-950 dark:text-[#dee5ff]">
                              {Number.isFinite(rating) ? `${rating}%` : '0%'}
                            </span>
                          </div>

                          <div className="cv-score-track mb-4 h-2 overflow-hidden rounded-full">
                            <div className="cv-score-fill h-full rounded-full" style={{ width: `${Math.max(0, Math.min(rating, 100))}%` }} />
                          </div>

                          <div className="mb-3 flex flex-col gap-2 text-sm text-slate-500 dark:text-[#a3aac4]">
                            {resume['Created At'] ? (
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                {formatDealDate(String(resume['Created At']))}
                              </div>
                            ) : null}
                            {resume.FirmName ? (
                              <div className="flex items-center gap-2">
                                <BuildingOfficeIcon className="h-4 w-4" />
                                <span>{resume.FirmName}</span>
                              </div>
                            ) : null}
                            {resume.consent_status ? (
                              <ConsentBadge
                                status={resume.consent_status as ConsentStatus}
                                candidateName={resume.candidate_name}
                                candidateEmail={resume.candidate_email}
                                consentTokenExpiresAt={resume.consent_token_expires_at}
                                retentionUntil={resume.retention_until}
                                compact={true}
                              />
                            ) : null}
                            {resume.deal_notes ? (
                              <p className="rounded-[1rem] bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-white/[0.03] dark:text-[var(--cv-muted)]">
                                {resume.deal_notes}
                              </p>
                            ) : null}
                          </div>

                          {tags.length > 0 ? (
                            <div className="mb-4 flex flex-wrap gap-2">
                              {tags.map((tag, index) => (
                                <span key={`${resume.id}-${tag}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => navigate(`/resumes/${resume.id}/analysis`, {
                                state: {
                                  from: 'dealDetailView',
                                  dealReturnContext: {
                                    dealId,
                                    scrollY: window.scrollY,
                                  },
                                },
                              })}
                              className="cv-ghost-button inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                            >
                              <EyeIcon className="h-5 w-5" />
                              {t('resumes.view')}
                            </button>
                            {resume.added_at ? (
                              <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                                <FolderIcon className="h-4 w-4" />
                                {formatDealDate(resume.added_at)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
