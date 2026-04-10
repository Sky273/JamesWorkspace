import type { Resume } from '../types/entities';

export interface TagsByCategory {
  Skills: string[];
  Industries: string[];
  Tools: string[];
  'Soft Skills': string[];
  [key: string]: string[];
}

export interface ResumeStats {
  total: number;
  improved: number;
  processing: number;
  avgScore: number;
}

export const EMPTY_TAGS: TagsByCategory = {
  Skills: [],
  Industries: [],
  Tools: [],
  'Soft Skills': [],
};

export function parseResumeTags(value: unknown): string[] {
  if (!value) {
    return [];
  }

  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
    }

    if (Array.isArray(value)) {
      return value.map((tag) => String(tag));
    }
  } catch {
    return [];
  }

  return [];
}

export function getResumePreviewTags(
  resume: Resume,
  category: 'Skills' | 'Industries' | 'Tools' | 'Soft Skills'
): string[] {
  const cleanedField = `${category} Cleaned` as keyof Resume;
  const cleanedTags = parseResumeTags(resume[cleanedField]);

  if (cleanedTags.length > 0) {
    return cleanedTags;
  }

  return parseResumeTags(resume[category]);
}

export function filterResumesByTags(resumes: Resume[], selectedTags: string[]) {
  if (selectedTags.length === 0) {
    return resumes;
  }

  return resumes.filter((resume) => {
    const skills =
      parseResumeTags(resume['Skills_cleaned' as keyof Resume]) ||
      parseResumeTags(resume['Skills' as keyof Resume]);
    const industries =
      parseResumeTags(resume['Industries_cleaned' as keyof Resume]) ||
      parseResumeTags(resume['Industries' as keyof Resume]);
    const tools =
      parseResumeTags(resume['Tools_cleaned' as keyof Resume]) ||
      parseResumeTags(resume['Tools' as keyof Resume]);
    const softSkills =
      parseResumeTags(resume['Soft Skills_cleaned' as keyof Resume]) ||
      parseResumeTags(resume['Soft Skills' as keyof Resume]);
    const resumeTags = [...skills, ...industries, ...tools, ...softSkills].map((tag) =>
      tag.toLowerCase().trim()
    );

    return selectedTags.every((selectedTag) =>
      resumeTags.some((resumeTag) => resumeTag === selectedTag.toLowerCase().trim())
    );
  });
}

export function computeResumeStats(
  resumes: Resume[],
  globalStats: ResumeStats,
  totalCount: number
): ResumeStats {
  return {
    total: globalStats.total || totalCount,
    improved: globalStats.improved,
    processing: resumes.filter((resume) => {
      const status = resume.Status?.toLowerCase();
      return status === 'processing' || status === 'analyzing';
    }).length,
    avgScore: globalStats.avgScore,
  };
}

export function buildResumesSearchParams(page: number, limit: number, search: string) {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('limit', String(limit));

  if (search) {
    params.append('search', search);
  }

  return params;
}

export function normalizeResumeStatsResponse(data: Record<string, unknown>): ResumeStats {
  const resumesData = (data.resumes as Record<string, number> | undefined) || {};
  const scoresData = (data.scores as Record<string, number> | undefined) || {};

  return {
    total: resumesData.total || 0,
    improved: resumesData.improved || 0,
    processing: 0,
    avgScore: scoresData.averageImproved || scoresData.averageOriginal || 0,
  };
}
