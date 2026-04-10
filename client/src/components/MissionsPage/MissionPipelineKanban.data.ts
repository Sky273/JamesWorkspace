import type { PipelineEntry } from '../../services/pipelineService';
import type { Adaptation } from '../../utils/resumeAdaptationService';
import type { AdaptationOption, CandidateOption, Resume } from './MissionPipelineKanban.types';

type RawAdaptation = Adaptation &
  Record<string, unknown> & {
    missionId?: string;
    resumeId?: string;
    status?: string;
  };

type MissionAdaptationOption = AdaptationOption & { missionId: string };

const getRawAdaptationResumeId = (adaptation: RawAdaptation) =>
  String(adaptation['Resume ID'] || adaptation.resumeId || '');

const getRawAdaptationMissionId = (adaptation: RawAdaptation) =>
  String(adaptation['Mission ID'] || adaptation.missionId || '');

export function buildMissionAdaptedResumeIds(adaptations: Adaptation[]) {
  return new Set(
    adaptations
      .map((adaptation) => getRawAdaptationResumeId(adaptation as RawAdaptation))
      .filter(Boolean)
  );
}

export function decoratePipelineEntries(
  entries: PipelineEntry[],
  missionAdaptedResumeIds: Set<string>
) {
  return entries.map((entry) => ({
    ...entry,
    has_mission_adaptation: missionAdaptedResumeIds.has(String(entry.resume_id)),
  }));
}

export function buildResumeNameById(resumes: Resume[]) {
  const resumeNameById = new Map<string, string>();

  for (const resume of resumes) {
    resumeNameById.set(String(resume.id), resume.Name);
  }

  return resumeNameById;
}

export function buildResumeCandidates(resumes: Resume[], existingResumeIds: Set<string>) {
  return resumes
    .filter((resume) => !existingResumeIds.has(String(resume.id)))
    .map((resume) => {
      const resumeId = String(resume.id);

      return {
        id: `resume:${resumeId}`,
        resumeId,
        name: resume.Name,
        title: resume.Title,
        score: resume['Global Score'],
        tags: resume.Tags,
        source: 'resume' as const,
      } satisfies CandidateOption;
    });
}

export function buildMissionAdaptations(
  adaptations: Adaptation[],
  missionId: string
): MissionAdaptationOption[] {
  return adaptations
    .map((adaptation) => {
      const rawAdaptation = adaptation as RawAdaptation;

      return {
        id: adaptation.id,
        resumeId: getRawAdaptationResumeId(rawAdaptation),
        missionId: getRawAdaptationMissionId(rawAdaptation),
        resumeName: String(rawAdaptation['Resume Name'] || ''),
        candidateName: rawAdaptation['Candidate Name'] as string | undefined,
        adaptedTitle: rawAdaptation['Adapted Title'] as string | undefined,
        matchScore:
          rawAdaptation['Match Score'] != null
            ? Number(rawAdaptation['Match Score'])
            : undefined,
        status: (rawAdaptation.Status as string | undefined) || adaptation.status,
      };
    })
    .filter((adaptation) => adaptation.resumeId && adaptation.missionId === missionId);
}

export function buildAdaptationCandidates(
  adaptations: MissionAdaptationOption[],
  existingAdaptationIds: Set<string>,
  resumeNameById: Map<string, string>,
  unknownCandidateLabel: string
) {
  return adaptations
    .filter((adaptation) => !existingAdaptationIds.has(adaptation.id))
    .map((adaptation) => ({
      id: `adaptation:${adaptation.id}`,
      resumeId: adaptation.resumeId,
      name:
        resumeNameById.get(adaptation.resumeId) ||
        adaptation.resumeName ||
        unknownCandidateLabel,
      title: adaptation.adaptedTitle,
      score: adaptation.matchScore,
      source: 'adaptation' as const,
      hasMissionAdaptation: true,
      adaptationId: adaptation.id,
      adaptationStatus: adaptation.status,
    } satisfies CandidateOption));
}

export function markCandidatesWithMissionAdaptation(
  candidates: CandidateOption[],
  missionAdaptations: MissionAdaptationOption[]
) {
  const adaptedResumeIds = new Set(missionAdaptations.map((adaptation) => adaptation.resumeId));

  return candidates.map((candidate) =>
    candidate.source === 'resume' && adaptedResumeIds.has(candidate.resumeId)
      ? { ...candidate, hasMissionAdaptation: true }
      : candidate
  );
}

export function sortCandidates(candidates: CandidateOption[]) {
  return [...candidates].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'adaptation' ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
}
