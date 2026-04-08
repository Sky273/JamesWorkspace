/**
 * PipelineAddCandidateModal - Modal for adding a candidate to the pipeline
 */

import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, CheckCircleIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import SearchField from '../page/SearchField';
import type { CandidateOption } from './MissionPipelineKanban.types';

interface PipelineAddCandidateModalProps {
  availableCandidates: CandidateOption[];
  loadingResumes: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedCandidateId: string;
  setSelectedCandidateId: (v: string) => void;
  addNotes: string;
  setAddNotes: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--cv-primary)] focus:ring-4 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-950/50 dark:text-[var(--cv-text)] dark:focus:ring-blue-500/10';

const renderScore = (score?: number) => {
  if (!score) return null;
  const stars = Math.round(score / 20);

  return (
    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
      <span className="text-xs font-semibold">{score}%</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) =>
          i <= stars ? (
            <StarIconSolid key={i} className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <StarIcon key={i} className="h-3.5 w-3.5 text-amber-200 dark:text-amber-900/60" />
          )
        )}
      </div>
    </div>
  );
};

export default function PipelineAddCandidateModal({
  availableCandidates,
  loadingResumes,
  searchQuery,
  setSearchQuery,
  selectedCandidateId,
  setSelectedCandidateId,
  addNotes,
  setAddNotes,
  onAdd,
  onClose,
}: PipelineAddCandidateModalProps) {
  const { t } = useTranslation();

  const normalizedQuery = searchQuery.toLowerCase();
  const filteredCandidates = availableCandidates.filter(
    (candidate) =>
      candidate.name.toLowerCase().includes(normalizedQuery) ||
      (candidate.title || '').toLowerCase().includes(normalizedQuery)
  );

  const selectedCandidate = filteredCandidates.find((candidate) => candidate.id === selectedCandidateId)
    ?? availableCandidates.find((candidate) => candidate.id === selectedCandidateId)
    ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="cv-surface flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <div className="cv-kicker mb-2">Pipeline mission</div>
            <h3 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">{t('pipeline.addCandidate')}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {t('pipeline.searchCandidates')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
            aria-label={t('common.close', 'Fermer')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.4fr)_320px]">
          <section className="flex min-h-0 flex-col border-b border-slate-200/70 dark:border-white/10 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/10 sm:px-6">
              <SearchField
                containerClassName="relative"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('pipeline.searchCandidates')}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {loadingResumes ? (
                <div className="flex h-full min-h-[240px] items-center justify-center">
                  <ArrowPathIcon className="h-7 w-7 animate-spin text-[var(--cv-primary)]" />
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <MagnifyingGlassIcon className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-600 dark:text-[var(--cv-muted)]">
                    {t('pipeline.noCandidatesAvailable')}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredCandidates.map((candidate) => {
                    const isSelected = selectedCandidateId === candidate.id;

                    return (
                      <button
                        key={candidate.id}
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className={`w-full rounded-[1.5rem] border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-[var(--cv-primary)] bg-blue-50 shadow-[0_20px_40px_-28px_rgba(37,99,235,0.45)] dark:bg-blue-500/10'
                            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-[0_20px_40px_-30px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${isSelected ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-slate-950' : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'}`}>
                                {isSelected ? <CheckCircleIcon className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full bg-current" />}
                              </span>
                              <div className="truncate text-base font-semibold text-slate-900 dark:text-[var(--cv-text)]">{candidate.name}</div>
                              {candidate.hasMissionAdaptation ? (
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                  candidate.source === 'adaptation'
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20'
                                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20'
                                }`}>
                                  {candidate.source === 'adaptation' ? t('pipeline.adapted') : t('pipeline.original')}
                                </span>
                              ) : null}
                            </div>
                            {candidate.title ? (
                              <div className="mt-1 truncate text-sm text-slate-500 dark:text-[var(--cv-muted)]">{candidate.title}</div>
                            ) : null}
                          </div>
                          {renderScore(candidate.score)}
                        </div>

                        {candidate.tags && candidate.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {candidate.tags.slice(0, 6).map((tag, idx) => (
                              <span
                                key={`${candidate.id}-${tag}-${idx}`}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/5 dark:text-[var(--cv-muted)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4 bg-slate-50/60 px-5 py-5 dark:bg-white/[0.03] sm:px-6">
            <div>
              <div className="cv-kicker mb-2">Sélection</div>
              <h4 className="text-base font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                {selectedCandidate ? selectedCandidate.name : t('pipeline.selectCandidate')}
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                {selectedCandidate?.title || t('pipeline.selectCandidateHelp')}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('pipeline.notes')} ({t('common.optional')})
              </label>
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                rows={8}
                className={fieldClassName}
                placeholder={t('pipeline.notesPlaceholder')}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                Ajoutez quelques repères utiles pour la suite du pipeline : contexte, points d'attention, prochaine action.
              </p>
            </div>
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onAdd}
            disabled={!selectedCandidateId}
            className="cv-gradient-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('pipeline.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
