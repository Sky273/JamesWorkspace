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
import { useResume } from '../context/ResumeContext';
import { findMatchingProfiles, getMissions, clearMissionKeywordsCache, analyzeProfileForMission } from '../utils/profileMatchingService';
import type { 
  Mission, 
  ProfileMatchingResponse, 
  ProfileMatchWeights,
  MissionKeywords,
  DetailedProfileAnalysisResponse
} from '../types/entities';
import logger from '../utils/logger.frontend';
import Breadcrumbs from '../components/Breadcrumbs';
import ProfileMatchCard from './ProfileMatchCard';
import ProfileMatchSearchPanel from './ProfileMatchSearchPanel';

const DEFAULT_WEIGHTS: ProfileMatchWeights = {
  skills: 40,
  tools: 25,
  industries: 20,
  softSkills: 15
};

const ProfileMatchingPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setCurrentResume, resumes } = useResume();

  // State
  const [missions, setMissions] = useState<Mission[]>([]);
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
  const [limit, setLimit] = useState(10);
  const [minScore, setMinScore] = useState(0);
  const [weights, setWeights] = useState<ProfileMatchWeights>(DEFAULT_WEIGHTS);

  // Load missions on mount
  useEffect(() => {
    const loadMissions = async () => {
      try {
        setLoadingMissions(true);
        const data = await getMissions();
        // Ensure data is always an array
        const missionsArray = Array.isArray(data) ? data : [];
        setMissions(missionsArray);
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
    loadMissions();
  }, [t]);

  const selectedMission = useMemo(() => 
    Array.isArray(missions) ? missions.find(m => m.id === selectedMissionId) : undefined,
    [missions, selectedMissionId]
  );

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
        toast(t('profileMatching.noResults'), { icon: '🔍' });
      } else {
        toast.success(t('profileMatching.resultsFound', { count: data.profiles.length }));
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
      {/* Blur overlay during processing */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-md mx-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {loading ? t('profileMatching.searchingProfiles') : t('profileMatching.analyzingProfile')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {loading 
                  ? t('profileMatching.searchingProfilesDescription')
                  : t('profileMatching.analyzingProfileDescription')
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Breadcrumbs className="mb-4" />
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <UserGroupIcon className="w-8 h-8 text-blue-600" />
          {t('profileMatching.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('profileMatching.subtitle')}
        </p>
      </div>

      {/* Search Panel */}
      <ProfileMatchSearchPanel
        missions={missions}
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-yellow-500" />
              {t('profileMatching.extractedKeywords')}
            </h2>
            {renderKeywordsBadges(results.missionKeywords)}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              {t('profileMatching.scannedResumes', { count: results.totalResumesScanned })}
            </p>
          </div>

          {/* Profile list */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
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
