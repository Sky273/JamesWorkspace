import { motion } from 'framer-motion';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import type {
  CategoryConfig,
  CleanedTags,
  EscoTagItem,
  TabType,
  Tags,
} from './types';

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
  t,
}: TagsCategoryGridProps): JSX.Element {
  const source = activeTab === 'raw' ? filteredTags : filteredCleanedTags;
  const rawCategoryEntries = Object.entries(source) as Array<[string, string[]]>;
  const escoCategoryEntries = Object.entries(filteredEscoTags) as Array<[string, EscoTagItem[]]>;
  const hasCategories =
    activeTab === 'esco' ? escoCategoryEntries.length > 0 : rawCategoryEntries.length > 0;

  if (!hasCategories) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-slate-300/80 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700/80 dark:bg-slate-900/30">
        <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          {t('tags.noTags')}
        </p>
      </div>
    );
  }
  const categoryEntries = activeTab === 'esco' ? escoCategoryEntries : rawCategoryEntries;

  if (categoryEntries.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-slate-300/80 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700/80 dark:bg-slate-900/30">
        <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          {t('tags.noTags')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {activeTab !== 'esco'
        ? rawCategoryEntries.map(([category, tagList], categoryIndex: number) => {
            const config = categoryConfig[category] || categoryConfig.Skills;
            const IconComponent = config.icon;
            const translatedCategory = t(`tags.categories.${category}`, {
              defaultValue: category,
            });
            const isCleanedTab = activeTab === 'cleaned';
            const borderClass = isCleanedTab
              ? 'border-green-200 dark:border-green-800'
              : 'border-gray-200 dark:border-gray-700';

            return (
              <motion.div
                key={`${activeTab}-${category}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.1 }}
                className={`tags-category-card rounded-[1.75rem] border bg-white/90 shadow-sm ${borderClass} dark:bg-slate-900/60`}
              >
                <div className={`flex items-center gap-3 border-b p-5 ${borderClass}`}>
                  <div className={`tags-icon-shell rounded-2xl p-2.5 ${config.bgLight}`}>
                    <IconComponent className={`h-5 w-5 ${config.textColor}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                      {translatedCategory}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tagList.length} {t('tags.tagsCount')}
                    </p>
                  </div>
                  {isCleanedTab && (
                    <span className="ml-auto rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      {t('tags.cleaned')}
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto p-5">
                  {tagList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tagList.map((tag: string, index: number) => (
                        <motion.div
                          key={`${activeTab}-${category}-${tag}-${index}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: Math.min(index * 0.01, 0.5) }}
                          className={`tags-chip group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:shadow-md ${config.tagBg} ${config.tagText} ${config.tagBorder}`}
                        >
                          <span>{tag}</span>
                          <button
                            onClick={() => onEditTag(category, tag)}
                            className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/50 dark:hover:bg-gray-700/50"
                            aria-label={t('tags.editTag')}
                            title={t('tags.editTag')}
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-slate-500 dark:text-slate-400">
                      {t('tags.noTags')}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        : escoCategoryEntries.map(([category, tagList], categoryIndex: number) => {
            const config = categoryConfig[category] || categoryConfig.Skills;
            const IconComponent = config.icon;
            const translatedCategory = t(`tags.categories.${category}`, {
              defaultValue: category,
            });
            const borderClass = 'border-indigo-200 dark:border-indigo-800';

            return (
              <motion.div
                key={`esco-${category}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: categoryIndex * 0.1 }}
                className={`tags-category-card rounded-[1.75rem] border bg-white/90 shadow-sm ${borderClass} dark:bg-slate-900/60`}
              >
                <div className={`flex items-center gap-3 border-b p-5 ${borderClass}`}>
                  <div className={`tags-icon-shell rounded-2xl p-2.5 ${config.bgLight}`}>
                    <IconComponent className={`h-5 w-5 ${config.textColor}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
                      {translatedCategory}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tagList.length} {t('tags.tagsCount')}
                    </p>
                  </div>
                  <span className="ml-auto rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    ESCO
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto p-5">
                  {tagList.length > 0 ? (
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
                          className={`tags-chip group inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-md ${config.tagBg} ${config.tagText} ${config.tagBorder}`}
                          title={t('tags.viewEscoDefinition')}
                        >
                          <span>{item.label}</span>
                          <svg
                            className="h-3 w-3 opacity-50 group-hover:opacity-100"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </motion.a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-slate-500 dark:text-slate-400">
                      {t('tags.noTags')}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
    </div>
  );
}
