/**
 * Skills and Tags Tab Component
 * TypeScript version
 * 
 * Display priority: ESCO tags (with links) > Cleaned tags > Raw tags
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

interface EscoTagItem {
  label: string;
  uri: string;
}

interface Resume {
  Skills?: string | string[];
  Tools?: string | string[];
  Industries?: string | string[];
  'Soft Skills'?: string | string[];
  // Cleaned tags (with underscore from backend)
  'Skills_cleaned'?: string | string[];
  'Tools_cleaned'?: string | string[];
  'Industries_cleaned'?: string | string[];
  'Soft Skills_cleaned'?: string | string[];
  // ESCO tags (with underscore from backend)
  'Skills_esco'?: string | EscoTagItem[];
  'Tools_esco'?: string | EscoTagItem[];
  'Industries_esco'?: string | EscoTagItem[];
  'Soft Skills_esco'?: string | EscoTagItem[];
  [key: string]: unknown;
}

interface SkillsTagsTabProps {
  resume: Resume;
}

type TagSource = 'esco' | 'cleaned' | 'raw';

interface TagData {
  tags: string[] | EscoTagItem[];
  source: TagSource;
}

const CATEGORY_STYLES: Record<string, string> = {
  'Technical Skills': "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  'Tools': "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  'Industries': "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  'Soft Skills': "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
};

const SOURCE_BADGES: Record<TagSource, { label: string; className: string }> = {
  'esco': { label: 'ESCO', className: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
  'cleaned': { label: 'Nettoyé', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  'raw': { label: 'Brut', className: 'bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400' }
};

const SkillsTagsTab = ({ resume }: SkillsTagsTabProps): JSX.Element => {
  const { t } = useTranslation();

  const parseFieldValue = useCallback((value: unknown): string[] | EscoTagItem[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [value];
      }
    }
    return [];
  }, []);

  const isEscoTagArray = (tags: string[] | EscoTagItem[]): tags is EscoTagItem[] => {
    return tags.length > 0 && typeof tags[0] === 'object' && 'uri' in tags[0];
  };

  const getTagsWithFallback = useCallback((baseField: string): TagData => {
    if (!resume) return { tags: [], source: 'raw' };

    // Priority 1: Cleaned tags
    const cleanedTags = parseFieldValue(resume[`${baseField}_cleaned`]);
    if (cleanedTags.length > 0) {
      return { tags: cleanedTags as string[], source: 'cleaned' };
    }

    // Priority 2: Raw tags
    const rawTags = parseFieldValue(resume[baseField]);
    return { tags: rawTags as string[], source: 'raw' };
  }, [resume, parseFieldValue]);

  const skillsAndTags = useMemo((): Record<string, TagData> => {
    return {
      'Technical Skills': getTagsWithFallback('Skills'),
      'Tools': getTagsWithFallback('Tools'),
      'Industries': getTagsWithFallback('Industries'),
      'Soft Skills': getTagsWithFallback('Soft Skills')
    };
  }, [getTagsWithFallback]);

  return (
    <div className="space-y-6">
      {Object.entries(skillsAndTags).map(([category, { tags, source }]) => (
        <div key={category} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t(`resume.analysis.categories.${category.toLowerCase().replace(/\s+/g, '')}`)}
            </h3>
            {tags.length > 0 && (
              <span className={classNames("px-2 py-0.5 text-xs font-medium rounded", SOURCE_BADGES[source].className)}>
                {SOURCE_BADGES[source].label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.length > 0 ? (
              source === 'esco' && isEscoTagArray(tags) ? (
                // ESCO tags with links
                tags.map((tag, index) => (
                  <a
                    key={`${category}-${index}-${tag.uri}`}
                    href={tag.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-all hover:shadow-md hover:scale-105 cursor-pointer",
                      CATEGORY_STYLES[category]
                    )}
                    title={t('tags.viewEscoDefinition', { defaultValue: 'Voir la définition ESCO' })}
                  >
                    <span>{tag.label}</span>
                    <svg className="w-3 h-3 opacity-50 hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))
              ) : (
                // Cleaned or Raw tags (strings)
                (tags as string[]).map((tag, index) => (
                  <span
                    key={`${category}-${index}-${tag}`}
                    className={classNames("inline-flex items-center px-3 py-1 rounded-full text-sm font-medium", CATEGORY_STYLES[category])}
                  >
                    {tag}
                  </span>
                ))
              )
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('resume.analysis.noSkills', { category: category.toLowerCase() })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkillsTagsTab;
