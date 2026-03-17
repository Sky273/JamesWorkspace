/**
 * DPO Settings Tab
 * Configuration for Data Protection Officer contact information
 * Uses global settings form data (saved with main settings button)
 */

import { motion } from 'framer-motion';
import { 
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';

interface DpoTabProps {
  formData: {
    'DPO Name'?: string;
    'DPO Email'?: string;
    'DPO Phone'?: string;
    [key: string]: string | number | boolean | undefined;
  };
  onInputChange: (field: string, value: string | number | boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export const DpoTab = ({ formData, onInputChange, t }: DpoTabProps): JSX.Element => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <UserCircleIcon className="w-6 h-6 text-blue-600" />
          {t('settings.dpo.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('settings.dpo.description')}
        </p>
      </div>

      {/* DPO Contact Information */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6"
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <UserCircleIcon className="w-5 h-5" />
          {t('settings.dpo.dpoSection')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.dpo.dpoName')}
            </label>
            <div className="relative">
              <UserCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData['DPO Name'] || ''}
                onChange={(e) => onInputChange('DPO Name', e.target.value)}
                placeholder={t('settings.dpo.dpoNamePlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.dpo.dpoEmail')}
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData['DPO Email'] || ''}
                onChange={(e) => onInputChange('DPO Email', e.target.value)}
                placeholder="dpo@example.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.dpo.dpoPhone')}
            </label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData['DPO Phone'] || ''}
                onChange={(e) => onInputChange('DPO Phone', e.target.value)}
                placeholder="+33 1 23 45 67 89"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
      >
        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
          {t('settings.dpo.infoTitle')}
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          {t('settings.dpo.infoContent')}
        </p>
      </motion.div>
    </div>
  );
};

export default DpoTab;
