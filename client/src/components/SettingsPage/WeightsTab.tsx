import WeightGroupSection from './WeightGroupSection';

interface FormData {
  'Executive Summary Weight': number;
  'Skills Weight': number;
  'Experience Weight': number;
  'Education Weight': number;
  'ATS Weight': number;
  'Hobbies Languages Weight': number;
  'Profile Matching Local Skill Weight': number;
  'Profile Matching Local Tool Weight': number;
  'Profile Matching Local Industry Weight': number;
  'Profile Matching Local Soft Skill Weight': number;
  'Profile Matching Local Title Exact Weight': number;
  'Profile Matching Local Title Token Weight': number;
  'Profile Matching Local Coverage Multiplier': number;
  [key: string]: string | number | boolean;
}

interface WeightsTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string) => void;
  totalWeight: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const WeightsTab = ({ formData, onInputChange, totalWeight, t }: WeightsTabProps): JSX.Element => {
  const weights: Array<{ key: string; label: string }> = [
    { key: 'Executive Summary Weight', label: t('settings.weights.executiveSummary') },
    { key: 'Skills Weight', label: t('settings.weights.skills') },
    { key: 'Experience Weight', label: t('settings.weights.experience') },
    { key: 'Education Weight', label: t('settings.weights.education') },
    { key: 'ATS Weight', label: t('settings.weights.ats') },
    { key: 'Hobbies Languages Weight', label: t('settings.weights.hobbiesLanguages') }
  ];

  const profileMatchingWeights: Array<{ key: string; label: string }> = [
    { key: 'Profile Matching Local Skill Weight', label: t('settings.weights.profileMatchingSkill') },
    { key: 'Profile Matching Local Tool Weight', label: t('settings.weights.profileMatchingTool') },
    { key: 'Profile Matching Local Industry Weight', label: t('settings.weights.profileMatchingIndustry') },
    { key: 'Profile Matching Local Soft Skill Weight', label: t('settings.weights.profileMatchingSoftSkill') },
    { key: 'Profile Matching Local Title Exact Weight', label: t('settings.weights.profileMatchingTitleExact') },
    { key: 'Profile Matching Local Title Token Weight', label: t('settings.weights.profileMatchingTitleToken') },
    { key: 'Profile Matching Local Coverage Multiplier', label: t('settings.weights.profileMatchingCoverage') }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('settings.weights.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.weights.description')}
        </p>
      </div>

      <WeightGroupSection
        weights={weights}
        formData={formData}
        onInputChange={onInputChange}
      />

      <div className={`p-4 rounded-lg ${
        totalWeight === 100
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`font-medium ${
            totalWeight === 100
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
          }`}>
            {t('settings.weights.total')}
          </span>
          <span className={`text-2xl font-bold ${
            totalWeight === 100
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {totalWeight}%
          </span>
        </div>
        {totalWeight !== 100 && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {t('settings.weights.totalMustEqualCurrent', { total: totalWeight })}
          </p>
        )}
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <WeightGroupSection
          title={t('settings.weights.localRankingTitle')}
          description={t('settings.weights.localRankingDescription')}
          weights={profileMatchingWeights}
          formData={formData}
          onInputChange={onInputChange}
        />
      </div>
    </div>
  );
};

export default WeightsTab;
