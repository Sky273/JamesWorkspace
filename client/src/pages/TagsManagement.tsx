/**
 * TagsManagement Page
 * TypeScript version
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { tagService } from '../utils/tagService';
import { motion } from 'framer-motion';
import logger from '../utils/logger.frontend';
import {
  WrenchScrewdriverIcon,
  BriefcaseIcon,
  SparklesIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import type { CategoryConfig, CleanedTags, EditingTag, EscoTagItem, EscoTags, TabType, Tags } from '../components/TagsManagement/types';
import TagsStatsGrid from '../components/TagsManagement/TagsStatsGrid';
import TagsToolbar from '../components/TagsManagement/TagsToolbar';
import TagsDescriptionBanner from '../components/TagsManagement/TagsDescriptionBanner';
import TagsCategoryGrid from '../components/TagsManagement/TagsCategoryGrid';
import TagEditModal from '../components/TagsManagement/TagEditModal';

const categoryConfig: Record<string, CategoryConfig> = {
  'Skills': { 
    icon: SparklesIcon, color: 'blue',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-600 dark:text-blue-400',
    tagBg: 'bg-blue-50 dark:bg-blue-900/20', tagText: 'text-blue-700 dark:text-blue-300', tagBorder: 'border-blue-200 dark:border-blue-800'
  },
  'Industries': { 
    icon: BriefcaseIcon, color: 'green',
    bgLight: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-600 dark:text-green-400',
    tagBg: 'bg-green-50 dark:bg-green-900/20', tagText: 'text-green-700 dark:text-green-300', tagBorder: 'border-green-200 dark:border-green-800'
  },
  'Tools': { 
    icon: WrenchScrewdriverIcon, color: 'purple',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-600 dark:text-purple-400',
    tagBg: 'bg-purple-50 dark:bg-purple-900/20', tagText: 'text-purple-700 dark:text-purple-300', tagBorder: 'border-purple-200 dark:border-purple-800'
  },
  'Soft Skills': { 
    icon: HeartIcon, color: 'rose',
    bgLight: 'bg-rose-100 dark:bg-rose-900/30', textColor: 'text-rose-600 dark:text-rose-400',
    tagBg: 'bg-rose-50 dark:bg-rose-900/20', tagText: 'text-rose-700 dark:text-rose-300', tagBorder: 'border-rose-200 dark:border-rose-800'
  }
};

// Known compound tags that should be split
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

/**
 * Clean and split a single tag
 * - lowercase
 * - trim
 * - split on /, ,, ;, | (NOT on spaces - keep multi-word tags intact)
 * - detect compounds
 */
function cleanTag(tag: string): string[] {
  // Remove parentheses and their content or just the parentheses
  let normalized = tag.toLowerCase().trim();
  // Remove content in parentheses like "Python (3.x)" -> "Python"
  normalized = normalized.replace(/\s*\([^)]*\)/g, '');
  // Remove any remaining standalone parentheses
  normalized = normalized.replace(/[()]/g, '');
  normalized = normalized.trim();
  
  if (!normalized) return [];
  
  // Split on common separators (NOT on spaces - keep multi-word tags intact)
  const parts = normalized.split(/[/,;|]+/).map(p => p.trim()).filter(p => p.length > 0);
  
  const result: string[] = [];
  
  for (const part of parts) {
    // Check if this is a known compound that should be expanded
    const compoundKey = Object.keys(COMPOUND_TAGS).find(key => part === key || part.includes(key));
    if (compoundKey && COMPOUND_TAGS[compoundKey]) {
      result.push(...COMPOUND_TAGS[compoundKey]);
    } else {
      // Keep the tag as-is (preserve spaces in multi-word tags)
      result.push(part);
    }
  }
  
  return [...new Set(result)]; // Remove duplicates
}

/**
 * Clean all tags in a category
 * @param tags - Array of tags to clean
 * @param softClean - If true, only lowercase (for soft skills)
 */
function _cleanTagsForCategory(tags: string[], softClean = false): string[] {
  const allCleaned: string[] = [];
  
  for (const tag of tags) {
    if (softClean) {
      // Soft clean: lowercase, trim, split on separators but NOT on spaces
      const normalized = tag.toLowerCase().trim();
      if (!normalized) continue;
      // Split on /, ,, ;, | but keep spaces intact
      const parts = normalized.split(/[/,;|]+/).map(p => p.trim()).filter(p => p.length > 0);
      allCleaned.push(...parts);
    } else {
      const cleaned = cleanTag(tag);
      allCleaned.push(...cleaned);
    }
  }
  
  // Remove duplicates and sort
  return [...new Set(allCleaned)].sort();
}

