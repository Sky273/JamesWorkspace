import { motion } from 'framer-motion';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import type { CategoryConfig, CleanedTags, EscoTagItem, TabType, Tags } from './types';

interface TagsCategoryGridProps {
  activeTab: TabType;
  filteredTags: Tags;
  filteredCleanedTags: CleanedTags;
  filteredEscoTags: Record<string, EscoTagItem[]>;
  categoryConfig: Record<string, CategoryConfig>;
  onEditTag: (category: string, tag: string) => void;
  t: (key: string, options?: { defaultValue?: string }) => string;
}

export default function TagsCategoryGrid({
  activeTab,
  filteredTags,
  filteredCleanedTags,
  filteredEscoTags,
  categoryConfig,
  onEditTag,
  t
}: TagsCategoryGridProps): JSX.Element {
  const source = activeTab === 'raw' ? filteredTags : filteredCleanedTags;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {activeTab !== 'esco' && Object.entries(source).map(([category, tagList], categoryIndex) => {
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
                  {t('tags.cleaned')}
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
                      <button onClick={() => onEditTag(category, tag)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded" title={t('tags.editTag')}>
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
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
              <span className="ml-auto px-2 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">ESCO</span>
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
                      title={t('tags.viewEscoDefinition')}
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
  );
}
