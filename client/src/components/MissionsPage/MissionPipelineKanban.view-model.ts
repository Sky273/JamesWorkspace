import type { PipelineEntry } from '../../services/pipelineService';

interface PipelineEntryBadge {
  label: string;
  className: string;
}

interface PipelineEntryScore {
  value: number;
  stars: number;
}

interface PipelineEntryTags {
  visibleTags: string[];
  hiddenCount: number;
}

interface PipelineEntryInterviewCta {
  label: string;
  meta: string;
}

interface PipelineTexts {
  interviews: string;
  scheduleInterview: string;
  unknownCandidate: string;
}

export function getPipelineEntryAnalysisPath(entry: PipelineEntry): string {
  return entry.adaptation_id
    ? `/adaptations/${entry.adaptation_id}`
    : `/resumes/${entry.resume_id}/analysis`;
}

export function getPipelineEntryBadge(entry: PipelineEntry): PipelineEntryBadge | null {
  if (entry.adaptation_id) {
    return {
      label: 'Adapté',
      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    };
  }

  if (entry.has_mission_adaptation) {
    return {
      label: 'Original',
      className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20',
    };
  }

  return null;
}

export function getPipelineEntryDisplayName(entry: PipelineEntry, unknownCandidateLabel: string): string {
  return entry.resume_name || unknownCandidateLabel;
}

export function getPipelineEntryScore(score?: number): PipelineEntryScore | null {
  if (!score) {
    return null;
  }

  return {
    value: score,
    stars: Math.round(score / 20),
  };
}

export function getPipelineEntryTags(entry: PipelineEntry, maxVisible = 4): PipelineEntryTags {
  const tags = entry.tags || [];

  return {
    visibleTags: tags.slice(0, maxVisible),
    hiddenCount: Math.max(0, tags.length - maxVisible),
  };
}

export function getPipelineEntryDateLabel(entry: PipelineEntry, formatDate: (dateStr: string) => string): string {
  return formatDate(entry.moved_at || entry.created_at);
}

export function getPipelineEntryInterviewCta(
  entry: PipelineEntry,
  formatDate: (dateStr: string) => string,
  texts: PipelineTexts
): PipelineEntryInterviewCta {
  const hasInterviews = Boolean(entry.interview_count && entry.interview_count > 0);

  return {
    label: hasInterviews ? `${entry.interview_count} ${texts.interviews}` : texts.scheduleInterview,
    meta: hasInterviews && entry.next_interview ? formatDate(entry.next_interview) : '→',
  };
}

export function getStageEntrySummary(count: number, isDropTarget: boolean): string {
  if (isDropTarget) {
    return 'Déposez le candidat ici';
  }

  return `${count} profil${count > 1 ? 's' : ''} dans cette étape`;
}
