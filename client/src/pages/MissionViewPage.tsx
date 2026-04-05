/**
 * MissionViewPage Component
 * Displays a single mission by ID from URL parameter
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  TagIcon,
  FolderIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import MissionPipelineKanban from '../components/MissionsPage/MissionPipelineKanban';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { formatDate } from '../utils/dateFormatter';
import i18n from '../i18n';

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Customer?: string;
  'Created At'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  Keywords?: string;
  'Deal ID'?: string;
  'Deal Title'?: string;
  'Deal Status'?: string;
  'Client ID'?: string;
  'Client Name'?: string;
  'Contact Name'?: string;
  'Contact Role'?: string;
}

const statusClasses: Record<NonNullable<Mission['Status']>, string> = {
  Active: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-tertiary)_18%,transparent)]',
  Draft: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-warning)_18%,transparent)]',
  Closed: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-danger)_18%,transparent)]',
};

const keywordPalette = {
  industries: 'bg-purple-50 text-purple-700 ring-1 ring-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/20',
  skills: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
  softSkills: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  tools: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
} as const;

const MissionViewPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMission = async () => {
      if (!id) {
        setError('No mission ID provided');
        setLoading(false);
        return;
      }

      try {
        logger.log('[MissionViewPage] Fetching mission:', id);
        const response = await authGet(`/api/missions/${id}`);
        if (response.ok) {
          const data = await response.json();
          setMission(data);
        } else {
          setError('Mission not found');
        }
      } catch (err) {
        logger.error('[MissionViewPage] Error fetching mission:', err);
        setError('Failed to load mission');
        toast.error(t('errors.loadMission'));
      } finally {
        setLoading(false);
      }
    };

    void loadMission();
  }, [id, authGet, t]);

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/missions');
    }
  };

  const handleEdit = () => {
    navigate('/missions', { state: { editMissionId: id } });
  };

  const formatMissionDate = (dateString?: string) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return formatDate(dateString, 'long', locale) || '';
  };

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

  if (error || !mission) {
    return (
      <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="cv-panel rounded-[2rem] p-8 text-center sm:p-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                <BriefcaseIcon className="h-8 w-8" />
              </div>
              <h2 className="cv-display text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">
                {t('errors.missionNotFound')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-base">
                {error || t('errors.missionNotFoundDescription')}
              </p>
              <button
                onClick={handleBack}
                className="cv-ghost-button mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                {t('common.back')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  let keywords: { skills?: string[]; tools?: string[]; industries?: string[]; softSkills?: string[] } | null = null;
  if (mission.Keywords) {
    try {
      keywords = JSON.parse(mission.Keywords);
    } catch {
      keywords = null;
    }
  }

  return (
    <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-4">
          <button
            onClick={handleBack}
            className="cv-ghost-button inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            {t('common.back')}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <section className="glass-panel-strong overflow-hidden rounded-[2rem] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="cv-kicker">{t('missions.title')}</span>
              <span className="text-slate-400 dark:text-slate-500">&gt;</span>
              <span className="cv-kicker text-[var(--cv-primary)]">{t('missions.view', 'Détail')}</span>
            </div>

            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {mission.Status ? (
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses[mission.Status]}`}>
                      {t(`missions.status.${mission.Status}`)}
                    </span>
                  ) : null}
                  {mission.Customer ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                      <BuildingOfficeIcon className="h-3.5 w-3.5" />
                      {mission.Customer}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] shadow-sm">
                    <BriefcaseIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="cv-display text-3xl font-bold text-slate-950 dark:text-[var(--cv-text)] sm:text-4xl">
                      {mission.Title || t('missions.noTitle')}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-base">
                      {t('missions.description')}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                  {mission['Created At'] ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                      <CalendarIcon className="h-4 w-4" />
                      {formatMissionDate(mission['Created At'])}
                    </span>
                  ) : null}
                  {mission['Deal Title'] ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                      <FolderIcon className="h-4 w-4 text-[var(--cv-secondary)]" />
                      <span className="font-medium text-slate-700 dark:text-[var(--cv-secondary)]">{mission['Deal Title']}</span>
                    </span>
                  ) : null}
                  {mission['Client Name'] ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                      <BuildingOfficeIcon className="h-4 w-4" />
                      {mission['Client Name']}
                    </span>
                  ) : null}
                  {mission['Contact Name'] ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-white/6">
                      <UserIcon className="h-4 w-4" />
                      <span>{mission['Contact Name']}</span>
                      {mission['Contact Role'] ? <span className="text-slate-400 dark:text-[#7f8ab0]">· {mission['Contact Role']}</span> : null}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                onClick={handleEdit}
                className="cv-gradient-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                <PencilSquareIcon className="h-5 w-5" />
                {t('common.edit')}
              </button>
            </div>
          </section>

          <section className="cv-panel rounded-[2rem] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="cv-kicker text-[var(--cv-primary)]">{t('missions.description')}</span>
            </div>

            {mission.Content ? (
              <div
                className="prose prose-sm max-w-none text-slate-700 dark:prose-invert dark:text-[var(--cv-muted)] sm:prose-base"
                dangerouslySetInnerHTML={createSafeHtml(mission.Content)}
              />
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm italic text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-[#7f8ab0]">
                {t('missions.noDescription')}
              </div>
            )}
          </section>

          {keywords ? (
            <section className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <TagIcon className="h-5 w-5 text-[var(--cv-primary)]" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {t('missions.extractedKeywords')}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {keywords.skills && keywords.skills.length > 0 ? (
                  <div className="rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t('profileMatching.categories.skills')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {keywords.skills.map((skill, idx) => (
                        <span key={idx} className={`rounded-full px-3 py-1 text-xs font-medium ${keywordPalette.skills}`}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {keywords.tools && keywords.tools.length > 0 ? (
                  <div className="rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t('profileMatching.categories.tools')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {keywords.tools.map((tool, idx) => (
                        <span key={idx} className={`rounded-full px-3 py-1 text-xs font-medium ${keywordPalette.tools}`}>
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {keywords.industries && keywords.industries.length > 0 ? (
                  <div className="rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t('profileMatching.categories.industries')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {keywords.industries.map((industry, idx) => (
                        <span key={idx} className={`rounded-full px-3 py-1 text-xs font-medium ${keywordPalette.industries}`}>
                          {industry}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {keywords.softSkills && keywords.softSkills.length > 0 ? (
                  <div className="rounded-[1.5rem] bg-white/60 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t('profileMatching.categories.softSkills')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {keywords.softSkills.map((skill, idx) => (
                        <span key={idx} className={`rounded-full px-3 py-1 text-xs font-medium ${keywordPalette.softSkills}`}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <MissionPipelineKanban
              missionId={id!}
              missionTitle={mission.Title || t('missions.noTitle')}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default MissionViewPage;
