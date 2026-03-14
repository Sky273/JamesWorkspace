/**
 * DealsGroupedView - Display resumes grouped by deal
 * Collapsible accordion sections for each deal + unassigned resumes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  CalendarIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  FolderOpenIcon,
  UserIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';
import { formatDate } from '../../utils/dateFormatter';
import { SkeletonResumeList } from '../ui/Skeleton';
import ConsentBadge, { ConsentStatus } from '../ConsentBadge';
import { ManageResumeDealsModal } from './index';

interface ResumeBasic {
  id: string;
  name: string;
  title?: string;
  status: string;
  global_rating?: number;
  improved_global_rating?: number;
  created_at: string;
  file_name?: string;
  firm_name?: string;
  candidate_name?: string;
  candidate_email?: string;
  consent_status?: string;
  consent_token_expires_at?: string;
  retention_until?: string;
  skills_cleaned?: string;
  industries_cleaned?: string;
  tools_cleaned?: string;
  soft_skills_cleaned?: string;
  skills?: string;
  industries?: string;
  tools?: string;
  soft_skills?: string;
  deal_added_at?: string;
  deal_resume_status?: string;
}

interface MissionAdaptation {
  id: string;
  resume_id: string;
  resume_name: string;
  candidate_name?: string;
  adapted_title?: string;
  match_score?: number;
  status: string;
  created_at: string;
}

interface DealMission {
  id: string;
  title: string;
  status: string;
  created_at: string;
  adaptations_count: number;
  adaptations: MissionAdaptation[];
}

interface DealGroup {
  id: string;
  title: string;
  status: string;
  priority: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  resumes_count: number;
  resumes: ResumeBasic[];
  missions: DealMission[];
}

interface GroupedData {
  deals: DealGroup[];
  unassigned: ResumeBasic[];
  totalDeals: number;
  totalAssigned: number;
  totalUnassigned: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
};

const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnée',
  lost: 'Perdue',
  on_hold: 'En attente'
};

const PRIORITY_ICONS: Record<string, { icon: string; color: string }> = {
  low: { icon: '○', color: 'text-gray-400' },
  medium: { icon: '●', color: 'text-blue-500' },
  high: { icon: '●●', color: 'text-orange-500' },
  urgent: { icon: '●●●', color: 'text-red-500' }
};

const tagColorMap: Record<string, string> = {
  skills: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  industries: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  tools: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  soft_skills: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
};

const DealsGroupedView = (): JSX.Element => {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const navigate = useNavigate();
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);

  // Drag & Drop state
  const [draggedResume, setDraggedResume] = useState<{ resumeId: string; sourceDealId: string | null } | null>(null);
  const [dragOverDealId, setDragOverDealId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const dragCounterRef = useRef<Record<string, number>>({});
  const isInitialLoadRef = useRef(true);

  const fetchGroupedData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authGet('/api/resumes/grouped-by-deal');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        // Auto-expand deals that have resumes only on first load
        if (isInitialLoadRef.current) {
          const dealsWithResumes = new Set<string>(
            result.deals.filter((d: DealGroup) => d.resumes.length > 0).map((d: DealGroup) => d.id)
          );
          setExpandedDeals(dealsWithResumes);
          isInitialLoadRef.current = false;
        }
      }
    } catch (error) {
      logger.error('Error fetching grouped resumes:', error);
    } finally {
      setLoading(false);
    }
  }, [authGet]);

  useEffect(() => {
    fetchGroupedData();
  }, [fetchGroupedData]);

  const toggleDeal = (dealId: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  // ============================================
  // DRAG & DROP HANDLERS
  // ============================================

  const handleDragStart = (e: React.DragEvent, resumeId: string, sourceDealId: string | null) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', resumeId);
    setDraggedResume({ resumeId, sourceDealId });
    // Capture the element reference before the async callback (React pools synthetic events)
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      if (el) el.style.opacity = '0.4';
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el) el.style.opacity = '1';
    setDraggedResume(null);
    setDragOverDealId(null);
    dragCounterRef.current = {};
  };

  const handleDragEnterDeal = (e: React.DragEvent, dealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragCounterRef.current[dealId]) dragCounterRef.current[dealId] = 0;
    dragCounterRef.current[dealId]++;
    // Don't highlight the source deal
    if (draggedResume && draggedResume.sourceDealId !== dealId) {
      setDragOverDealId(dealId);
    }
  };

  const handleDragLeaveDeal = (e: React.DragEvent, dealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragCounterRef.current[dealId]) dragCounterRef.current[dealId] = 0;
    dragCounterRef.current[dealId]--;
    if (dragCounterRef.current[dealId] <= 0) {
      dragCounterRef.current[dealId] = 0;
      if (dragOverDealId === dealId) {
        setDragOverDealId(null);
      }
    }
  };

  const handleDragOverDeal = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnDeal = async (e: React.DragEvent, targetDealId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDealId(null);
    dragCounterRef.current = {};

    if (!draggedResume || dropping) return;
    const { resumeId, sourceDealId } = draggedResume;
    
    // Don't drop on the same deal
    if (sourceDealId === targetDealId) {
      setDraggedResume(null);
      return;
    }

    setDropping(true);
    const toastId = toast.loading(t('resumes.groupedView.moving', 'Déplacement du CV...'));

    try {
      // 1. Add to target deal
      const addOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId })
      });
      const addResponse = await fetchWithAuth(`/api/deals/${targetDealId}/resumes`, addOptions);
      
      if (!addResponse.ok) {
        const error = await addResponse.json();
        throw new Error(error.error || 'Failed to add resume to deal');
      }

      // 2. Remove from source deal (if it was in one)
      if (sourceDealId) {
        const removeOptions = await createAuthOptionsWithCsrf({ method: 'DELETE' });
        const removeResponse = await fetchWithAuth(`/api/deals/${sourceDealId}/resumes/${resumeId}`, removeOptions);
        if (!removeResponse.ok) {
          logger.warn('Failed to remove resume from source deal, but it was added to target');
        }
      }

      // Find target deal name for toast
      const targetDeal = data?.deals.find(d => d.id === targetDealId);
      toast.success(
        sourceDealId 
          ? t('resumes.groupedView.moved', 'CV déplacé vers « {{deal}} »').replace('{{deal}}', targetDeal?.title || '')
          : t('resumes.groupedView.added', 'CV ajouté à « {{deal}} »').replace('{{deal}}', targetDeal?.title || ''),
        { id: toastId }
      );

      // Refresh data
      await fetchGroupedData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      logger.error('Drag & drop error:', error);
      toast.error(t('resumes.groupedView.dropError', 'Erreur lors du déplacement') + ': ' + msg, { id: toastId });
    } finally {
      setDropping(false);
      setDraggedResume(null);
    }
  };

  const handleResumeClick = (resumeId: string) => {
    navigate(`/resumes/${resumeId}/analysis`);
  };

  const handleDownload = async (resume: ResumeBasic, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await authGet(`/api/resumes/${resume.id}/download`);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resume.file_name || resume.name || 'resume';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading resume:', error);
    }
  };

  const parseTags = (value?: string): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
    } catch {
      return [];
    }
  };

  const renderResumeCard = (resume: ResumeBasic, sourceDealId: string | null) => {
    const rating = resume.improved_global_rating || resume.global_rating;
    const statusClass =
      resume.status === 'improved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
      resume.status === 'analyzed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
      resume.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

    const skills = parseTags(resume.skills_cleaned) || parseTags(resume.skills);
    const industries = parseTags(resume.industries_cleaned) || parseTags(resume.industries);
    const isDragging = draggedResume?.resumeId === resume.id;

    return (
      <motion.div
        key={resume.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        draggable={!dropping}
        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, resume.id, sourceDealId)}
        onDragEnd={(e) => handleDragEnd(e as unknown as React.DragEvent)}
        className={`bg-white dark:bg-gray-800 rounded-lg border hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
          isDragging
            ? 'border-purple-400 dark:border-purple-500 opacity-50'
            : 'border-gray-200 dark:border-gray-700'
        }`}
        onClick={() => handleResumeClick(resume.id)}
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {resume.name || t('resumes.untitled')}
                </h4>
              </div>
              {resume.title && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate pl-6">{resume.title}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {rating != null && (
                <span className="text-sm font-bold text-gray-900 dark:text-white">{rating}%</span>
              )}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                {t(`resumes.status.${resume.status || 'new'}`)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {formatDate(resume.created_at, 'medium')}
              </div>
              {resume.consent_status && (
                <ConsentBadge
                  status={resume.consent_status as ConsentStatus}
                  candidateName={resume.candidate_name}
                  candidateEmail={resume.candidate_email}
                  consentTokenExpiresAt={resume.consent_token_expires_at}
                  retentionUntil={resume.retention_until}
                  compact={true}
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex flex-wrap gap-1">
                {skills.map((tag, i) => (
                  <span key={`s-${i}`} className={`text-xs px-1.5 py-0.5 rounded-full ${tagColorMap.skills}`}>{tag}</span>
                ))}
                {industries.map((tag, i) => (
                  <span key={`i-${i}`} className={`text-xs px-1.5 py-0.5 rounded-full ${tagColorMap.industries}`}>{tag}</span>
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleResumeClick(resume.id); }}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded"
                title={t('resumes.view')}
              >
                <EyeIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleDownload(resume, e)}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded"
                title={t('resumes.downloadResume')}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
              </button>
              <div onClick={(e) => e.stopPropagation()}>
                <ManageResumeDealsModal resumeId={resume.id} onSuccess={fetchGroupedData} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return <SkeletonResumeList count={6} />;
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.errorLoading', 'Erreur lors du chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
        <div className="flex items-center gap-1.5">
          <BriefcaseIcon className="w-4 h-4" />
          <span><strong>{data.totalDeals}</strong> {t('resumes.groupedView.deals', 'affaires')}</span>
        </div>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <div className="flex items-center gap-1.5">
          <DocumentTextIcon className="w-4 h-4" />
          <span><strong>{data.totalAssigned}</strong> {t('resumes.groupedView.assigned', 'CVs affectés')}</span>
        </div>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <div className="flex items-center gap-1.5">
          <FolderOpenIcon className="w-4 h-4" />
          <span><strong>{data.totalUnassigned}</strong> {t('resumes.groupedView.unassigned', 'non affectés')}</span>
        </div>
      </div>

      {/* Deal sections */}
      {data.deals.map(deal => {
        const isExpanded = expandedDeals.has(deal.id);
        const priorityInfo = PRIORITY_ICONS[deal.priority] || PRIORITY_ICONS.medium;
        const isDragOver = dragOverDealId === deal.id;
        const isSourceDeal = draggedResume?.sourceDealId === deal.id;

        return (
          <div
            key={deal.id}
            className={`rounded-lg shadow overflow-hidden transition-all duration-200 ${
              isDragOver
                ? 'bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1'
                : isSourceDeal && draggedResume
                  ? 'bg-white dark:bg-gray-800 opacity-60'
                  : 'bg-white dark:bg-gray-800'
            }`}
            onDragEnter={(e) => handleDragEnterDeal(e, deal.id)}
            onDragLeave={(e) => handleDragLeaveDeal(e, deal.id)}
            onDragOver={handleDragOverDeal}
            onDrop={(e) => handleDropOnDeal(e, deal.id)}
          >
            {/* Deal header */}
            <button
              onClick={() => toggleDeal(deal.id)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left ${
                isDragOver
                  ? 'bg-purple-100/50 dark:bg-purple-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <BriefcaseIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{deal.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                      {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
                    </span>
                    <span className={`text-xs ${priorityInfo.color}`}>{priorityInfo.icon}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {deal.client_name && (
                      <span className="flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3" />
                        {deal.client_name}
                        {deal.client_type && <span className="text-gray-400">({deal.client_type})</span>}
                      </span>
                    )}
                    {deal.contact_name && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {deal.contact_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                {deal.missions && deal.missions.length > 0 && (
                  <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full text-sm font-medium">
                    {deal.missions.length} mission{deal.missions.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full text-sm font-medium">
                  {deal.resumes.length} CV{deal.resumes.length !== 1 ? 's' : ''}
                </span>
              </div>
            </button>

            {/* Drop indicator when dragging over collapsed deal */}
            {isDragOver && !isExpanded && (
              <div className="px-4 py-3 border-t border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/20">
                <p className="text-center text-sm text-purple-600 dark:text-purple-400 font-medium">
                  ↓ {t('resumes.groupedView.dropHere', 'Déposer ici pour ajouter à cette affaire')}
                </p>
              </div>
            )}

            {/* Deal resumes */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={`px-4 pb-4 border-t ${isDragOver ? 'border-purple-200 dark:border-purple-700' : 'border-gray-100 dark:border-gray-700'}`}>
                    {isDragOver && (
                      <div className="mt-3 mb-2 py-2 border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-lg bg-purple-50/50 dark:bg-purple-900/10">
                        <p className="text-center text-sm text-purple-500 dark:text-purple-400">
                          ↓ {t('resumes.groupedView.dropHere', 'Déposer ici pour ajouter à cette affaire')}
                        </p>
                      </div>
                    )}
                    {/* Missions section */}
                    {deal.missions && deal.missions.length > 0 && (
                      <div className="pt-3 mb-3">
                        <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BriefcaseIcon className="w-3.5 h-3.5" />
                          {t('resumes.groupedView.missions', 'Missions')} ({deal.missions.length})
                        </h4>
                        <div className="space-y-2">
                          {deal.missions.map(mission => (
                            <div key={mission.id} className="border border-indigo-100 dark:border-indigo-800/30 rounded-lg overflow-hidden">
                              {/* Mission header */}
                              <div
                                onClick={() => navigate(`/missions/${mission.id}`)}
                                className="flex items-center justify-between px-3 py-2 bg-indigo-50 dark:bg-indigo-900/10 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <BriefcaseIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{mission.title}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                    mission.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    mission.status === 'closed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  }`}>
                                    {t(`missions.status.${mission.status || 'active'}`, mission.status)}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                  {mission.adaptations_count || 0} {t('resumes.groupedView.adaptations', 'adaptation(s)')}
                                </span>
                              </div>
                              {/* Adaptations under this mission */}
                              {mission.adaptations && mission.adaptations.length > 0 && (
                                <div className="px-3 py-2 bg-white dark:bg-gray-800/50 space-y-1.5">
                                  {mission.adaptations.map(adaptation => {
                                    const scoreColor = (adaptation.match_score || 0) >= 80
                                      ? 'text-green-600 dark:text-green-400'
                                      : (adaptation.match_score || 0) >= 60
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-red-600 dark:text-red-400';
                                    const scoreBg = (adaptation.match_score || 0) >= 80
                                      ? 'bg-green-100 dark:bg-green-900/30'
                                      : (adaptation.match_score || 0) >= 60
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                      : 'bg-red-100 dark:bg-red-900/30';
                                    return (
                                      <div
                                        key={adaptation.id}
                                        onClick={(e) => { e.stopPropagation(); navigate(`/adaptations/${adaptation.id}`); }}
                                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-md cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <DocumentTextIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {adaptation.candidate_name || adaptation.resume_name || t('adaptations.card.noName', 'Sans nom')}
                                          </span>
                                          {adaptation.adapted_title && (
                                            <span className="text-xs text-blue-600 dark:text-blue-400 italic truncate max-w-[200px]">
                                              {adaptation.adapted_title}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {adaptation.match_score != null && (
                                            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${scoreBg} ${scoreColor}`}>
                                              <ChartBarIcon className="w-3 h-3" />
                                              {adaptation.match_score}%
                                            </span>
                                          )}
                                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                            adaptation.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            adaptation.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                          }`}>
                                            {t(`adaptations.status.${adaptation.status || 'completed'}`, adaptation.status)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resumes section */}
                    {deal.resumes.length === 0 && !isDragOver && (!deal.missions || deal.missions.length === 0) ? (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                        {t('resumes.groupedView.noResumes', 'Aucun CV associé à cette affaire')}
                      </p>
                    ) : deal.resumes.length > 0 ? (
                      <div className="space-y-2 pt-3">
                        {deal.resumes.length > 0 && deal.missions && deal.missions.length > 0 && (
                          <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            {t('resumes.groupedView.cvs', 'CVs')} ({deal.resumes.length})
                          </h4>
                        )}
                        {deal.resumes.map(resume => renderResumeCard(resume, deal.id))}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Empty deals message */}
      {data.deals.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <BriefcaseIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.noDeals', 'Aucune affaire créée')}</p>
        </div>
      )}

      {/* Unassigned resumes section */}
      {data.unassigned.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setUnassignedExpanded(!unassignedExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {unassignedExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              )}
              <FolderOpenIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                {t('resumes.groupedView.unassignedTitle', 'CVs non affectés à une affaire')}
              </h3>
            </div>
            <span className="ml-4 flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full text-sm font-medium">
              {data.unassigned.length} CV{data.unassigned.length !== 1 ? 's' : ''}
            </span>
          </button>

          <AnimatePresence>
            {unassignedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="space-y-2 pt-3">
                    {data.unassigned.map(resume => renderResumeCard(resume, null))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default DealsGroupedView;
