import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CurrencyEuroIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import { formatDate } from '../../utils/dateFormatter';
import i18n from '../../i18n';
import { Deal, PRIORITY_CONFIG, STATUS_CONFIG } from './dealsTab.types';

interface DealMission {
  id: string;
  title: string;
  status?: string;
}

interface DealResume {
  id: string;
  filename: string;
  status?: string;
}

interface DealDetail extends Deal {
  notes?: string;
}

interface DealDetailViewProps {
  dealId: string;
  onBack?: () => void;
  onEdit?: (dealId: string) => void;
}

function formatDealDate(value?: string): string {
  if (!value) return '';
  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  return formatDate(value, 'long', locale) || '';
}

function getString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function getNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeDeal(payload: Record<string, unknown>): DealDetail {
  return {
    id: getString(payload, ['id', 'ID']) || '',
    title: getString(payload, ['title', 'Title']) || '',
    description: getString(payload, ['description', 'Description']),
    status: (getString(payload, ['status', 'Status']) as Deal['status']) || 'open',
    priority: (getString(payload, ['priority', 'Priority']) as Deal['priority']) || 'medium',
    client_id: getString(payload, ['client_id', 'clientId']),
    client_name: getString(payload, ['client_name', 'clientName', 'Client Name']),
    client_type: getString(payload, ['client_type', 'clientType', 'Client Type']),
    contact_id: getString(payload, ['contact_id', 'contactId']),
    contact_name: getString(payload, ['contact_name', 'contactName', 'Contact Name']),
    contact_email: getString(payload, ['contact_email', 'contactEmail', 'Contact Email']),
    contact_role: getString(payload, ['contact_role', 'contactRole', 'Contact Role']),
    expected_start_date: getString(payload, ['expected_start_date', 'expectedStartDate', 'Expected Start Date']),
    expected_end_date: getString(payload, ['expected_end_date', 'expectedEndDate', 'Expected End Date']),
    budget_min: getNumber(payload, ['budget_min', 'budgetMin']),
    budget_max: getNumber(payload, ['budget_max', 'budgetMax']),
    resumes_count: getNumber(payload, ['resumes_count', 'resumesCount']) || 0,
    missions_count: getNumber(payload, ['missions_count', 'missionsCount']) || 0,
    created_at: getString(payload, ['created_at', 'createdAt', 'Created At']) || '',
    updated_at: getString(payload, ['updated_at', 'updatedAt', 'Updated At']) || '',
    notes: getString(payload, ['notes', 'Notes']),
  };
}

function normalizeMission(payload: Record<string, unknown>): DealMission {
  return {
    id: getString(payload, ['id', 'ID']) || '',
    title: getString(payload, ['title', 'Title']) || '',
    status: getString(payload, ['status', 'Status']),
  };
}

function normalizeResume(payload: Record<string, unknown>): DealResume {
  return {
    id: getString(payload, ['id', 'ID']) || '',
    filename: getString(payload, ['filename', 'Filename', 'title', 'Title', 'file_name']) || '',
    status: getString(payload, ['status', 'Status']),
  };
}

function formatBudget(min?: number, max?: number): string | null {
  if (min == null && max == null) return null;
  const formatter = new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  if (min != null && max != null) {
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  }
  return formatter.format(min ?? max ?? 0);
}

export default function DealDetailView({ dealId, onBack, onEdit }: DealDetailViewProps): JSX.Element {
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
                <div className="space-y-3">
                  {missions.map((mission) => (
                    <div key={mission.id} className="rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                      <button
                        onClick={() => navigate(`/missions/${mission.id}`)}
                        className="text-left font-semibold text-slate-900 transition-colors hover:text-[var(--cv-primary)] dark:text-[var(--cv-text)]"
                      >
                        {mission.title || mission.id}
                      </button>
                      {mission.status ? (
                        <p className="mt-1 text-sm text-slate-500 dark:text-[var(--cv-muted)]">{mission.status}</p>
                      ) : null}
                    </div>
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
                <div className="space-y-3">
                  {resumes.map((resume) => (
                    <div key={resume.id} className="rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                      <button
                        onClick={() => navigate(`/resumes/${resume.id}/analysis`)}
                        className="text-left font-semibold text-slate-900 transition-colors hover:text-[var(--cv-primary)] dark:text-[var(--cv-text)]"
                      >
                        {resume.filename || resume.id}
                      </button>
                      {resume.status ? (
                        <p className="mt-1 text-sm text-slate-500 dark:text-[var(--cv-muted)]">{resume.status}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
