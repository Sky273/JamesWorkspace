import { Link } from 'react-router-dom';
import {
  PlusIcon,
  UserIcon,
  CalendarDaysIcon,
  StarIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon,
  ArrowsRightLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type { PipelineEntry, PipelineStage } from '../../services/pipelineService';
import {
  getPipelineEntryAnalysisPath,
  getPipelineEntryBadge,
  getPipelineEntryDateLabel,
  getPipelineEntryDisplayName,
  getPipelineEntryInterviewCta,
  getPipelineEntryScore,
  getPipelineEntryTags,
  getStageEntrySummary,
} from './MissionPipelineKanban.view-model';

interface LoadingStateProps {
  loading: boolean;
}

interface KanbanHeaderProps {
  candidateCount: number;
  missionTitle: string;
  onAddCandidate: () => void;
  onRefresh: () => void;
  onClose?: () => void;
  title: string;
  candidatesLabel: string;
  addCandidateLabel: string;
  refreshLabel: string;
}

interface KanbanBoardTexts {
  interviews: string;
  manageInterviews: string;
  remove: string;
  scheduleInterview: string;
  unknownCandidate: string;
  viewResume: string;
  editNotes: string;
  dragAndDrop: string;
  stage: string;
  emptyNotes: string;
}

interface KanbanBoardProps {
  draggedEntry: PipelineEntry | null;
  dragOverStage: string | null;
  entries: PipelineEntry[];
  formatDate: (dateStr: string) => string;
  isEnglish: boolean;
  onDragEnd: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent, stageId: string) => void;
  onDragStart: (event: React.DragEvent, entry: PipelineEntry) => void;
  onDrop: (event: React.DragEvent, stageId: string) => void;
  onEditNotes: (entry: PipelineEntry) => void;
  onManageInterviews: (entry: PipelineEntry) => void;
  onRemove: (entry: PipelineEntry) => void;
  stages: PipelineStage[];
  texts: KanbanBoardTexts;
}

function renderScore(score?: number) {
  const scoreModel = getPipelineEntryScore(score);
  if (!scoreModel) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
      <span className="text-xs font-semibold">{scoreModel.value}%</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((index) =>
          index <= scoreModel.stars ? (
            <StarIconSolid key={index} className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <StarIcon key={index} className="h-3.5 w-3.5 text-amber-200 dark:text-amber-900/60" />
          )
        )}
      </div>
    </div>
  );
}

