import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  DocumentTextIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { sanitizeHtml } from '../../utils/sanitizer.frontend';
import logger from '../../utils/logger.frontend';
import { parsePreviewImprovements } from './resumePreview.helpers';

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

export default function ResumePreviewPanel({ resumeId, onClose, onOpenFull }: ResumePreviewPanelProps) {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResumePreviewData | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
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

  const status = (data?.Status || '').toLowerCase();
  const isImproved = status === 'improved' || Boolean(data?.['Improved Text']) || Boolean(data?.['Improved Global Rating']);
  const htmlContent = isImproved ? (data?.['Improved Text'] || data?.['Original Text'] || '') : (data?.['Original Text'] || '');
  const score = isImproved ? (data?.['Improved Global Rating'] || data?.['Global Rating']) : data?.['Global Rating'];
  const summary = data?.Summary;
  const improvements = isImproved
    ? parsePreviewImprovements(data?.['Improved Key Improvements'] || data?.['Key Improvements'])
    : parsePreviewImprovements(data?.['Key Improvements']);

  const scoreColor = (s: number) =>
    s >= 80 ? 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]' :
    s >= 60 ? 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]' :
    'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)]';

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-t border-slate-200/70 dark:border-white/6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-50/90 p-4 dark:bg-white/[0.025] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="cv-kicker flex items-center gap-2">
              <SparklesIcon className="h-4 w-4" />
              {t('resumes.preview.title')}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isImproved ? (
                <span className="rounded-full bg-[var(--cv-tertiary-soft)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--cv-tertiary)]">
                  {t('resumes.preview.improved')}
                </span>
              ) : status === 'analyzed' ? (
                <span className="rounded-full bg-[var(--cv-primary-soft)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--cv-primary)]">
                  {t('resumes.preview.analyzed')}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenFull(resumeId); }}
              className="cv-ghost-button inline-flex items-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-medium"
              title={t('resumes.preview.openFull')}
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              {t('resumes.preview.openFull')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="cv-ghost-button rounded-[0.95rem] p-2.5"
              title={t('common.close')}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[var(--cv-primary)]" />
            <span className="ml-3 text-sm text-slate-500 dark:text-[#8f99b8]">{t('common.loading')}</span>
          </div>
        ) : null}

        {error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--cv-danger)]">{error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchedRef.current = false;
                setError(null);
                setLoading(true);
                setData(null);
              }}
              className="mt-2 text-xs font-medium text-[var(--cv-primary)] hover:underline"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {!loading && !error && data ? (
          <div className="mt-4 space-y-4">
            {(score != null || summary) ? (
              <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
                {score != null ? (
                  <div className={`rounded-[1rem] px-4 py-3 text-sm font-bold ${scoreColor(score)}`}>
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="h-4 w-4" />
                      {score}%
                    </div>
                  </div>
                ) : null}
                {summary ? (
                  <div className="rounded-[1rem] border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-white/6 dark:bg-white/[0.03] dark:text-[#a3aac4]">
                    {summary}
                  </div>
                ) : null}
              </div>
            ) : null}

            {improvements.length > 0 ? (
              <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/6 dark:bg-white/[0.03]">
                <h5 className="cv-subsection-title mb-2">{t('resumes.preview.keyImprovements')}</h5>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-[#a3aac4]">
                  {improvements.slice(0, 3).map((imp, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--cv-tertiary)]">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                  {improvements.length > 3 ? (
                    <li className="pl-4 text-xs italic text-slate-400 dark:text-[#7f8ab0]">+{improvements.length - 3} {t('resumes.more')}</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {htmlContent ? (
              <div className="max-h-80 overflow-y-auto rounded-[1.2rem] border border-slate-200/70 bg-white p-4 shadow-inner dark:border-white/6 dark:bg-[#0b1328]">
                <div
                  className="prose prose-sm max-w-none text-xs leading-relaxed dark:prose-invert [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_li]:mb-0.5 [&_p]:mb-1.5 [&_ul]:mb-1.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }}
                />
              </div>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-slate-300 px-4 py-10 text-center dark:border-white/10">
                <DocumentTextIcon className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-[#7f8ab0]" />
                <p className="text-sm text-slate-500 dark:text-[#a3aac4]">{t('resumes.preview.noContent')}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
