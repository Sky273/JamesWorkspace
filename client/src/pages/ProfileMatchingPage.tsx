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
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  SparklesIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  HeartIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { useResume } from '../context/ResumeContext';
import { findMatchingProfiles, getMissions, clearMissionKeywordsCache, analyzeProfileForMission } from '../utils/profileMatchingService';
import type { 
  Mission, 
  ProfileMatchingResponse, 
  ProfileMatchResult,
  ProfileMatchWeights,
  MissionKeywords,
  DetailedProfileAnalysisResponse
} from '../types/entities';
import logger from '../utils/logger.frontend';

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

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-blue-600 dark:text-blue-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
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

  const renderProfileCard = (profile: ProfileMatchResult, index: number) => {
    const isExpanded = expandedProfile === profile.resumeId;

    return (
      <motion.div
        key={profile.resumeId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setExpandedProfile(isExpanded ? null : profile.resumeId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">
                  #{index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{profile.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profile.title || t('profileMatching.noTitle')}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`text-2xl font-bold ${getScoreColor(profile.matchScore)}`}>
                  {profile.matchScore}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('profileMatching.matchScore')}
                </div>
              </div>
              
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getScoreBgColor(profile.matchScore)} transition-all duration-500`}
              style={{ width: `${profile.matchScore}%` }}
            />
          </div>

          {/* Category scores summary */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1">
              <AcademicCapIcon className="w-3 h-3 text-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.skills')}:</span>
              <span className={getScoreColor(profile.categoryScores.skills)}>{profile.categoryScores.skills}%</span>
            </span>
            <span className="flex items-center gap-1">
              <WrenchScrewdriverIcon className="w-3 h-3 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.tools')}:</span>
              <span className={getScoreColor(profile.categoryScores.tools)}>{profile.categoryScores.tools}%</span>
            </span>
            <span className="flex items-center gap-1">
              <BuildingOfficeIcon className="w-3 h-3 text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.industries')}:</span>
              <span className={getScoreColor(profile.categoryScores.industries)}>{profile.categoryScores.industries}%</span>
            </span>
            <span className="flex items-center gap-1">
              <HeartIcon className="w-3 h-3 text-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.softSkills')}:</span>
              <span className={getScoreColor(profile.categoryScores.softSkills)}>{profile.categoryScores.softSkills}%</span>
            </span>
          </div>

          {/* Title adjustment indicator */}
          {profile.titleAdjustment !== undefined && profile.titleAdjustment !== 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${
                profile.titleAdjustment > 0 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              }`}>
                {t('profileMatching.titleAdjustment')}: {profile.titleAdjustment > 0 ? '+' : ''}{profile.titleAdjustment}
              </span>
              {profile.titleReason && (
                <span className="text-gray-500 dark:text-gray-400 italic truncate max-w-xs" title={profile.titleReason}>
                  {profile.titleReason}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-200 dark:border-gray-700"
            >
              <div className="p-4 space-y-4">
                {/* Matched tags by category */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    {t('profileMatching.matchedTags')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <AcademicCapIcon className="w-3 h-3" />
                        {t('profileMatching.categories.skills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.skills.length > 0 ? profile.matchedTags.skills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Tools */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <WrenchScrewdriverIcon className="w-3 h-3" />
                        {t('profileMatching.categories.tools')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.tools.length > 0 ? profile.matchedTags.tools.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Industries */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3" />
                        {t('profileMatching.categories.industries')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.industries.length > 0 ? profile.matchedTags.industries.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Soft Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <HeartIcon className="w-3 h-3" />
                        {t('profileMatching.categories.softSkills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.softSkills.length > 0 ? profile.matchedTags.softSkills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Missing tags by category */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                    {t('profileMatching.missingTags')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <AcademicCapIcon className="w-3 h-3" />
                        {t('profileMatching.categories.skills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.skills.length > 0 ? profile.missingTags.skills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Tools */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <WrenchScrewdriverIcon className="w-3 h-3" />
                        {t('profileMatching.categories.tools')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.tools.length > 0 ? profile.missingTags.tools.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Industries */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3" />
                        {t('profileMatching.categories.industries')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.industries.length > 0 ? profile.missingTags.industries.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Soft Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <HeartIcon className="w-3 h-3" />
                        {t('profileMatching.categories.softSkills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.softSkills.length > 0 ? profile.missingTags.softSkills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Analysis Results */}
                {detailedAnalysis[profile.resumeId] && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-purple-500" />
                        {t('profileMatching.detailedAnalysis.title')}
                      </h4>
                      <span className={`text-lg font-bold ${getScoreColor(detailedAnalysis[profile.resumeId].analysis.overallScore)}`}>
                        {detailedAnalysis[profile.resumeId].analysis.overallScore}%
                      </span>
                    </div>
                    
                    {/* Verdict */}
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{t('profileMatching.detailedAnalysis.verdict')}: </span>
                      <span className="text-gray-900 dark:text-white">{detailedAnalysis[profile.resumeId].analysis.verdict}</span>
                    </div>
                    
                    {/* Summary */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                      {detailedAnalysis[profile.resumeId].analysis.summary}
                    </p>
                    
                    {/* Strengths */}
                    {detailedAnalysis[profile.resumeId].analysis.strengths?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">
                          {t('profileMatching.detailedAnalysis.strengths')}
                        </h5>
                        <div className="space-y-1">
                          {detailedAnalysis[profile.resumeId].analysis.strengths.map((s, idx) => (
                            <div key={idx} className="text-xs bg-green-100 dark:bg-green-900/30 rounded p-2">
                              <span className="font-medium text-green-800 dark:text-green-300">{s.item}</span>
                              <span className="text-green-700 dark:text-green-400"> - {s.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Gaps */}
                    {detailedAnalysis[profile.resumeId].analysis.gaps?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
                          {t('profileMatching.detailedAnalysis.gaps')}
                        </h5>
                        <div className="space-y-1">
                          {detailedAnalysis[profile.resumeId].analysis.gaps.map((g, idx) => (
                            <div key={idx} className={`text-xs rounded p-2 ${
                              g.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                              g.severity === 'important' ? 'bg-orange-100 dark:bg-orange-900/30' :
                              'bg-yellow-100 dark:bg-yellow-900/30'
                            }`}>
                              <span className={`font-medium ${
                                g.severity === 'critical' ? 'text-red-800 dark:text-red-300' :
                                g.severity === 'important' ? 'text-orange-800 dark:text-orange-300' :
                                'text-yellow-800 dark:text-yellow-300'
                              }`}>{g.item}</span>
                              <span className={`${
                                g.severity === 'critical' ? 'text-red-700 dark:text-red-400' :
                                g.severity === 'important' ? 'text-orange-700 dark:text-orange-400' :
                                'text-yellow-700 dark:text-yellow-400'
                              }`}> - {g.explanation}</span>
                              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                                g.severity === 'critical' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                g.severity === 'important' ? 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                                'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                              }`}>{g.severity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Recommendations */}
                    {detailedAnalysis[profile.resumeId].analysis.recommendations?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                          {t('profileMatching.detailedAnalysis.recommendations')}
                        </h5>
                        <ul className="space-y-1">
                          {detailedAnalysis[profile.resumeId].analysis.recommendations.map((r, idx) => (
                            <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                r.type === 'highlight' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                r.type === 'develop' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                              }`}>{r.type}</span>
                              <span>{r.suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Interview Questions */}
                    {detailedAnalysis[profile.resumeId].analysis.interviewQuestions?.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">
                          {t('profileMatching.detailedAnalysis.interviewQuestions')}
                        </h5>
                        <ul className="list-disc list-inside space-y-1">
                          {detailedAnalysis[profile.resumeId].analysis.interviewQuestions.map((q, idx) => (
                            <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Risk Assessment */}
                    {detailedAnalysis[profile.resumeId].analysis.riskAssessment && (
                      <div className={`text-xs rounded p-2 ${
                        detailedAnalysis[profile.resumeId].analysis.riskAssessment.level === 'high' ? 'bg-red-100 dark:bg-red-900/30' :
                        detailedAnalysis[profile.resumeId].analysis.riskAssessment.level === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        <span className="font-medium">{t('profileMatching.detailedAnalysis.riskLevel')}: </span>
                        <span className={`font-bold ${
                          detailedAnalysis[profile.resumeId].analysis.riskAssessment.level === 'high' ? 'text-red-700 dark:text-red-400' :
                          detailedAnalysis[profile.resumeId].analysis.riskAssessment.level === 'medium' ? 'text-yellow-700 dark:text-yellow-400' :
                          'text-green-700 dark:text-green-400'
                        }`}>{detailedAnalysis[profile.resumeId].analysis.riskAssessment.level}</span>
                        {detailedAnalysis[profile.resumeId].analysis.riskAssessment.factors?.length > 0 && (
                          <span className="text-gray-600 dark:text-gray-400"> ({detailedAnalysis[profile.resumeId].analysis.riskAssessment.factors.join(', ')})</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {/* Only show analyze button if analysis not yet done */}
                  {!detailedAnalysis[profile.resumeId] && (
                    <button
                      onClick={() => handleDetailedAnalysis(profile.resumeId)}
                      disabled={analyzingProfile === profile.resumeId}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {analyzingProfile === profile.resumeId ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          {t('profileMatching.analyzing')}
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4" />
                          {t('profileMatching.analyzeProfile')}
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleViewResume(profile.resumeId)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <EyeIcon className="w-4 h-4" />
                    {t('profileMatching.viewResume')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="space-y-4">
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      min={1}
                      max={50}
                      value={limit}
                      onChange={(e) => setLimit(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              onClick={handleSearch}
              disabled={loading || !selectedMissionId || loadingMissions}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
            
            {results && (
              <button
                onClick={handleRefreshKeywords}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title={t('profileMatching.refreshKeywordsTooltip')}
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

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
                {results.profiles.map((profile, index) => renderProfileCard(profile, index))}
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
