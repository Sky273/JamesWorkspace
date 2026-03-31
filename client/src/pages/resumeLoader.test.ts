import { describe, expect, it, vi } from 'vitest';
import { resolveResumeForPage } from './resumeLoader';

describe('resolveResumeForPage', () => {
  it('returns missing-id when no id is provided', async () => {
    await expect(resolveResumeForPage({
      currentResume: null,
      resumes: [],
      fetchResume: vi.fn(),
    })).resolves.toEqual({ kind: 'missing-id' });
  });

  it('prefers the resume already loaded in context', async () => {
    const currentResume = { id: 'resume-1' };

    await expect(resolveResumeForPage({
      id: 'resume-1',
      currentResume: currentResume as never,
      resumes: [],
      fetchResume: vi.fn(),
    })).resolves.toEqual({ kind: 'current', resume: currentResume });
  });

  it('falls back to the cached resume list before hitting the api', async () => {
    const cachedResume = { id: 'resume-2' };
    const fetchResume = vi.fn();

    await expect(resolveResumeForPage({
      id: 'resume-2',
      currentResume: null,
      resumes: [cachedResume as never],
      fetchResume,
    })).resolves.toEqual({ kind: 'cached', resume: cachedResume });
    expect(fetchResume).not.toHaveBeenCalled();
  });

  it('fetches the resume when it is not already available', async () => {
    const fetchedResume = { id: 'resume-3' };

    await expect(resolveResumeForPage({
      id: 'resume-3',
      currentResume: null,
      resumes: [],
      fetchResume: vi.fn().mockResolvedValue(fetchedResume),
    })).resolves.toEqual({ kind: 'fetched', resume: fetchedResume });
  });

  it('returns not-found when the api does not return a resume', async () => {
    await expect(resolveResumeForPage({
      id: 'resume-4',
      currentResume: null,
      resumes: [],
      fetchResume: vi.fn().mockResolvedValue(null),
    })).resolves.toEqual({ kind: 'not-found' });
  });
});
