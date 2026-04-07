import type { TabType } from './types';

interface TagsDescriptionBannerProps {
  activeTab: TabType;
  t: (key: string) => string;
}

export default function TagsDescriptionBanner({
  activeTab,
  t,
}: TagsDescriptionBannerProps): JSX.Element | null {
  if (activeTab === 'cleaned') {
    return (
      <div className="section-shell mb-6 rounded-[2rem] border border-green-200/70 bg-green-50/80 p-5 dark:border-green-800/70 dark:bg-green-900/15">
        <p className="text-sm leading-6 text-green-700 dark:text-green-300">
          <strong>{t('tags.cleanedDescription.title')}</strong>{' '}
          {t('tags.cleanedDescription.text')}
        </p>
      </div>
    );
  }

  if (activeTab === 'esco') {
    return (
      <div className="section-shell mb-6 rounded-[2rem] border border-indigo-200/70 bg-indigo-50/80 p-5 dark:border-indigo-800/70 dark:bg-indigo-900/15">
        <p className="text-sm leading-6 text-indigo-700 dark:text-indigo-300">
          <strong>{t('tags.escoDescription.title')}</strong>{' '}
          {t('tags.escoDescription.text')}
        </p>
      </div>
    );
  }

  return null;
}
