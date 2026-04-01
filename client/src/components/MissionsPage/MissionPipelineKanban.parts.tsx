import { Link } from 'react-router-dom';
import {
  PlusIcon,
  UserIcon,
  CalendarIcon,
  StarIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type { PipelineEntry, PipelineStage } from '../../services/pipelineService';

interface LoadingStateProps {
  loading: boolean;
}

interface KanbanHeaderProps {
  candidateCount: number;
  missionTitle: string;
  onAddCandidate: () => void;
  onClose?: () => void;
  title: string;
  candidatesLabel: string;
  addCandidateLabel: string;
}

interface KanbanBoardTexts {
  interviews: string;
  manageInterviews: string;
  remove: string;
  scheduleInterview: string;
  unknownCandidate: string;
  viewResume: string;
  editNotes: string;
}

interface KanbanBoardProps {
  draggedEntry: PipelineEntry | null;
  dragOverStage: string | null;
  entries: PipelineEntry[];
  formatDate: (dateStr: string) => string;
  isEnglish: boolean;
  noEntriesLabel: string;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent, stageId: string) => void;
  onDragStart: (entry: PipelineEntry) => void;
  onDrop: (event: React.DragEvent, stageId: string) => void;
  onEditNotes: (entry: PipelineEntry) => void;
  onManageInterviews: (entry: PipelineEntry) => void;
  onRemove: (entry: PipelineEntry) => void;
  stages: PipelineStage[];
  texts: KanbanBoardTexts;
}

function renderScore(score?: number) {
  if (!score) {
    return null;
  }

  const stars = Math.round(score / 20);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((index) =>
        index <= stars ? (
          <StarIconSolid key={index} className="w-3 h-3 text-yellow-400" />
        ) : (
          <StarIcon key={index} className="w-3 h-3 text-gray-300 dark:text-gray-600" />
        )
      )}
    </div>
  );
}

function CandidateCard({
  draggedEntry,
  entry,
  formatDate,
  onDragStart,
  onEditNotes,
  onManageInterviews,
  onRemove,
  texts
}: {
  draggedEntry: PipelineEntry | null;
  entry: PipelineEntry;
  formatDate: (dateStr: string) => string;
  onDragStart: (entry: PipelineEntry) => void;
  onEditNotes: (entry: PipelineEntry) => void;
  onManageInterviews: (entry: PipelineEntry) => void;
  onRemove: (entry: PipelineEntry) => void;
  texts: KanbanBoardTexts;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(entry)}
      className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        draggedEntry?.id === entry.id ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <Link
          to={`/resumes/${entry.resume_id}/analysis`}
          className="font-medium text-gray-900 dark:text-gray-100 text-sm hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
        >
          <UserIcon className="w-4 h-4" />
          {entry.resume_name || texts.unknownCandidate}
        </Link>
        {renderScore(entry.global_score)}
      </div>

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {entry.tags.slice(0, 3).map((tag, index) => (
            <span
              key={`${entry.id}-${tag}-${index}`}
              className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs"
            >
              {tag}
            </span>
          ))}
          {entry.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{entry.tags.length - 3}</span>
          )}
        </div>
      )}

      {entry.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{entry.notes}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <CalendarIcon className="w-3 h-3" />
          {formatDate(entry.moved_at || entry.created_at)}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onManageInterviews(entry)}
            className="p-1 text-gray-400 hover:text-purple-500 rounded"
            title={texts.manageInterviews}
          >
            <VideoCameraIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditNotes(entry)}
            className="p-1 text-gray-400 hover:text-blue-500 rounded"
            title={texts.editNotes}
          >
            <ChatBubbleLeftIcon className="w-4 h-4" />
          </button>
          <Link
            to={`/resumes/${entry.resume_id}/analysis`}
            className="p-1 text-gray-400 hover:text-blue-500 rounded"
            title={texts.viewResume}
          >
            <EyeIcon className="w-4 h-4" />
          </Link>
          <button
            onClick={() => onRemove(entry)}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
            title={texts.remove}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        onClick={() => onManageInterviews(entry)}
        className="mt-2 w-full flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
      >
        <VideoCameraIcon className="w-3 h-3" />
        {entry.interview_count && entry.interview_count > 0 ? (
          <>
            {entry.interview_count} {texts.interviews}
            {entry.next_interview && (
              <span className="text-gray-400">- {formatDate(entry.next_interview)}</span>
            )}
          </>
        ) : (
          <span>{texts.scheduleInterview}</span>
        )}
      </button>
    </div>
  );
}

function StageColumn({
  draggedEntry,
  dragOverStage,
  entries,
  formatDate,
  isEnglish,
  noEntriesLabel,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onEditNotes,
  onManageInterviews,
  onRemove,
  stage,
  texts
}: {
  draggedEntry: PipelineEntry | null;
  dragOverStage: string | null;
  entries: PipelineEntry[];
  formatDate: (dateStr: string) => string;
  isEnglish: boolean;
  noEntriesLabel: string;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent, stageId: string) => void;
  onDragStart: (entry: PipelineEntry) => void;
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
    <div
      className={`w-72 flex-shrink-0 rounded-lg transition-all ${
        isDropTarget ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-900/50'
      }`}
      onDragOver={(event) => onDragOver(event, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, stage.id)}
    >
      <div
        className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
        style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
            {isEnglish ? stage.labelEn : stage.label}
          </span>
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
            {stageEntries.length}
          </span>
        </div>
      </div>

      <div className="p-2 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
        {stageEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">{noEntriesLabel}</div>
        ) : (
          stageEntries.map((entry) => (
            <CandidateCard
              key={entry.id}
              draggedEntry={draggedEntry}
              entry={entry}
              formatDate={formatDate}
              onDragStart={onDragStart}
              onEditNotes={onEditNotes}
              onManageInterviews={onManageInterviews}
              onRemove={onRemove}
              texts={texts}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function LoadingState({ loading }: LoadingStateProps) {
  if (!loading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

export function KanbanHeader({
  addCandidateLabel,
  candidateCount,
  candidatesLabel,
  missionTitle,
  onAddCandidate,
  onClose,
  title
}: KanbanHeaderProps) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <DocumentTextIcon className="w-6 h-6 text-blue-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {missionTitle} - {candidateCount} {candidatesLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddCandidate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          {addCandidateLabel}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
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
  noEntriesLabel,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onEditNotes,
  onManageInterviews,
  onRemove,
  stages,
  texts
}: KanbanBoardProps) {
  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            draggedEntry={draggedEntry}
            dragOverStage={dragOverStage}
            entries={entries}
            formatDate={formatDate}
            isEnglish={isEnglish}
            noEntriesLabel={noEntriesLabel}
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
  );
}
