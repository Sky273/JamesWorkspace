/**
 * PipelineNotesModal - Modal for editing pipeline entry notes
 */

import { useTranslation } from 'react-i18next';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { PipelineEntry } from '../../services/pipelineService';

interface PipelineNotesModalProps {
  entry: PipelineEntry;
  editNotes: string;
  setEditNotes: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--cv-primary)] focus:ring-4 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-950/50 dark:text-[var(--cv-text)] dark:focus:ring-blue-500/10';

export default function PipelineNotesModal({
  entry,
  editNotes,
  setEditNotes,
  onSave,
  onClose,
}: PipelineNotesModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="cv-surface flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <div className="cv-kicker mb-2">Pipeline mission</div>
            <h3 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">{t('pipeline.editNotes')}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">{entry.resume_name}</p>
          </div>
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
            aria-label={t('common.close', 'Fermer')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="mb-4 rounded-[1.35rem] bg-slate-50/80 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:text-[var(--cv-muted)] dark:ring-white/10">
            <div className="mb-2 inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-[var(--cv-text)]">
              <ChatBubbleLeftRightIcon className="h-4.5 w-4.5" />
              Notes pipeline
            </div>
            <p>Conservez ici les éléments de contexte utiles pour les prochaines actions, arbitrages ou relances.</p>
          </div>

          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={10}
            className={fieldClassName}
            placeholder={t('pipeline.notesPlaceholder')}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            className="cv-gradient-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
