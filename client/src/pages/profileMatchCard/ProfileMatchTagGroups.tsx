import {
  AcademicCapIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  HeartIcon,
  WrenchScrewdriverIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ProfileMatchResult } from '../../types/entities';

interface ProfileMatchTagGroupsProps {
  title: string;
  icon: 'matched' | 'missing';
  tags: NonNullable<ProfileMatchResult['matchedTags']> | NonNullable<ProfileMatchResult['missingTags']>;
  t: TFunction;
}

const CATEGORY_CONFIG = [
  {
    key: 'skills',
    icon: AcademicCapIcon,
    labelKey: 'profileMatching.categories.skills',
    textClass: 'text-blue-600 dark:text-blue-400'
  },
  {
    key: 'tools',
    icon: WrenchScrewdriverIcon,
    labelKey: 'profileMatching.categories.tools',
    textClass: 'text-green-600 dark:text-green-400'
  },
  {
    key: 'industries',
    icon: BuildingOfficeIcon,
    labelKey: 'profileMatching.categories.industries',
    textClass: 'text-purple-600 dark:text-purple-400'
  },
  {
    key: 'softSkills',
    icon: HeartIcon,
    labelKey: 'profileMatching.categories.softSkills',
    textClass: 'text-yellow-600 dark:text-yellow-400'
  }
] as const;

const getBadgeClass = (variant: 'matched' | 'missing') =>
  variant === 'matched'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';

const getHeaderIcon = (variant: 'matched' | 'missing') =>
  variant === 'matched' ? CheckCircleIcon : XCircleIcon;

const getHeaderColor = (variant: 'matched' | 'missing') =>
  variant === 'matched' ? 'text-green-500' : 'text-red-500';

export default function ProfileMatchTagGroups({ title, icon, tags, t }: ProfileMatchTagGroupsProps) {
  const HeaderIcon = getHeaderIcon(icon);
  const badgeClass = getBadgeClass(icon);
  const headerColor = getHeaderColor(icon);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <HeaderIcon className={`w-4 h-4 ${headerColor}`} />
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CATEGORY_CONFIG.map(({ key, icon: CategoryIcon, labelKey, textClass }) => {
          const categoryTags = tags[key];

          return (
            <div key={key} className="space-y-1">
              <span className={`text-xs font-medium flex items-center gap-1 ${textClass}`}>
                <CategoryIcon className="w-3 h-3" />
                {t(labelKey)}
              </span>
              <div className="flex flex-wrap gap-1">
                {categoryTags.length > 0 ? (
                  categoryTags.map((tag, idx) => (
                    <span key={idx} className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
