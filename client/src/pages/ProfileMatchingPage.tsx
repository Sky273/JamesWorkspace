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


  // State
  const [missions, setMissions] = useState<Mission[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [results, setResults] = useState<ProfileMatchingResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  
  // Detailed analysis state
  const [analyzingProfile, setAnalyzingProfile] = useState<string | null>(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState<Record<string, DetailedProfileAnalysisResponse>>({});

  // Search options
  const [limit, setLimit] = useState(0); // 0 = all CVs
  const [minScore, setMinScore] = useState(0);
  const [weights, setWeights] = useState<ProfileMatchWeights>(DEFAULT_WEIGHTS);

  // Load missions and deals on mount
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
    loadData();
  }, [t]);

  // Filter missions by selected deal
  const filteredMissions = useMemo(() => {
    if (!selectedDealId) return missions;
    return missions.filter(m => m['Deal ID'] === selectedDealId);
  }, [missions, selectedDealId]);

  const selectedMission = useMemo(() => 
    filteredMissions.find(m => m.id === selectedMissionId),
    [filteredMissions, selectedMissionId]
  );

  // Auto-select first mission when filtered list changes
  useEffect(() => {
    if (filteredMissions.length > 0 && !filteredMissions.find(m => m.id === selectedMissionId)) {
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
        weights,
        dealId: selectedDealId || undefined
      });
      
      setResults(data);
      
      if (data.profiles.length === 0) {
        toast(t('profileMatching.noResults'), { icon: '🔍' });
      } else {
        const scannedCount = data.totalResumesScanned;
        const sentToLlmCount = data.profilesSentToLlm ?? scannedCount;
        const returnedCount = data.profiles.length;
        toast.success(`${scannedCount} CV analysés, ${sentToLlmCount} envoyés au LLM, ${returnedCount} résultats retournés`);
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
      // Re-run search to get fresh keywords
      if (results) {
        handleSearch();
      }
    } catch (error) {
      logger.error('Error refreshing keywords:', error);
      toast.error(t('profileMatching.errors.refreshKeywords'));
    }
  };

  const handleDetailedAnalysis = async (resumeId: string) => {
    if (!selectedMissionId) return;
    
    // Check if already analyzed
    if (detailedAnalysis[resumeId]) {
      setExpandedProfile(resumeId);
      return;
    }
    
    try {
      setAnalyzingProfile(resumeId);
      const result = await analyzeProfileForMission(selectedMissionId, resumeId);
      setDetailedAnalysis(prev => ({ ...prev, [resumeId]: result }));
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
        {categories.map(cat => cat.items && cat.items.length > 0 && (
          <div key={cat.key}>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{cat.label}:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {cat.items.map((item, idx) => (
                <span key={idx} className={`text-xs px-2 py-0.5 rounded-full ${cat.color}`}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Check if any loading state is active
  const isProcessing = loading || analyzingProfile !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-6xl mx-auto relative"
    >
      {/* Polished overlay during processing */}
      <AnimatePresence>
        {isProcessing && (
          <ProfileMatchingOverlay mode={loading ? 'searching' : 'analyzing'} />
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            {t('profileMatching.title')}
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
          {t('profileMatching.subtitle')}
        </p>
      </div>

      {/* Search Panel */}
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

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Mission keywords */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-yellow-500" />
              {t('profileMatching.extractedKeywords')}
            </h2>
            {renderKeywordsBadges(results.missionKeywords)}
            <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <p>
                {t('profileMatching.scannedResumes', { count: results.totalResumesScanned })}
              </p>
              <p>
                {results.profilesSentToLlm ?? results.totalResumesScanned} envoyés au LLM
                {typeof results.profilesExplained === 'number'
                  ? ` - ${results.profilesExplained} expliqués`
                  : ''}
              </p>
              <p>
                {results.profiles.length} retournés
              </p>
            </div>
          </div>

          {/* Profile list */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-blue-500" />
              {t('profileMatching.results')} ({results.profiles.length})
            </h2>
            
            {results.profiles.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">{t('profileMatching.noProfilesFound')}</p>
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
          </div>
        </div>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t('profileMatching.emptyState.title')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {t('profileMatching.emptyState.description')}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default ProfileMatchingPage;
