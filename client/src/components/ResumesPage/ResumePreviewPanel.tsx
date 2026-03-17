/**
 * ResumePreviewPanel - Inline preview of a resume within the deals grouped view
 * Loads resume data on-demand when opened (lazy fetch).
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { sanitizeHtml } from '../../utils/sanitizer.frontend';
import logger from '../../utils/logger.frontend';

interface ResumePreviewData {
  id: string;
  'Improved Text'?: string;
  'Original Text'?: string;
  Summary?: string;
  'Global Rating'?: number;
  'Improved Global Rating'?: number;
  'Key Improvements'?: string | string[];
  'Improved Key Improvements'?: string | string[];
  Skills?: string | string[];
  Status?: string;
  Name?: string;
  Title?: string;
  'Experience Years'?: string | number;
  'Education Level'?: string;
}

interface ResumePreviewPanelProps {
  resumeId: string;
  onClose: () => void;
  onOpenFull: (resumeId: string) => void;
}

/** Parse a JSON-or-array field into string[] */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

export default function ResumePreviewPanel({ resumeId, onClose, onOpenFull }: ResumePreviewPanelProps) {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResumePreviewData | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once per mount
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await authGet(`/api/resumes/${resumeId}`);
        if (!response.ok) throw new Error('Failed to fetch resume');
        const result = await response.json();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          logger.error('Error fetching resume preview:', err);
          setError(err instanceof Error ? err.message : 'Error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPreview();
    return () => { cancelled = true; };
  }, [resumeId, authGet]);

  // Show improved content only when the CV has actually been improved
  const status = (data?.Status || '').toLowerCase();
  const isImproved = status === 'improved';

  const htmlContent = isImproved
    ? (data?.['Improved Text'] || data?.['Original Text'] || '')
    : (data?.['Original Text'] || '');
  const score = isImproved
    ? (data?.['Improved Global Rating'] || data?.['Global Rating'])
    : data?.['Global Rating'];
  const summary = data?.Summary;

  const improvements = isImproved
    ? parseJsonArray(data?.['Improved Key Improvements'] || data?.['Key Improvements'])
    : parseJsonArray(data?.['Key Improvements']);

  const scoreColor = (s: number) =>
    s >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
    s >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-t border-gray-200 dark:border-gray-700"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              {t('resumes.preview.title', 'Aperçu du CV')}
            </span>
            {isImproved ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {t('resumes.preview.improved', 'Amélioré')}
              </span>
            ) : status === 'analyzed' ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t('resumes.preview.analyzed', 'Analysé')}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenFull(resumeId); }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title={t('resumes.preview.openFull', 'Ouvrir l\'analyse complète')}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              {t('resumes.preview.openFull', 'Analyse complète')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded"
              title={t('common.close', 'Fermer')}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {t('common.loading', 'Chargement...')}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchedRef.current = false;
                setError(null);
                setLoading(true);
                // Re-trigger effect by forcing re-render
                setData(null);
              }}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              {t('common.retry', 'Réessayer')}
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <div className="space-y-3">
            {/* Score + Summary row */}
            {(score != null || summary) && (
              <div className="flex items-start gap-3">
                {score != null && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold flex-shrink-0 ${scoreColor(score)}`}>
                    <ChartBarIcon className="w-4 h-4" />
                    {score}%
                  </div>
                )}
                {summary && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 flex-1">{summary}</p>
                )}
              </div>
            )}

            {/* Key improvements */}
            {improvements.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {t('resumes.preview.keyImprovements', 'Améliorations clés')}
                </h5>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                  {improvements.slice(0, 3).map((imp, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-green-500 flex-shrink-0 mt-px">✓</span>
                      <span className="line-clamp-1">{imp}</span>
                    </li>
                  ))}
                  {improvements.length > 3 && (
                    <li className="text-gray-400 dark:text-gray-500 italic pl-4">
                      +{improvements.length - 3} {t('resumes.more', 'de plus')}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* CV content preview */}
            {htmlContent ? (
              <div className="max-h-72 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-inner">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed
                    [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                    [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1.5
                    [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1
                    [&_p]:mb-1.5 [&_ul]:mb-1.5 [&_li]:mb-0.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }}
                />
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
                <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                {t('resumes.preview.noContent', 'Aucun contenu disponible')}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
