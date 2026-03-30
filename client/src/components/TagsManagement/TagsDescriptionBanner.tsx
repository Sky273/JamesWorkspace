import type { TabType } from './types';

interface TagsDescriptionBannerProps {
  activeTab: TabType;
  t: (key: string) => string;
}

export default function TagsDescriptionBanner({ activeTab, t }: TagsDescriptionBannerProps): JSX.Element | null {
  if (activeTab === 'cleaned') {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-green-700 dark:text-green-300">
          <strong>{t('tags.cleanedDescription.title')}</strong>{' '}
          {t('tags.cleanedDescription.text')}
        </p>
      </div>
    );
  }

  if (activeTab === 'esco') {
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-indigo-700 dark:text-indigo-300">
          <strong>{t('tags.escoDescription.title')}</strong>{' '}
          {t('tags.escoDescription.text')}
        </p>
      </div>
    );
  }

  return null;
}
