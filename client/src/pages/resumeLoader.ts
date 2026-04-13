import type { Resume } from '../types/entities';

interface ResolveResumeOptions<TResume extends Resume> {
  id?: string;
  currentResume: TResume | null;
  resumes: TResume[];
  fetchResume: (id: string) => Promise<TResume | null | undefined>;
  preferFresh?: boolean;
}

type ResumeResolution<TResume extends Resume> =
  | { kind: 'missing-id' }
  | { kind: 'current'; resume: TResume }
  | { kind: 'cached'; resume: TResume }
  | { kind: 'fetched'; resume: TResume }
  | { kind: 'not-found' };

export async function resolveResumeForPage<TResume extends Resume>(
  options: ResolveResumeOptions<TResume>
): Promise<ResumeResolution<TResume>> {
  const { id, currentResume, resumes, fetchResume } = options;

  if (!id) {
    return { kind: 'missing-id' };
  }

  if (!options.preferFresh && currentResume?.id === id) {
    return { kind: 'current', resume: currentResume };
  }

  const existingResume = !options.preferFresh
    ? resumes.find((resume) => resume.id === id)
    : undefined;
  if (existingResume) {
    return { kind: 'cached', resume: existingResume };
  }

  const fetchedResume = await fetchResume(id);
  if (fetchedResume) {
    return { kind: 'fetched', resume: fetchedResume };
  }

  return { kind: 'not-found' };
}
