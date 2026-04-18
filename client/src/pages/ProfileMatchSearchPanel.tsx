/**
 * ProfileMatchSearchPanel - Mission selector, advanced options, weights, search button
 * Extracted from ProfileMatchingPage.tsx
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import type { Mission, Deal, ProfileMatchWeights } from '../types/entities';

const DEFAULT_WEIGHTS: ProfileMatchWeights = {
  skills: 40,
  tools: 25,
  industries: 20,
  softSkills: 15
};

interface ProfileMatchSearchPanelProps {
  deals: Deal[];
  selectedDealId: string;
  setSelectedDealId: (id: string) => void;
  missions: Mission[];
  selectedMissionId: string;
  setSelectedMissionId: (id: string) => void;
  selectedMission?: Mission;
  loadingMissions: boolean;
  loading: boolean;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  limit: number;
  setLimit: (v: number) => void;
  minScore: number;
  setMinScore: (v: number) => void;
  weights: ProfileMatchWeights;
  setWeights: (v: ProfileMatchWeights | ((prev: ProfileMatchWeights) => ProfileMatchWeights)) => void;
  hasResults: boolean;
  onSearch: () => void;
  onRefreshKeywords: () => void;
}

export default function ProfileMatchSearchPanel({
  deals,
  selectedDealId,
  setSelectedDealId,
  missions,
  selectedMissionId,
  setSelectedMissionId,
  selectedMission,
  loadingMissions,
  loading,
  showAdvanced,
  setShowAdvanced,
  limit,
  setLimit,
  minScore,
  setMinScore,
  weights,
  setWeights,
  hasResults,
  onSearch,
  onRefreshKeywords
}: ProfileMatchSearchPanelProps) {
  const { t } = useTranslation();
  const dealSelectId = 'profile-matching-deal-select';
  const missionSelectId = 'profile-matching-mission-select';

  return (
    <div className="cv-panel mb-6 rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-4">
        {deals.length > 0 && (
          <div>
            <label
              htmlFor={dealSelectId}
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <BriefcaseIcon className="mr-2 inline h-4 w-4" />
              {t('profileMatching.selectDeal')}
            </label>
            <select
              id={dealSelectId}
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              disabled={loadingMissions}
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:border-[var(--cv-primary)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--cv-primary)_20%,transparent)] dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--cv-text)]"
            >
              <option value="">{t('profileMatching.allDeals')}</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}{deal.client_name ? ` | ${deal.client_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor={missionSelectId}
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            <BriefcaseIcon className="mr-2 inline h-4 w-4" />
            {t('profileMatching.selectMission')}
          </label>
          <select
            id={missionSelectId}
            value={selectedMissionId}
            onChange={(e) => setSelectedMissionId(e.target.value)}
            disabled={loadingMissions}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:border-[var(--cv-primary)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--cv-primary)_20%,transparent)] dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--cv-text)]"
          >
            {loadingMissions ? (
              <option>{t('profileMatching.loadingMissions')}</option>
            ) : missions.length === 0 ? (
              <option>{t('profileMatching.noMissions')}</option>
            ) : (
              missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.Title}
                </option>
              ))
            )}
          </select>
        </div>

        {selectedMission && selectedMission.Content && (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="line-clamp-3 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {selectedMission.Content.replace(/<[^>]*>/g, '').substring(0, 300)}...
            </p>
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--cv-primary)] hover:opacity-80"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4" />
          {t('profileMatching.advancedOptions')}
          {showAdvanced ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('profileMatching.maxResults')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={limit}
                    onChange={(e) => setLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--cv-text)]"
                    placeholder={t('profileMatching.maxResultsPlaceholder')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('profileMatching.minScore')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--cv-text)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t('profileMatching.weights')}
                </label>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {(['skills', 'tools', 'industries', 'softSkills'] as const).map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                        {t(`profileMatching.categories.${key}`)}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={weights[key]}
                        onChange={(e) => setWeights((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))}
                        className="w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--cv-text)]"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                  {t('profileMatching.weightsTotal')}: {weights.skills + weights.tools + weights.industries + weights.softSkills}%
                </p>
              </div>

              <button
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
              >
                {t('profileMatching.resetWeights')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onSearch}
            disabled={loading || !selectedMissionId || loadingMissions}
            className={`cv-page-primary-action inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all ${loading || !selectedMissionId || loadingMissions ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                {t('profileMatching.searching')}
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5" />
                {t('profileMatching.search')}
              </>
            )}
          </button>

          {hasResults && (
            <button
              onClick={onRefreshKeywords}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-[var(--cv-text)] dark:hover:bg-white/[0.04]"
              title={t('profileMatching.refreshKeywordsTooltip')}
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
