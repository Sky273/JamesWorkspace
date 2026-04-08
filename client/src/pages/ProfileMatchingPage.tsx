/**
 * Profile Matching Page
 * Find best matching CVs for a mission
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  DocumentTextIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import PageHeader from '../components/page/PageHeader';
import { findMatchingProfiles, getMissions, getDeals, clearMissionKeywordsCache, analyzeProfileForMission } from '../utils/profileMatchingService';
import type {
  Mission,
  Deal,
  ProfileMatchingResponse,
  ProfileMatchWeights,
  MissionKeywords,
  DetailedProfileAnalysisResponse
} from '../types/entities';
import logger from '../utils/logger.frontend';
import ProfileMatchCard from './ProfileMatchCard';
import ProfileMatchSearchPanel from './ProfileMatchSearchPanel';
import ProfileMatchingOverlay from '../components/ProfileMatchingOverlay';

const DEFAULT_WEIGHTS: ProfileMatchWeights = {
  skills: 40,
  tools: 25,
  industries: 20,
  softSkills: 15
};

const ProfileMatchingPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [results, setResults] = useState<ProfileMatchingResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const [analyzingProfile, setAnalyzingProfile] = useState<string | null>(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState<Record<string, DetailedProfileAnalysisResponse>>({});

  const [limit, setLimit] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [weights, setWeights] = useState<ProfileMatchWeights>(DEFAULT_WEIGHTS);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingMissions(true);
        const [missionsData, dealsData] = await Promise.all([
          getMissions(),
          getDeals().catch(() => [] as Deal[])
        ]);
        const missionsArray = Array.isArray(missionsData) ? missionsData : [];
        const dealsArray = Array.isArray(dealsData) ? dealsData : [];
        setMissions(missionsArray);
        setDeals(dealsArray);
        if (missionsArray.length > 0) {
          setSelectedMissionId(missionsArray[0].id);
        }
      } catch (error) {
        logger.error('Error loading missions:', error);
        toast.error(t('profileMatching.errors.loadMissions'));
      } finally {
        setLoadingMissions(false);
      }
    };
    void loadData();
  }, [t]);

  const filteredMissions = useMemo(() => {
    if (!selectedDealId) return missions;
    return missions.filter((mission) => mission['Deal ID'] === selectedDealId);
  }, [missions, selectedDealId]);

  const selectedMission = useMemo(
    () => filteredMissions.find((mission) => mission.id === selectedMissionId),
    [filteredMissions, selectedMissionId]
  );

  useEffect(() => {
    if (filteredMissions.length > 0 && !filteredMissions.find((mission) => mission.id === selectedMissionId)) {
      setSelectedMissionId(filteredMissions[0].id);
    } else if (filteredMissions.length === 0) {
      setSelectedMissionId('');
    }
  }, [filteredMissions, selectedMissionId]);

  const handleSearch = async () => {
    if (!selectedMissionId) {
      toast.error(t('profileMatching.errors.selectMission'));
      return;
    }

    try {
      setLoading(true);
      setResults(null);

      const data = await findMatchingProfiles(selectedMissionId, {
        limit,
        minScore,
        weights
      });

      setResults(data);

      if (data.profiles.length === 0) {
        toast(t('profileMatching.noResults'));
      } else {
        const scannedCount = data.totalResumesScanned;
        const sentToLlmCount = data.profilesSentToLlm ?? scannedCount;
        const returnedCount = data.profiles.length;
        toast.success(t('profileMatching.resultsToast', {
          scanned: scannedCount,
          sent: sentToLlmCount,
          returned: returnedCount,
        }));
      }
    } catch (error) {
      logger.error('Error searching profiles:', error);
      toast.error(t('profileMatching.errors.search'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshKeywords = async () => {
    if (!selectedMissionId) return;

    try {
      await clearMissionKeywordsCache(selectedMissionId);
      toast.success(t('profileMatching.keywordsRefreshed'));
      if (results) {
        void handleSearch();
      }
    } catch (error) {
      logger.error('Error refreshing keywords:', error);
      toast.error(t('profileMatching.errors.refreshKeywords'));
    }
  };

  const handleDetailedAnalysis = async (resumeId: string) => {
    if (!selectedMissionId) return;

    if (detailedAnalysis[resumeId]) {
      setExpandedProfile(resumeId);
      return;
    }

    try {
      setAnalyzingProfile(resumeId);
      const result = await analyzeProfileForMission(selectedMissionId, resumeId);
      setDetailedAnalysis((prev) => ({ ...prev, [resumeId]: result }));
      setExpandedProfile(resumeId);
      toast.success(t('profileMatching.analysisComplete'));
    } catch (error) {
      logger.error('Error analyzing profile:', error);
      toast.error(t('profileMatching.errors.analysis'));
    } finally {
      setAnalyzingProfile(null);
    }
  };

  const handleViewResume = (resumeId: string) => {
    navigate(`/resumes/${resumeId}`);
  };

  const renderKeywordsBadges = (keywords: MissionKeywords) => {
    const categories = [
      { key: 'skills', label: t('profileMatching.categories.skills'), items: keywords.skills, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
      { key: 'tools', label: t('profileMatching.categories.tools'), items: keywords.tools, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      { key: 'industries', label: t('profileMatching.categories.industries'), items: keywords.industries, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
      { key: 'softSkills', label: t('profileMatching.categories.softSkills'), items: keywords.softSkills, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' }
    ];

    return (
      <div className="space-y-3">
        {categories.map((category) => category.items && category.items.length > 0 && (
          <div key={category.key}>
            <span className="text-xs font-medium text-slate-500 dark:text-[var(--cv-muted)]">{category.label}:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {category.items.map((item, idx) => (
                <span key={idx} className={`rounded-full px-2 py-0.5 text-xs ${category.color}`}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const isProcessing = loading || analyzingProfile !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="editorial-migrated-shell relative min-h-screen px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="cv-surface mx-auto max-w-7xl rounded-[2.5rem] p-6 sm:p-8">
        <AnimatePresence>
          {isProcessing ? (
            <ProfileMatchingOverlay mode={loading ? 'searching' : 'analyzing'} />
          ) : null}
        </AnimatePresence>

        <PageHeader title={t('profileMatching.title')} subtitle={t('profileMatching.subtitle')} />

        <ProfileMatchSearchPanel
          deals={deals}
          selectedDealId={selectedDealId}
          setSelectedDealId={setSelectedDealId}
          missions={filteredMissions}
          selectedMissionId={selectedMissionId}
          setSelectedMissionId={setSelectedMissionId}
          selectedMission={selectedMission}
          loadingMissions={loadingMissions}
          loading={loading}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          limit={limit}
          setLimit={setLimit}
          minScore={minScore}
          setMinScore={setMinScore}
          weights={weights}
          setWeights={setWeights}
          hasResults={!!results}
          onSearch={handleSearch}
          onRefreshKeywords={handleRefreshKeywords}
        />

        {results ? (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="cv-panel rounded-[1.75rem] p-5">
                <p className="cv-kicker text-[var(--cv-primary)]">{t('profileMatching.scannedResumes', { count: results.totalResumesScanned })}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{results.totalResumesScanned}</p>
              </div>
              <div className="cv-panel rounded-[1.75rem] p-5">
                <p className="cv-kicker text-[var(--cv-primary)]">LLM</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                  {results.profilesSentToLlm ?? results.totalResumesScanned}
                </p>
              </div>
              <div className="cv-panel rounded-[1.75rem] p-5">
                <p className="cv-kicker text-[var(--cv-primary)]">{t('profileMatching.results')}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{results.profiles.length}</p>
              </div>
            </section>

            <section className="cv-panel rounded-[2rem] p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                <SparklesIcon className="h-5 w-5 text-yellow-500" />
                {t('profileMatching.extractedKeywords')}
              </h2>
              {renderKeywordsBadges(results.missionKeywords)}
              <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                <p>{t('profileMatching.scannedResumes', { count: results.totalResumesScanned })}</p>
                <p>
                  {results.profilesSentToLlm ?? results.totalResumesScanned} LLM
                  {typeof results.profilesExplained === 'number'
                    ? ` | ${t('profileMatching.explainedCount', { count: results.profilesExplained })}`
                    : ''}
                </p>
                <p>{t('profileMatching.returnedCount', { count: results.profiles.length })}</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                {t('profileMatching.results')} ({results.profiles.length})
              </h2>

              {results.profiles.length === 0 ? (
                <div className="cv-panel rounded-[2rem] p-10 text-center">
                  <UserGroupIcon className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                  <p className="text-slate-500 dark:text-[var(--cv-muted)]">{t('profileMatching.noProfilesFound')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.profiles.map((profile, index) => (
                    <ProfileMatchCard
                      key={profile.resumeId}
                      profile={profile}
                      index={index}
                      isExpanded={expandedProfile === profile.resumeId}
                      onToggleExpand={setExpandedProfile}
                      detailedAnalysis={detailedAnalysis[profile.resumeId]}
                      analyzingProfile={analyzingProfile}
                      onDetailedAnalysis={handleDetailedAnalysis}
                      onViewResume={handleViewResume}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {!results && !loading ? (
          <div className="cv-panel rounded-[2rem] p-12 text-center">
            <MagnifyingGlassIcon className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" />
            <h3 className="mb-2 text-lg font-medium text-slate-950 dark:text-[var(--cv-text)]">
              {t('profileMatching.emptyState.title')}
            </h3>
            <p className="mx-auto max-w-md text-slate-500 dark:text-[var(--cv-muted)]">
              {t('profileMatching.emptyState.description')}
            </p>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

export default ProfileMatchingPage;