const TagsManagement = (): JSX.Element => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tags>({});
  const [cleanedTags, setCleanedTags] = useState<CleanedTags>({});
  const [escoTags, setEscoTags] = useState<EscoTags>({ skills: [], industries: [], tools: [], softSkills: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [editingTag, setEditingTag] = useState<EditingTag | null>(null);
  const [newTagName, setNewTagName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('raw');
  const [savingCleanedTags, setSavingCleanedTags] = useState<boolean>(false);
  const [convertingToEsco, setConvertingToEsco] = useState<boolean>(false);

  const fetchTags = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      // Fetch raw tags, cleaned tags, and ESCO tags in parallel
      const [rawData, cleanedData, escoData] = await Promise.all([
        tagService.getAllTags(),
        tagService.getCleanedTags().catch(() => ({})),
        tagService.getEscoTags().catch(() => ({ skills: [], industries: [], tools: [], softSkills: [] }))
      ]);
      setTags(rawData as unknown as Tags);
      setCleanedTags(cleanedData as unknown as CleanedTags);
      setEscoTags(escoData as unknown as EscoTags);
    } catch (err) {
      toast.error(t('tags.loadError'));
      logger.error('Error loading tags:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void fetchTags(); }, [fetchTags]);

  // Display cleaned tags directly from server (no frontend cleaning logic)
  const displayCleanedTags = useMemo(() => {
    return cleanedTags;
  }, [cleanedTags]);

  // Recalculate cleaned tags from raw tags for all resumes
  const handleRecalculateCleanedTags = async (): Promise<void> => {
    try {
      setSavingCleanedTags(true);
      await tagService.recalculateCleanedTags();
      const freshCleanedTags = await tagService.getCleanedTags();
      setCleanedTags(freshCleanedTags as unknown as CleanedTags);
      toast.success(t('tags.cleanedTagsRecalculated'));
    } catch (err) {
      toast.error(t('tags.cleanedTagsRecalculateError'));
      logger.error('Error recalculating cleaned tags:', err);
    } finally {
      setSavingCleanedTags(false);
    }
  };

  // Recalculate ESCO tags from cleaned tags for all resumes
  const handleRecalculateEscoTags = async (): Promise<void> => {
    try {
      setConvertingToEsco(true);
      await tagService.recalculateEscoTags('fr');
      const freshEscoTags = await tagService.getEscoTags();
      setEscoTags(freshEscoTags as unknown as EscoTags);
      toast.success(t('tags.escoTagsRecalculated'));
    } catch (err) {
      toast.error(t('tags.escoTagsRecalculateError'));
      logger.error('Error recalculating ESCO tags:', err);
    } finally {
      setConvertingToEsco(false);
    }
  };

  const handleRenameTag = async (category: string, oldName: string, newName: string): Promise<void> => {
    if (oldName === newName) { closeEditModal(); return; }
    try {
      // Determine which field to update based on active tab
      const fieldSuffix = activeTab === 'cleaned' ? ' Cleaned' : '';
      const fieldName = category + fieldSuffix;
      
      await tagService.renameTag(fieldName, oldName, newName);
      toast.success(t('tags.renameSuccess', { oldName, newName }));
      
      // Update local state based on active tab
      if (activeTab === 'raw') {
        setTags(prevTags => ({
          ...prevTags,
          [category]: prevTags[category].map(tag => tag === oldName ? newName : tag)
        }));
      } else if (activeTab === 'cleaned') {
        setCleanedTags(prevTags => ({
          ...prevTags,
          [category]: prevTags[category]?.map(tag => tag === oldName ? newName : tag) || []
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
    const filtered = tagList.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length > 0 || !searchTerm) acc[category] = searchTerm ? filtered : tagList;
    return acc;
  }, {});

  const filteredCleanedTags = Object.entries(displayCleanedTags).reduce<CleanedTags>((acc, [category, tagList]) => {
    if (!tagList) return acc;
    const filtered = tagList.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length > 0 || !searchTerm) acc[category] = searchTerm ? filtered : tagList;
    return acc;
  }, {});

  // Map ESCO tags to display format with category names
  const escoTagsDisplay: Record<string, EscoTagItem[]> = {
    'Skills': escoTags.skills || [],
    'Industries': escoTags.industries || [],
    'Tools': escoTags.tools || [],
    'Soft Skills': escoTags.softSkills || []
  };

  const filteredEscoTags = Object.entries(escoTagsDisplay).reduce<Record<string, EscoTagItem[]>>((acc, [category, tagList]) => {
    if (!tagList) return acc;
    const filtered = tagList.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length > 0 || !searchTerm) acc[category] = searchTerm ? filtered : tagList;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6 max-w-7xl mx-auto">      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{t('tags.title')}</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{t('tags.subtitle')}</p>
      </div>

      <TagsStatsGrid tags={tags} totalTags={totalTags} categoryConfig={categoryConfig} t={t} />

      <TagsToolbar
        activeTab={activeTab}
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
        onRefresh={() => { void fetchTags(); }}
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
