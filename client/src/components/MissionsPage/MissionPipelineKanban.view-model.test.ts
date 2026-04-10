import { describe, expect, it } from 'vitest';

import type { PipelineEntry } from '../../services/pipelineService';
import {
  getPipelineEntryAnalysisPath,
  getPipelineEntryBadge,
  getPipelineEntryInterviewCta,
  getPipelineEntryScore,
  getPipelineEntryTags,
  getStageEntrySummary,
} from './MissionPipelineKanban.view-model';

function createEntry(overrides: Partial<PipelineEntry> = {}): PipelineEntry {
  return {
    id: 'entry-1',
    resume_id: 'resume-1',
    resume_name: 'Ada',
    stage: 'new',
    notes: '',
    created_at: '2026-04-10T09:00:00Z',
    moved_at: '2026-04-11T09:00:00Z',
    tags: ['React', 'Node', 'TypeScript', 'API', 'CI/CD'],
    interview_count: 0,
    ...overrides,
  } as PipelineEntry;
}

describe('MissionPipelineKanban.view-model', () => {
  it('builds the analysis path for resumes and adaptations', () => {
    expect(getPipelineEntryAnalysisPath(createEntry())).toBe('/resumes/resume-1/analysis');
    expect(
      getPipelineEntryAnalysisPath(createEntry({ adaptation_id: 'adapt-1' }))
    ).toBe('/adaptations/adapt-1');
  });

  it('returns the right badge for adapted and original entries', () => {
    expect(getPipelineEntryBadge(createEntry({ adaptation_id: 'adapt-1' }))?.label).toBe('Adapté');
    expect(getPipelineEntryBadge(createEntry({ has_mission_adaptation: true }))?.label).toBe('Original');
    expect(getPipelineEntryBadge(createEntry())).toBeNull();
  });

  it('derives score and visible tags for cards', () => {
    expect(getPipelineEntryScore(84)).toEqual({ value: 84, stars: 4 });
    expect(getPipelineEntryScore(undefined)).toBeNull();
    expect(getPipelineEntryTags(createEntry(), 3)).toEqual({
      visibleTags: ['React', 'Node', 'TypeScript'],
      hiddenCount: 2,
    });
  });

  it('builds interview CTA metadata from interview state', () => {
    const withInterview = getPipelineEntryInterviewCta(
      createEntry({ interview_count: 2, next_interview: '2026-04-12T10:00:00Z' }),
      () => '12 avr.',
      {
        interviews: 'entretiens',
        scheduleInterview: 'Planifier',
        unknownCandidate: 'Inconnu',
      }
    );
    expect(withInterview).toEqual({ label: '2 entretiens', meta: '12 avr.' });

    const withoutInterview = getPipelineEntryInterviewCta(
      createEntry({ interview_count: 0 }),
      () => 'ignored',
      {
        interviews: 'entretiens',
        scheduleInterview: 'Planifier',
        unknownCandidate: 'Inconnu',
      }
    );
    expect(withoutInterview).toEqual({ label: 'Planifier', meta: '→' });
  });

  it('summarizes stage counts and drop state', () => {
    expect(getStageEntrySummary(1, false)).toBe('1 profil dans cette étape');
    expect(getStageEntrySummary(3, false)).toBe('3 profils dans cette étape');
    expect(getStageEntrySummary(3, true)).toBe('Déposez le candidat ici');
  });
});
