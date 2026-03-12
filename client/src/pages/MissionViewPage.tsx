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
  TagIcon
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
}

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

    loadMission();
  }, [id, authGet, t]);

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/missions');
    }
  };

  const handleEdit = () => {
    // Navigate to missions page with edit state
    navigate('/missions', { state: { editMissionId: id } });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'Draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatMissionDate = (dateString?: string) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return formatDate(dateString, 'long', locale) || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {t('errors.missionNotFound')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {error || t('errors.missionNotFoundDescription')}
              </p>
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                {t('common.back')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Parse keywords if available
  let keywords: { skills?: string[]; tools?: string[]; industries?: string[]; softSkills?: string[] } | null = null;
  if (mission.Keywords) {
    try {
      keywords = JSON.parse(mission.Keywords);
    } catch {
      keywords = null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            {t('common.back')}
          </button>
        </motion.div>

        {/* Mission content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <BriefcaseIcon className="w-8 h-8 text-blue-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mission.Title || t('missions.noTitle')}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {mission.Customer && (
                    <span className="flex items-center gap-1">
                      <BuildingOfficeIcon className="w-4 h-4" />
                      {mission.Customer}
                    </span>
                  )}
                  {mission['Created At'] && (
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {formatMissionDate(mission['Created At'])}
                    </span>
                  )}
                  {mission.Status && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(mission.Status)}`}>
                      {t(`missions.status.${mission.Status.toLowerCase()}`)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PencilSquareIcon className="w-4 h-4" />
                {t('common.edit')}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('missions.description')}
            </h2>
            {mission.Content ? (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={createSafeHtml(mission.Content)}
              />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">
                {t('missions.noDescription')}
              </p>
            )}
          </div>

          {/* Keywords section */}
          {keywords && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TagIcon className="w-5 h-5" />
                {t('missions.extractedKeywords')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keywords.skills && keywords.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profileMatching.categories.skills')}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {keywords.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {keywords.tools && keywords.tools.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profileMatching.categories.tools')}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {keywords.tools.map((tool, idx) => (
                        <span key={idx} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {keywords.industries && keywords.industries.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profileMatching.categories.industries')}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {keywords.industries.map((industry, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs">
                          {industry}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {keywords.softSkills && keywords.softSkills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('profileMatching.categories.softSkills')}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {keywords.softSkills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Pipeline Kanban */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <MissionPipelineKanban
            missionId={id!}
            missionTitle={mission.Title || t('missions.noTitle')}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default MissionViewPage;