function CandidateCard({
  draggedEntry,
  entry,
  formatDate,
  onDragEnd,
  onDragStart,
  onEditNotes,
  onManageInterviews,
  onRemove,
  texts,
}: {
  draggedEntry: PipelineEntry | null;
  entry: PipelineEntry;
  formatDate: (dateStr: string) => string;
  onDragEnd: () => void;
  onDragStart: (event: React.DragEvent, entry: PipelineEntry) => void;
  onEditNotes: (entry: PipelineEntry) => void;
  onManageInterviews: (entry: PipelineEntry) => void;
  onRemove: (entry: PipelineEntry) => void;
  texts: KanbanBoardTexts;
}) {
  const badge = getPipelineEntryBadge(entry);
  const displayName = getPipelineEntryDisplayName(entry, texts.unknownCandidate);
  const { visibleTags, hiddenCount } = getPipelineEntryTags(entry);
  const interviewCta = getPipelineEntryInterviewCta(entry, formatDate, texts);
  const analysisPath = getPipelineEntryAnalysisPath(entry);
  const dateLabel = getPipelineEntryDateLabel(entry, formatDate);

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, entry)}
      onDragEnd={onDragEnd}
      className={`group rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 dark:border-white/10 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-start)_88%,black)] ${
        draggedEntry?.id === entry.id
          ? 'scale-[0.985] opacity-50'
          : 'hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_22px_50px_-28px_rgba(37,99,235,0.28)] dark:hover:border-white/15'
      }`}
    >
      <div className="mb-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-[var(--cv-muted)]">
            <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
            {texts.dragAndDrop}
          </div>
          {badge ? (
            <div className="mb-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          ) : null}
          <Link
            to={analysisPath}
            className="flex w-full min-w-0 flex-1 items-start gap-2 text-left text-sm font-semibold text-slate-900 transition-colors hover:text-[var(--cv-primary)] dark:text-[var(--cv-text)] dark:hover:text-white"
          >
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
              <UserIcon className="h-4 w-4" />
            </span>
            <span className="block min-w-0 flex-1 text-base leading-tight">{displayName}</span>
          </Link>
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          {renderScore(entry.global_score)}
          <button
            onClick={() => onRemove(entry)}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-rose-200/80 bg-gradient-to-r from-rose-50 via-white to-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-[0_14px_30px_-24px_rgba(225,29,72,0.85)] ring-1 ring-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:from-rose-100 hover:to-rose-50 hover:text-rose-800 hover:shadow-[0_18px_34px_-22px_rgba(225,29,72,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:border-rose-500/20 dark:from-rose-500/12 dark:via-rose-500/6 dark:to-transparent dark:text-rose-200 dark:ring-white/5 dark:hover:border-rose-400/35 dark:hover:from-rose-500/18 dark:hover:to-rose-500/8 dark:hover:text-white dark:focus-visible:ring-rose-400/40"
            title={texts.remove}
            aria-label={texts.remove}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-1 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/20">
              <TrashIcon className="h-3.5 w-3.5" />
            </span>
            <span className="pr-0.5">{texts.remove}</span>
          </button>
        </div>
      </div>

      {visibleTags.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {visibleTags.map((tag, index) => (
            <span
              key={`${entry.id}-${tag}-${index}`}
              className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20"
            >
              {tag}
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-white/5 dark:text-[var(--cv-muted)]">
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-[1.15rem] bg-slate-50/80 px-3.5 py-3 text-sm text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:text-[var(--cv-muted)] dark:ring-white/10">
        {entry.notes ? (
          <p className="line-clamp-3 whitespace-pre-line">{entry.notes}</p>
        ) : (
          <p className="italic text-slate-400 dark:text-slate-500">{texts.emptyNotes}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-[var(--cv-muted)]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">
          <CalendarDaysIcon className="h-3.5 w-3.5" />
          {dateLabel}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onManageInterviews(entry)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-purple-50 hover:text-purple-600 dark:text-[var(--cv-muted)] dark:hover:bg-purple-500/10 dark:hover:text-purple-300"
            title={texts.manageInterviews}
          >
            <VideoCameraIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEditNotes(entry)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-[var(--cv-muted)] dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            title={texts.editNotes}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
          </button>
          <Link
            to={analysisPath}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:bg-white/10 dark:hover:text-white"
            title={texts.viewResume}
          >
            <EyeIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <button
        onClick={() => onManageInterviews(entry)}
        className="mt-3 inline-flex w-full items-center justify-between gap-3 rounded-[1.1rem] bg-purple-50 px-3.5 py-3 text-left text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/15"
      >
        <span className="inline-flex items-center gap-2">
          <VideoCameraIcon className="h-4 w-4" />
          {interviewCta.label}
        </span>
        <span className="text-xs text-purple-500 dark:text-purple-200/80">
          {interviewCta.meta}
        </span>
      </button>
    </article>
  );
}

function StageColumn({
  draggedEntry,
  dragOverStage,
  entries,
  formatDate,
  isEnglish,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onEditNotes,
  onManageInterviews,
  onRemove,
  stage,
  texts,
}: {
  draggedEntry: PipelineEntry | null;
  dragOverStage: string | null;
  entries: PipelineEntry[];
  formatDate: (dateStr: string) => string;
  isEnglish: boolean;
  onDragEnd: () => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent, stageId: string) => void;
  onDragStart: (event: React.DragEvent, entry: PipelineEntry) => void;
  onDrop: (event: React.DragEvent, stageId: string) => void;
  onEditNotes: (entry: PipelineEntry) => void;
  onManageInterviews: (entry: PipelineEntry) => void;
  onRemove: (entry: PipelineEntry) => void;
  stage: PipelineStage;
  texts: KanbanBoardTexts;
}) {
  const stageEntries = entries.filter((entry) => entry.stage === stage.id);
  const isDropTarget = dragOverStage === stage.id;

  return (
    <section
      className={`flex h-full w-[320px] flex-shrink-0 flex-col overflow-hidden rounded-[1.9rem] border transition-all duration-200 ${
        isDropTarget
          ? 'border-[color:var(--cv-primary)] bg-blue-50/90 shadow-[0_24px_50px_-34px_rgba(37,99,235,0.55)] dark:bg-blue-500/10'
          : 'border-slate-200/80 bg-white/70 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-white/[0.03]'
      }`}
      onDragOver={(event) => onDragOver(event, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, stage.id)}
    >
      <header className="border-b border-slate-200/70 px-4 py-4 dark:border-white/10">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-950/40"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-[var(--cv-muted)]">
                {texts.stage} {stage.order}
              </span>
            </div>
            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-[var(--cv-text)]">
              {isEnglish ? stage.labelEn : stage.label}
            </h3>
          </div>
          <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-white/5 dark:text-[var(--cv-text)]">
            {stageEntries.length}
          </span>
        </div>
        <div className="rounded-[1.15rem] bg-slate-50/80 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:text-[var(--cv-muted)] dark:ring-white/10">
          {getStageEntrySummary(stageEntries.length, isDropTarget)}
        </div>
      </header>

      <div className="flex min-h-[320px] flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {stageEntries.length === 0 ? (
          <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <SparklesIcon className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
        ) : (
          stageEntries.map((entry) => (
            <CandidateCard
              key={entry.id}
              draggedEntry={draggedEntry}
              entry={entry}
              formatDate={formatDate}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onEditNotes={onEditNotes}
              onManageInterviews={onManageInterviews}
              onRemove={onRemove}
              texts={texts}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function LoadingState({ loading }: LoadingStateProps) {
  if (!loading) {
    return null;
  }

  return (
    <div className="cv-panel flex items-center justify-center rounded-[2rem] py-16">
      <ArrowPathIcon className="h-8 w-8 animate-spin text-[var(--cv-primary)]" />
    </div>
  );
}

export function KanbanHeader({
  addCandidateLabel,
  candidateCount,
  candidatesLabel,
  missionTitle,
  onAddCandidate,
  onRefresh,
  onClose,
  refreshLabel,
  title,
}: KanbanHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="min-w-0">
        <div className="cv-kicker mb-2">Pipeline mission</div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.3rem] bg-blue-50 text-[var(--cv-primary)] ring-1 ring-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/20">
            <DocumentTextIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-[var(--cv-muted)]">{missionTitle}</p>
            <div className="mt-3 inline-flex items-center rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/5 dark:text-[var(--cv-muted)] dark:ring-white/10">
              {candidateCount} {candidatesLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <button
          onClick={onRefresh}
          className="cv-ghost-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {refreshLabel}
        </button>
        <button
          onClick={onAddCandidate}
          className="cv-gradient-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
        >
          <PlusIcon className="h-4 w-4" />
          {addCandidateLabel}
        </button>
        {onClose ? (
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex h-12 w-12 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
            aria-label="Fermer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function KanbanBoard({
  draggedEntry,
  dragOverStage,
  entries,
  formatDate,
  isEnglish,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onEditNotes,
  onManageInterviews,
  onRemove,
  stages,
  texts,
}: KanbanBoardProps) {
  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[1.5rem] bg-slate-50/80 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:text-[var(--cv-muted)] dark:ring-white/10">
        <span className="font-semibold text-slate-900 dark:text-[var(--cv-text)]">{entries.length}</span>
        profils répartis sur
        <span className="font-semibold text-slate-900 dark:text-[var(--cv-text)]">{stages.length}</span>
        étapes — glissez-déposez pour faire avancer le pipeline.
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 align-top xl:grid xl:min-w-0 xl:grid-cols-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              draggedEntry={draggedEntry}
              dragOverStage={dragOverStage}
              entries={entries}
              formatDate={formatDate}
              isEnglish={isEnglish}
              onDragEnd={onDragEnd}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onEditNotes={onEditNotes}
              onManageInterviews={onManageInterviews}
              onRemove={onRemove}
              stage={stage}
              texts={texts}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
