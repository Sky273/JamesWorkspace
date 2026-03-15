/**
 * PipelineCompleteModal - Complete interview with outcome modal
 * Extracted from PipelineTab.tsx
 */

import { useTranslation } from 'react-i18next';

interface InterviewOutcomeForm {
  outcome: string;
  outcomeNotes: string;
}

interface PipelineCompleteModalProps {
  interviewOutcome: InterviewOutcomeForm;
  setInterviewOutcome: (v: InterviewOutcomeForm) => void;
  onComplete: () => void;
  onClose: () => void;
}

export default function PipelineCompleteModal({
  interviewOutcome,
  setInterviewOutcome,
  onComplete,
  onClose
}: PipelineCompleteModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('pipeline.completeInterviewTitle')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.outcome')} *
            </label>
            <select
              value={interviewOutcome.outcome}
              onChange={(e) => setInterviewOutcome({ ...interviewOutcome, outcome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('pipeline.selectOutcome')}</option>
              <option value="positive">{t('pipeline.outcomes.positive')}</option>
              <option value="neutral">{t('pipeline.outcomes.neutral')}</option>
              <option value="negative">{t('pipeline.outcomes.negative')}</option>
              <option value="to_follow_up">{t('pipeline.outcomes.toFollowUp')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.outcomeNotes')}
            </label>
            <textarea
              value={interviewOutcome.outcomeNotes}
              onChange={(e) => setInterviewOutcome({ ...interviewOutcome, outcomeNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder={t('pipeline.outcomeNotesPlaceholder')}
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
            onClick={onComplete}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {t('pipeline.complete')}
          </button>
        </div>
      </div>
    </div>
  );
}
