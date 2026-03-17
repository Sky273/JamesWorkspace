/**
 * Weights Configuration Tab for Settings Page
 * TypeScript version
 */

import { ChangeEvent } from 'react';

interface FormData {
  'Executive Summary Weight': number;
  'Skills Weight': number;
  'Experience Weight': number;
  'Education Weight': number;
  'ATS Weight': number;
  'Hobbies Languages Weight': number;
  [key: string]: string | number | boolean;
}

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
}

interface WeightsTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string) => void;
  totalWeight: number;
  t: (key: string) => string;
}

const WeightSlider = ({ label, value, onChange }: WeightSliderProps): JSX.Element => {
  const handleRangeChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value);
  };

  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min="0"
          max="50"
          value={value}
          onChange={handleRangeChange}
          className="flex-1"
        />
        <input
          type="number"
          min="0"
          max="100"
          value={value}
          onChange={handleNumberChange}
          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <span className="text-gray-600 dark:text-gray-400">%</span>
      </div>
    </div>
  );
};

const WeightsTab = ({ formData, onInputChange, totalWeight, t }: WeightsTabProps): JSX.Element => {
  const weights: Array<{ key: string; label: string }> = [
    { key: 'Executive Summary Weight', label: t('settings.weights.executiveSummary') },
    { key: 'Skills Weight', label: t('settings.weights.skills') },
    { key: 'Experience Weight', label: t('settings.weights.experience') },
    { key: 'Education Weight', label: t('settings.weights.education') },
    { key: 'ATS Weight', label: t('settings.weights.ats') },
    { key: 'Hobbies Languages Weight', label: t('settings.weights.hobbiesLanguages') }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {weights.map(({ key, label }) => (
          <WeightSlider
            key={key}
            label={label}
            value={formData[key] as number}
            onChange={(value) => onInputChange(key, value)}
          />
        ))}
      </div>

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
            {t('settings.weights.mustEqual100')}
          </p>
        )}
      </div>
    </div>
  );
};

export default WeightsTab;
