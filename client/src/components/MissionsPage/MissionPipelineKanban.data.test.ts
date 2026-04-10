import { describe, expect, it } from 'vitest';

import type { PipelineEntry } from '../../services/pipelineService';
import type { Adaptation } from '../../utils/resumeAdaptationService';
import {
  buildAdaptationCandidates,
  buildMissionAdaptations,
  buildMissionAdaptedResumeIds,
  buildResumeCandidates,
  buildResumeNameById,
  decoratePipelineEntries,
  markCandidatesWithMissionAdaptation,
  sortCandidates,
} from './MissionPipelineKanban.data';
import type { Resume } from './MissionPipelineKanban.types';

describe('MissionPipelineKanban.data', () => {
  it('collects adapted resume ids and decorates pipeline entries', () => {
    const adaptations = [
      { id: 'a1', resumeId: 'resume-1', missionId: 'mission-1' },
      { id: 'a2', 'Resume ID': 'resume-2', 'Mission ID': 'mission-1' },
    ] as unknown as Adaptation[];

    const adaptedIds = buildMissionAdaptedResumeIds(adaptations);
    expect([...adaptedIds]).toEqual(['resume-1', 'resume-2']);

    const entries = decoratePipelineEntries(
      [
        { id: '1', resume_id: 'resume-2' },
        { id: '2', resume_id: 'resume-3' },
      ] as PipelineEntry[],
      adaptedIds
    );
    expect(entries[0].has_mission_adaptation).toBe(true);
    expect(entries[1].has_mission_adaptation).toBe(false);
  });

  it('builds resume and adaptation candidates while preserving mission scope', () => {
    const resumes = [
      { id: 'resume-1', Name: 'SLA', Title: 'Dev', 'Global Score': 77, Tags: ['API'] },
      { id: 'resume-2', Name: 'ADA', Title: 'PO', 'Global Score': 65, Tags: ['Product'] },
    ] as Resume[];
    const resumeNameById = buildResumeNameById(resumes);
    expect(resumeNameById.get('resume-2')).toBe('ADA');

    const resumeCandidates = buildResumeCandidates(resumes, new Set(['resume-1']));
    expect(resumeCandidates).toHaveLength(1);
    expect(resumeCandidates[0].id).toBe('resume:resume-2');

    const missionAdaptations = buildMissionAdaptations(
      [
        {
          id: 'adapt-1',
          resumeId: 'resume-1',
          missionId: 'mission-1',
          status: 'completed',
          'Adapted Title': 'Analyste',
          'Match Score': '78',
        },
        {
          id: 'adapt-2',
          'Resume ID': 'resume-2',
          'Mission ID': 'mission-2',
          status: 'completed',
        },
      ] as unknown as Adaptation[],
      'mission-1'
    );
    expect(missionAdaptations).toHaveLength(1);
    expect(missionAdaptations[0].matchScore).toBe(78);

    const adaptationCandidates = buildAdaptationCandidates(
      missionAdaptations,
      new Set<string>(),
      resumeNameById,
      'Inconnu'
    );
    expect(adaptationCandidates[0]).toMatchObject({
      id: 'adaptation:adapt-1',
      name: 'SLA',
      source: 'adaptation',
      hasMissionAdaptation: true,
    });
  });

  it('marks originals with mission adaptations and sorts adaptations first', () => {
    const candidates = markCandidatesWithMissionAdaptation(
      [
        { id: 'resume:1', resumeId: 'resume-1', name: 'Zed', source: 'resume' },
        { id: 'resume:2', resumeId: 'resume-2', name: 'Ada', source: 'resume' },
        { id: 'adapt:1', resumeId: 'resume-2', name: 'Ada', source: 'adaptation' },
      ],
      [
        {
          id: 'adapt-1',
          resumeId: 'resume-2',
          missionId: 'mission-1',
          resumeName: 'Ada',
        },
      ]
    );

    expect(candidates.find((candidate) => candidate.id === 'resume:2')?.hasMissionAdaptation).toBe(true);

    const sorted = sortCandidates(candidates);
    expect(sorted.map((candidate) => candidate.id)).toEqual(['adapt:1', 'resume:2', 'resume:1']);
  });
});
