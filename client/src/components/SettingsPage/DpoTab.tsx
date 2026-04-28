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
import InputWithLeadingIcon from '../form/InputWithLeadingIcon';

interface DpoTabProps {
  formData: {
    'DPO Name'?: string;
    'DPO Email'?: string;
    'DPO Phone'?: string;
    [key: string]: string | number | boolean | undefined | Record<string, Record<string, Record<string, string | number>>>;
  };
  onInputChange: (field: string, value: string | number | boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export const DpoTab = ({ formData, onInputChange, t }: DpoTabProps): JSX.Element => {
  const inputClassName = 'mb-0 w-full rounded-[9px] border border-[#dedbe8] bg-white py-2.5 pl-12 pr-4 text-sm text-[var(--cv-text)] placeholder:text-[#8f8a9d] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100 dark:placeholder:text-gray-500';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-[var(--cv-text)]">
          <UserCircleIcon className="h-5 w-5 text-[#6246ea] dark:text-[#c9ccff]" />
          {t('settings.dpo.title')}
        </h2>
        <p className="text-sm text-[var(--cv-muted)]">
          {t('settings.dpo.description')}
        </p>
      </div>

      {/* DPO Contact Information */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]"
      >
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--cv-text)]">
          <UserCircleIcon className="h-4 w-4 text-[#6246ea] dark:text-[#c9ccff]" />
          {t('settings.dpo.dpoSection')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--cv-muted)]">
              {t('settings.dpo.dpoName')}
            </label>
            <InputWithLeadingIcon
              icon={UserCircleIcon}
              type="text"
              value={formData['DPO Name'] || ''}
              onChange={(e) => onInputChange('DPO Name', e.target.value)}
              placeholder={t('settings.dpo.dpoNamePlaceholder')}
              inputClassName={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--cv-muted)]">
              {t('settings.dpo.dpoEmail')}
            </label>
            <InputWithLeadingIcon
              icon={EnvelopeIcon}
              type="email"
              value={formData['DPO Email'] || ''}
              onChange={(e) => onInputChange('DPO Email', e.target.value)}
              placeholder={t('settings.dpo.emailPlaceholder')}
              inputClassName={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--cv-muted)]">
              {t('settings.dpo.dpoPhone')}
            </label>
            <InputWithLeadingIcon
              icon={PhoneIcon}
              type="tel"
              value={formData['DPO Phone'] || ''}
              onChange={(e) => onInputChange('DPO Phone', e.target.value)}
              placeholder={t('settings.dpo.phonePlaceholder')}
              inputClassName={inputClassName}
            />
          </div>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]"
      >
        <h4 className="mb-2 font-semibold text-[var(--cv-text)]">
          {t('settings.dpo.infoTitle')}
        </h4>
        <p className="text-sm text-[var(--cv-muted)]">
          {t('settings.dpo.infoContent')}
        </p>
      </motion.div>
    </div>
  );
};

export default DpoTab;
