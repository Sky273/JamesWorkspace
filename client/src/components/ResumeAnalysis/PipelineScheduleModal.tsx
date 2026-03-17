/**
 * PipelineScheduleModal - Schedule interview form modal
 * Extracted from PipelineTab.tsx
 */

import { useTranslation } from 'react-i18next';

interface NewInterviewForm {
  title: string;
  description: string;
  interviewType: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string;
  meetingLink: string;
  attendees: { name: string; email: string }[];
}

interface PipelineScheduleModalProps {
  newInterview: NewInterviewForm;
  setNewInterview: (v: NewInterviewForm) => void;
  onSchedule: () => void;
  onClose: () => void;
}

export default function PipelineScheduleModal({
  newInterview,
  setNewInterview,
  onSchedule,
  onClose
}: PipelineScheduleModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('pipeline.scheduleInterviewTitle')}
        </h3>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.interviewTitle')} *
            </label>
            <input
              type="text"
              value={newInterview.title}
              onChange={(e) => setNewInterview({ ...newInterview, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder={t('pipeline.interviewTitlePlaceholder')}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.interviewType')}
            </label>
            <select
              value={newInterview.interviewType}
              onChange={(e) => setNewInterview({ ...newInterview, interviewType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="client">{t('pipeline.types.client')}</option>
              <option value="partner">{t('pipeline.types.partner')}</option>
              <option value="technical">{t('pipeline.types.technical')}</option>
              <option value="hr">{t('pipeline.types.hr')}</option>
            </select>
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.scheduledAt')} *
            </label>
            <input
              type="datetime-local"
              value={newInterview.scheduledAt}
              onChange={(e) => setNewInterview({ ...newInterview, scheduledAt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.duration')}
            </label>
            <select
              value={newInterview.durationMinutes}
              onChange={(e) => setNewInterview({ ...newInterview, durationMinutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1h</option>
              <option value={90}>1h30</option>
              <option value={120}>2h</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.location')}
            </label>
            <input
              type="text"
              value={newInterview.location}
              onChange={(e) => setNewInterview({ ...newInterview, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder={t('pipeline.locationPlaceholder')}
            />
          </div>

          {/* Meeting Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.meetingLink')}
            </label>
            <input
              type="url"
              value={newInterview.meetingLink}
              onChange={(e) => setNewInterview({ ...newInterview, meetingLink: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="https://meet.google.com/..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.interviewDescription')}
            </label>
            <textarea
              value={newInterview.description}
              onChange={(e) => setNewInterview({ ...newInterview, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder={t('pipeline.interviewDescriptionPlaceholder')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSchedule}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('pipeline.schedule')}
          </button>
        </div>
      </div>
    </div>
  );
}
