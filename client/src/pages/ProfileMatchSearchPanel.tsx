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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="space-y-4">
        {/* Deal selector */}
        {deals.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <BriefcaseIcon className="w-4 h-4 inline mr-2" />
              {t('profileMatching.selectDeal')}
            </label>
            <select
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              disabled={loadingMissions}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t('profileMatching.allDeals')}</option>
              {deals.map(deal => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}{deal.client_name ? ` — ${deal.client_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mission selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <BriefcaseIcon className="w-4 h-4 inline mr-2" />
            {t('profileMatching.selectMission')}
          </label>
          <select
            value={selectedMissionId}
            onChange={(e) => setSelectedMissionId(e.target.value)}
            disabled={loadingMissions}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {loadingMissions ? (
              <option>{t('profileMatching.loadingMissions')}</option>
            ) : missions.length === 0 ? (
              <option>{t('profileMatching.noMissions')}</option>
            ) : (
              missions.map(mission => (
                <option key={mission.id} value={mission.id}>
                  {mission.Title}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Mission preview */}
        {selectedMission && selectedMission.Content && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {selectedMission.Content.replace(/<[^>]*>/g, '').substring(0, 300)}...
            </p>
          </div>
        )}

        {/* Advanced options toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          {t('profileMatching.advancedOptions')}
          {showAdvanced ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </button>

        {/* Advanced options */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('profileMatching.maxResults')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={limit}
                    onChange={(e) => setLimit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0 = tous"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('profileMatching.minScore')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Weights */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('profileMatching.weights')}
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(['skills', 'tools', 'industries', 'softSkills'] as const).map(key => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t(`profileMatching.categories.${key}`)}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={weights[key]}
                        onChange={(e) => setWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('profileMatching.weightsTotal')}: {weights.skills + weights.tools + weights.industries + weights.softSkills}%
                </p>
              </div>

              <button
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t('profileMatching.resetWeights')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search button */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onSearch}
            disabled={loading || !selectedMissionId || loadingMissions}
            className={`btn btn-primary flex-1 flex items-center justify-center gap-2 px-6 py-3 ${loading || !selectedMissionId || loadingMissions ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                {t('profileMatching.searching')}
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="w-5 h-5" />
                {t('profileMatching.search')}
              </>
            )}
          </button>
          
          {hasResults && (
            <button
              onClick={onRefreshKeywords}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={t('profileMatching.refreshKeywordsTooltip')}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
