/**
 * TagsManagement Page
 * TypeScript version
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { tagService } from '../utils/tagService';
import { motion } from 'framer-motion';
import PageHeader from '../components/page/PageHeader';
import { useScopedViewRefresh } from '../hooks/useScopedViewRefresh';
import logger from '../utils/logger.frontend';
import { markViewScopesDirty } from '../utils/viewRefresh';
import {
  WrenchScrewdriverIcon,
  BriefcaseIcon,
  SparklesIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import type { CategoryConfig, CleanedTags, EditingTag, EscoTagItem, EscoTags, TabType, Tags } from '../components/TagsManagement/types';
import TagsStatsGrid from '../components/TagsManagement/TagsStatsGrid';
import TagsToolbar from '../components/TagsManagement/TagsToolbar';
import TagsDescriptionBanner from '../components/TagsManagement/TagsDescriptionBanner';
import TagsCategoryGrid from '../components/TagsManagement/TagsCategoryGrid';
import TagEditModal from '../components/TagsManagement/TagEditModal';
import { useAuth } from '../context/AuthContext';

const categoryConfig: Record<string, CategoryConfig> = {
  Skills: {
    icon: SparklesIcon, color: 'blue',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-600 dark:text-blue-400',
    tagBg: 'bg-blue-50 dark:bg-blue-900/20', tagText: 'text-blue-700 dark:text-blue-300', tagBorder: 'border-blue-200 dark:border-blue-800',
  },
  Industries: {
    icon: BriefcaseIcon, color: 'green',
    bgLight: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-600 dark:text-green-400',
    tagBg: 'bg-green-50 dark:bg-green-900/20', tagText: 'text-green-700 dark:text-green-300', tagBorder: 'border-green-200 dark:border-green-800',
  },
  Tools: {
    icon: WrenchScrewdriverIcon, color: 'purple',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-600 dark:text-purple-400',
    tagBg: 'bg-purple-50 dark:bg-purple-900/20', tagText: 'text-purple-700 dark:text-purple-300', tagBorder: 'border-purple-200 dark:border-purple-800',
  },
  'Soft Skills': {
    icon: HeartIcon, color: 'rose',
    bgLight: 'bg-rose-100 dark:bg-rose-900/30', textColor: 'text-rose-600 dark:text-rose-400',
    tagBg: 'bg-rose-50 dark:bg-rose-900/20', tagText: 'text-rose-700 dark:text-rose-300', tagBorder: 'border-rose-200 dark:border-rose-800',
  },
};

const COMPOUND_TAGS: Record<string, string[]> = {
  'java spring': ['java', 'spring'],
  'java springboot': ['java', 'spring boot'],
  'spring boot': ['spring', 'boot'],
  'node.js express': ['node.js', 'express'],
  'react redux': ['react', 'redux'],
  'angular typescript': ['angular', 'typescript'],
  'python django': ['python', 'django'],
  'python flask': ['python', 'flask'],
  'vue.js vuex': ['vue.js', 'vuex'],
  'docker kubernetes': ['docker', 'kubernetes'],
  'aws azure': ['aws', 'azure'],
  'html css': ['html', 'css'],
  'html css javascript': ['html', 'css', 'javascript'],
  'sql nosql': ['sql', 'nosql'],
  'git github': ['git', 'github'],
  'ci cd': ['ci/cd'],
  'machine learning': ['machine learning'],
  'deep learning': ['deep learning'],
  'data science': ['data science'],
  'project management': ['project management'],
  'agile scrum': ['agile', 'scrum'],
};

function cleanTag(tag: string): string[] {
  let normalized = tag.toLowerCase().trim();
  normalized = normalized.replace(/\s*\([^)]*\)/g, '');
  normalized = normalized.replace(/[()]/g, '');
  normalized = normalized.trim();

  if (!normalized) return [];

  const parts = normalized.split(/[/,;|]+/).map((part) => part.trim()).filter((part) => part.length > 0);

  const result: string[] = [];

  for (const part of parts) {
    const compoundKey = Object.keys(COMPOUND_TAGS).find((key) => part === key || part.includes(key));
    if (compoundKey && COMPOUND_TAGS[compoundKey]) {
      result.push(...COMPOUND_TAGS[compoundKey]);
    } else {
      result.push(part);
    }
  }

  return [...new Set(result)];
}

function _cleanTagsForCategory(tags: string[], softClean = false): string[] {
  const allCleaned: string[] = [];

  for (const tag of tags) {
    if (softClean) {
      const normalized = tag.toLowerCase().trim();
      if (!normalized) continue;
      const parts = normalized.split(/[/,;|]+/).map((part) => part.trim()).filter((part) => part.length > 0);
      allCleaned.push(...parts);
    } else {
      const cleaned = cleanTag(tag);
      allCleaned.push(...cleaned);
    }
  }

  return [...new Set(allCleaned)].sort();
}

const TagsManagement = (): JSX.Element => {
  const refreshConsumerId = 'tags-management';
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const [tags, setTags] = useState<Tags>({});
  const [cleanedTags, setCleanedTags] = useState<CleanedTags>({});
  const [escoTags, setEscoTags] = useState<EscoTags>({ skills: [], industries: [], tools: [], softSkills: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [editingTag, setEditingTag] = useState<EditingTag | null>(null);
  const [newTagName, setNewTagName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('raw');
  const [savingCleanedTags, setSavingCleanedTags] = useState<boolean>(false);
  const [convertingToEsco, setConvertingToEsco] = useState<boolean>(false);
  const tagsRequestIdRef = useRef(0);

  const fetchTags = useCallback(async (forceRefresh = false): Promise<void> => {
    const requestId = ++tagsRequestIdRef.current;
    try {
      setLoading(true);
      setLoadError(false);
      const [rawData, cleanedData, escoData] = await Promise.all([
        tagService.getAllTags(forceRefresh),
        tagService.getCleanedTags(forceRefresh).catch(() => ({})),
        tagService.getEscoTags(forceRefresh).catch(() => ({ skills: [], industries: [], tools: [], softSkills: [] })),
      ]);
      if (requestId !== tagsRequestIdRef.current) {
        return;
      }
      setTags(rawData as unknown as Tags);
      setCleanedTags(cleanedData as unknown as CleanedTags);
      setEscoTags(escoData as unknown as EscoTags);
    } catch (err) {
      if (requestId !== tagsRequestIdRef.current) {
        return;
      }
      setLoadError(true);
      toast.error(t('tags.loadError'));
      logger.error('Error loading tags:', err);
    } finally {
      if (requestId === tagsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => { void fetchTags(); }, [fetchTags]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['tags'],
    onRefresh: () => {
      void fetchTags(true);
    },
  });

  const displayCleanedTags = useMemo(() => cleanedTags, [cleanedTags]);

  const handleRecalculateCleanedTags = async (): Promise<void> => {
    try {
      setSavingCleanedTags(true);
      await tagService.recalculateCleanedTags();
      tagsRequestIdRef.current += 1;
      const freshCleanedTags = await tagService.getCleanedTags(true);
      setCleanedTags(freshCleanedTags as unknown as CleanedTags);
      markViewScopesDirty(['tags']);
      toast.success(t('tags.cleanedTagsRecalculated'));
    } catch (err) {
      toast.error(t('tags.cleanedTagsRecalculateError'));
      logger.error('Error recalculating cleaned tags:', err);
    } finally {
      setSavingCleanedTags(false);
    }
  };

  const handleRecalculateEscoTags = async (): Promise<void> => {
    try {
      setConvertingToEsco(true);
      await tagService.recalculateEscoTags('fr');
      tagsRequestIdRef.current += 1;
      const freshEscoTags = await tagService.getEscoTags(true);
      setEscoTags(freshEscoTags as unknown as EscoTags);
      markViewScopesDirty(['tags']);
      toast.success(t('tags.escoTagsRecalculated'));
    } catch (err) {
      toast.error(t('tags.escoTagsRecalculateError'));
      logger.error('Error recalculating ESCO tags:', err);
    } finally {
      setConvertingToEsco(false);
    }
  };

  const handleRenameTag = async (category: string, oldName: string, newName: string): Promise<void> => {
    if (oldName === newName) {
      closeEditModal();
      return;
    }
    try {
      const fieldSuffix = activeTab === 'cleaned' ? ' Cleaned' : '';
      const fieldName = category + fieldSuffix;

      await tagService.renameTag(fieldName, oldName, newName);
      tagsRequestIdRef.current += 1;
      markViewScopesDirty(['tags']);
      toast.success(t('tags.renameSuccess', { oldName, newName }));

      if (activeTab === 'raw') {
        setTags((prevTags) => ({
          ...prevTags,
          [category]: prevTags[category].map((tag) => (tag === oldName ? newName : tag)),
        }));
      } else if (activeTab === 'cleaned') {
        setCleanedTags((prevTags) => ({
          ...prevTags,
          [category]: prevTags[category]?.map((tag) => (tag === oldName ? newName : tag)) || [],
        }));
      }
    } catch (err) {
      toast.error(t('tags.renameError'));
      logger.error('Error renaming tag:', err);
    }
  };

  const openEditModal = (category: string, tag: string): void => {
    setEditingTag({ category, tag });
    setNewTagName(tag);
  };

  const closeEditModal = (): void => {
    setEditingTag(null);
    setNewTagName('');
  };

  const handleEditConfirm = async (): Promise<void> => {
    if (editingTag && newTagName.trim()) {
      await handleRenameTag(editingTag.category, editingTag.tag, newTagName.trim());
      closeEditModal();
    }
  };

  const totalTags = Object.values(tags).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const totalCleanedTags = Object.values(displayCleanedTags).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const totalEscoTags = Object.values(escoTags).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  const filteredTags = Object.entries(tags).reduce<Tags>((acc, [category, tagList]) => {
    if (!tagList) return acc;
    const filtered = tagList.filter((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length > 0 || !searchTerm) acc[category] = searchTerm ? filtered : tagList;
    return acc;
  }, {});

  const filteredCleanedTags = Object.entries(displayCleanedTags).reduce<CleanedTags>((acc, [category, tagList]) => {
    if (!tagList) return acc;
    const filtered = tagList.filter((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length > 0 || !searchTerm) acc[category] = searchTerm ? filtered : tagList;
    return acc;
  }, {});

  const escoTagsDisplay: Record<string, EscoTagItem[]> = {
    Skills: escoTags.skills || [],
    Industries: escoTags.industries || [],
    Tools: escoTags.tools || [],
    'Soft Skills': escoTags.softSkills || [],
  };

  const filteredEscoTags = Object.entries(escoTagsDisplay).reduce<Record<string, EscoTagItem[]>>((acc, [category, tagList]) => {
    if (!tagList) return acc;
    const filtered = tagList.filter((item) => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length > 0 || !searchTerm) acc[category] = searchTerm ? filtered : tagList;
    return acc;
  }, {});

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="cv-surface app-page-shell max-w-6xl"
      >
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-primary-500" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-8 w-72 max-w-full animate-pulse rounded-full bg-gray-200/80 dark:bg-gray-700/70" />
                <div className="mt-3 h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-700/60" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="cv-surface app-page-shell max-w-6xl"
    >
      <PageHeader title={t('tags.title')} subtitle={t('tags.subtitle')} />

      <div className="space-y-6">
        {loadError && (
          <div className="section-shell rounded-[2rem] border border-amber-200/70 bg-amber-50/80 p-4 dark:border-amber-800/70 dark:bg-amber-900/15">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-amber-500" />
                <p className="text-sm text-amber-800 dark:text-amber-200">{t('tags.loadError')}</p>
              </div>
              <button
                type="button"
                onClick={() => { void fetchTags(true); }}
                className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
              >
                {t('tags.refresh')}
              </button>
            </div>
          </div>
        )}

        <div className="section-shell rounded-[2rem] p-6">
          <TagsStatsGrid tags={tags} totalTags={totalTags} categoryConfig={categoryConfig} t={t} />
        </div>

        <div className="section-shell rounded-[2rem] p-6">
          <TagsToolbar
            activeTab={activeTab}
            canRunAdminRecalculations={isSuperAdmin}
            searchTerm={searchTerm}
            totalTags={totalTags}
            totalCleanedTags={totalCleanedTags}
            totalEscoTags={totalEscoTags}
            savingCleanedTags={savingCleanedTags}
            convertingToEsco={convertingToEsco}
            onTabChange={setActiveTab}
            onSearchChange={setSearchTerm}
            onRecalculateCleanedTags={handleRecalculateCleanedTags}
            onRecalculateEscoTags={handleRecalculateEscoTags}
            onRefresh={() => { void fetchTags(true); }}
            t={t}
          />

          <TagsDescriptionBanner activeTab={activeTab} t={t} />

          <TagsCategoryGrid
            activeTab={activeTab}
            filteredTags={filteredTags}
            filteredCleanedTags={filteredCleanedTags}
            filteredEscoTags={filteredEscoTags}
            categoryConfig={categoryConfig}
            onEditTag={openEditModal}
            t={t}
          />
        </div>
      </div>

      <TagEditModal
        editingTag={editingTag}
        newTagName={newTagName}
        onClose={closeEditModal}
        onChange={setNewTagName}
        onConfirm={() => { void handleEditConfirm(); }}
        t={t}
      />
    </motion.div>
  );
};

export default TagsManagement;
