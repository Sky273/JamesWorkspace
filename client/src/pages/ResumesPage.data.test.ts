import { describe, expect, it } from 'vitest';

import {
  buildResumesSearchParams,
  computeResumeStats,
  filterResumesByTags,
  getResumePreviewTags,
  normalizeResumeStatsResponse,
  parseResumeTags,
} from './ResumesPage.data';

describe('ResumesPage.data', () => {
  it('parses tags from json strings and arrays', () => {
    expect(parseResumeTags('["React","Node"]')).toEqual(['React', 'Node']);
    expect(parseResumeTags(['API', 42])).toEqual(['API', '42']);
    expect(parseResumeTags('invalid')).toEqual([]);
  });

  it('prefers cleaned tags and filters resumes by selected tags', () => {
    const resume = {
      id: '1',
      'Skills Cleaned': '["React"]',
      Skills: '["Legacy"]',
    } as never;
    expect(getResumePreviewTags(resume, 'Skills')).toEqual(['React']);

    const filtered = filterResumesByTags(
      [
        { id: '1', Skills_cleaned: '["React","Node"]', Industries_cleaned: '[]', Tools_cleaned: '[]', 'Soft Skills_cleaned': '[]' },
        { id: '2', Skills_cleaned: '["Java"]', Industries_cleaned: '[]', Tools_cleaned: '[]', 'Soft Skills_cleaned': '[]' },
      ] as never[],
      ['React']
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('builds search params and computes stats from current data', () => {
    expect(buildResumesSearchParams(2, 20, 'ada').toString()).toBe('page=2&limit=20&search=ada');

    expect(
      computeResumeStats(
        [
          { Status: 'processing' },
          { Status: 'analyzing' },
          { Status: 'improved' },
        ] as never[],
        { total: 50, improved: 10, processing: 0, avgScore: 72 },
        3
      )
    ).toEqual({ total: 50, improved: 10, processing: 2, avgScore: 72 });
  });

  it('normalizes stats API responses', () => {
    expect(
      normalizeResumeStatsResponse({
        resumes: { total: 12, improved: 4 },
        scores: { averageImproved: 81, averageOriginal: 70 },
      })
    ).toEqual({ total: 12, improved: 4, processing: 0, avgScore: 81 });
  });
});
