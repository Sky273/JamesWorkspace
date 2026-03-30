/**
 * PipelineAddCandidateModal - Modal for adding a resume to the pipeline
 * Extracted from MissionPipelineKanban.tsx
 */

import { useTranslation } from 'react-i18next';
import {
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import SearchField from '../page/SearchField';

interface Resume {
  id: string;
  Name: string;
  Title?: string;
  'Global Score'?: number;
  Tags?: string[];
}

interface PipelineAddCandidateModalProps {
  availableResumes: Resume[];
  loadingResumes: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedResumeId: string;
  setSelectedResumeId: (v: string) => void;
  addNotes: string;
  setAddNotes: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

const renderScore = (score?: number) => {
  if (!score) return null;
  const stars = Math.round(score / 20); // Convert 0-100 to 0-5 stars
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        i <= stars ? (
          <StarIconSolid key={i} className="w-3 h-3 text-yellow-400" />
        ) : (
          <StarIcon key={i} className="w-3 h-3 text-gray-300 dark:text-gray-600" />
        )
      ))}
    </div>
  );
};

export default function PipelineAddCandidateModal({
  availableResumes,
  loadingResumes,
  searchQuery,
  setSearchQuery,
  selectedResumeId,
  setSelectedResumeId,
  addNotes,
  setAddNotes,
  onAdd,
  onClose
}: PipelineAddCandidateModalProps) {
  const { t } = useTranslation();

  const filteredResumes = availableResumes.filter(r => 
    r.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.Title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('pipeline.addCandidate')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SearchField
            containerClassName="relative"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('pipeline.searchResumes')}
          />
        </div>

        {/* Resume List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingResumes ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : filteredResumes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('pipeline.noResumesAvailable')}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResumes.map(resume => (
                <button
                  key={resume.id}
                  onClick={() => setSelectedResumeId(resume.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedResumeId === resume.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {resume.Name}
                      </div>
                      {resume.Title && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {resume.Title}
                        </div>
                      )}
                    </div>
                    {renderScore(resume['Global Score'])}
                  </div>
                  {resume.Tags && resume.Tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {resume.Tags.slice(0, 5).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.notes')} ({t('common.optional')})
          </label>
          <textarea
            value={addNotes}
            onChange={(e) => setAddNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            placeholder={t('pipeline.notesPlaceholder')}
          />
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onAdd}
            disabled={!selectedResumeId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('pipeline.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
