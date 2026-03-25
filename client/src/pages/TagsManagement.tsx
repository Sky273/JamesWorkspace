/**
 * TagsManagement Page
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent, KeyboardEvent, ForwardRefExoticComponent, RefAttributes, SVGProps, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { tagService } from '../utils/tagService';
import { motion } from 'framer-motion';
import logger from '../utils/logger.frontend';
import {
  TagIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
  BriefcaseIcon,
  SparklesIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  DocumentTextIcon,
  GlobeEuropeAfricaIcon
} from '@heroicons/react/24/outline';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface CategoryConfig {
  icon: HeroIcon;
  color: string;
  bgLight: string;
  textColor: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
}

interface Tags {
  [category: string]: string[];
}

interface EditingTag {
  category: string;
  tag: string;
}

interface CleanedTags {
  [category: string]: string[];
}

interface EscoTagItem {
  label: string;
  uri: string;
}

interface EscoTags {
  skills: EscoTagItem[];
  industries: EscoTagItem[];
  tools: EscoTagItem[];
  softSkills: EscoTagItem[];
}

type TabType = 'raw' | 'cleaned' | 'esco';

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

  const fetchTags = async (): Promise<void> => {
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
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTags(); }, []);

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
      toast.success(t('tags.cleanedTagsRecalculated', { defaultValue: 'Tags nettoyés recalculés avec succès' }));
    } catch (err) {
      toast.error(t('tags.cleanedTagsRecalculateError', { defaultValue: 'Erreur lors du recalcul des tags nettoyés' }));
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
      toast.success(t('tags.escoTagsRecalculated', { defaultValue: 'Tags ESCO recalculés avec succès' }));
    } catch (err) {
      toast.error(t('tags.escoTagsRecalculateError', { defaultValue: 'Erreur lors du recalcul des tags ESCO' }));
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

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><TagIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('tags.stats.totalTags')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalTags}</div></div>
          </div>
        </motion.div>
        {Object.entries(categoryConfig).map(([category, config], index) => {
          const IconComponent = config.icon;
          const count = tags[category]?.length || 0;
          return (
            <motion.div key={category} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * (index + 1) }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${config.bgLight} rounded-lg`}><IconComponent className={`w-6 h-6 ${config.textColor}`} /></div>
                <div><div className="text-sm text-gray-600 dark:text-gray-400">{category}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</div></div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('raw')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'raw'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5" />
              {t('tags.tabs.raw', { defaultValue: 'Tags bruts' })}
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {totalTags}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('cleaned')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cleaned'
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <BeakerIcon className="w-5 h-5" />
              {t('tags.tabs.cleaned', { defaultValue: 'Tags nettoyés' })}
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {totalCleanedTags}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('esco')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'esco'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <GlobeEuropeAfricaIcon className="w-5 h-5" />
              {t('tags.tabs.esco', { defaultValue: 'Tags ESCO' })}
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {totalEscoTags}
              </span>
            </button>
          </nav>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder={t('tags.searchPlaceholder')} value={searchTerm} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            {activeTab === 'cleaned' && (
              <button
                onClick={handleRecalculateCleanedTags}
                disabled={savingCleanedTags}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCleanedTags ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowPathIcon className="w-5 h-5" />
                )}
                {t('tags.recalculateCleanedTags', { defaultValue: 'Recalculer les tags nettoyés' })}
              </button>
            )}
            {activeTab === 'esco' && (
              <button
                onClick={handleRecalculateEscoTags}
                disabled={convertingToEsco}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {convertingToEsco ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <GlobeEuropeAfricaIcon className="w-5 h-5" />
                )}
                {t('tags.recalculateEscoTags', { defaultValue: 'Recalculer les tags ESCO' })}
              </button>
            )}
            <button onClick={fetchTags} className="btn btn-primary flex items-center gap-2 px-4 py-2">
              <ArrowPathIcon className="w-5 h-5" />{t('tags.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Tab description */}
      {activeTab === 'cleaned' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-700 dark:text-green-300">
            <strong>{t('tags.cleanedDescription.title', { defaultValue: 'Tags nettoyés :' })}</strong>{' '}
            {t('tags.cleanedDescription.text', { defaultValue: 'Les tags sont convertis en minuscules, découpés sur les séparateurs (/, ,, ;, |) et les composés sont détectés (ex: "Java Spring" → "java" + "spring").' })}
          </p>
        </div>
      )}
      {activeTab === 'esco' && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            <strong>{t('tags.escoDescription.title', { defaultValue: 'Tags ESCO :' })}</strong>{' '}
            {t('tags.escoDescription.text', { defaultValue: 'Les tags sont normalisés selon la classification européenne ESCO (European Skills, Competences, Qualifications and Occupations). Cliquez sur "Convertir en ESCO" pour mettre à jour.' })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Raw and Cleaned tabs */}
        {activeTab !== 'esco' && Object.entries(activeTab === 'raw' ? filteredTags : filteredCleanedTags).map(([category, tagList], categoryIndex) => {
          const config = categoryConfig[category] || categoryConfig['Skills'];
          const IconComponent = config.icon;
          const translatedCategory = t(`tags.categories.${category}`, { defaultValue: category });
          const isCleanedTab = activeTab === 'cleaned';
          const borderClass = isCleanedTab ? 'border-green-200 dark:border-green-800' : 'border-gray-200 dark:border-gray-700';
          return (
            <motion.div key={`${activeTab}-${category}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: categoryIndex * 0.1 }} className={`bg-white dark:bg-gray-800 rounded-lg shadow border ${borderClass}`}>
              <div className={`flex items-center gap-3 p-4 border-b ${borderClass}`}>
                <div className={`p-2 ${config.bgLight} rounded-lg`}><IconComponent className={`w-5 h-5 ${config.textColor}`} /></div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{translatedCategory}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{tagList?.length || 0} {t('tags.tagsCount')}</p>
                </div>
                {isCleanedTab && (
                  <span className="ml-auto px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                    {t('tags.cleaned', { defaultValue: 'Nettoyé' })}
                  </span>
                )}
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {tagList && tagList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tagList.map((tag: string, index: number) => (
                      <motion.div 
                        key={`${activeTab}-${category}-${tag}-${index}`} 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ delay: Math.min(index * 0.01, 0.5) }} 
                        className={`group inline-flex items-center gap-1 px-3 py-1.5 ${config.tagBg} ${config.tagText} ${config.tagBorder} border rounded-full text-sm font-medium transition-all hover:shadow-md`}
                      >
                        <span>{tag}</span>
                        {(activeTab === 'raw' || activeTab === 'cleaned') && (
                          <button onClick={() => openEditModal(category, tag)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded" title={t('tags.editTag')}>
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">{t('tags.noTags')}</p>
                )}
              </div>
            </motion.div>
          );
        })}
        {/* ESCO tab with links */}
        {activeTab === 'esco' && Object.entries(filteredEscoTags).map(([category, tagList], categoryIndex) => {
          const config = categoryConfig[category] || categoryConfig['Skills'];
          const IconComponent = config.icon;
          const translatedCategory = t(`tags.categories.${category}`, { defaultValue: category });
          const borderClass = 'border-indigo-200 dark:border-indigo-800';
          return (
            <motion.div key={`esco-${category}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: categoryIndex * 0.1 }} className={`bg-white dark:bg-gray-800 rounded-lg shadow border ${borderClass}`}>
              <div className={`flex items-center gap-3 p-4 border-b ${borderClass}`}>
                <div className={`p-2 ${config.bgLight} rounded-lg`}><IconComponent className={`w-5 h-5 ${config.textColor}`} /></div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{translatedCategory}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{tagList?.length || 0} {t('tags.tagsCount')}</p>
                </div>
                <span className="ml-auto px-2 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                  ESCO
                </span>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {tagList && tagList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tagList.map((item: EscoTagItem, index: number) => (
                      <motion.a 
                        key={`esco-${category}-${item.uri}-${index}`}
                        href={item.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ delay: Math.min(index * 0.01, 0.5) }} 
                        className={`group inline-flex items-center gap-1 px-3 py-1.5 ${config.tagBg} ${config.tagText} ${config.tagBorder} border rounded-full text-sm font-medium transition-all hover:shadow-md hover:scale-105 cursor-pointer`}
                        title={t('tags.viewEscoDefinition', { defaultValue: 'Voir la définition ESCO' })}
                      >
                        <span>{item.label}</span>
                        <svg className="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </motion.a>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">{t('tags.noTags')}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('tags.editTag')}</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('tags.editingIn')} <span className="font-medium">{editingTag.category}</span></p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tags.tagName')}</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 mb-4" value={newTagName} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTagName(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleEditConfirm()} autoFocus />
              <div className="flex justify-end gap-3">
                <button onClick={closeEditModal} className="btn btn-secondary px-4 py-2">{t('tags.cancel')}</button>
                <button onClick={handleEditConfirm} disabled={!newTagName.trim()} className={`btn btn-primary px-4 py-2 ${!newTagName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>{t('tags.save')}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default TagsManagement;
