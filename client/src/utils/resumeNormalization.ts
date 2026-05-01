import type { Resume } from '../types/entities';

const getFirstString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const getFirstNumber = (...values: Array<unknown>): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

export const normalizeResume = (resume: Resume): Resume => {
  const normalizedId = getFirstString(resume.id, resume['ID'], resume.ID) || '';
  const normalizedName = getFirstString(resume.name, resume['Name'], resume.candidate_name, resume.Name);
  const normalizedOriginalName = getFirstString(resume.originalName, resume['Original Name'], normalizedName);
  const normalizedTitle = getFirstString(resume.title, resume['Title'], resume.adapted_title);
  const normalizedFileName = getFirstString(
    resume.fileName,
    resume['File Name'],
    resume.file_name,
    Array.isArray(resume['Resume File']) ? resume['Resume File'][0]?.filename : undefined
  );
  const normalizedOriginalText = getFirstString(resume.originalText, resume['Original Text'], resume.original_text);
  const normalizedImprovedText = getFirstString(resume.improvedText, resume['Improved Text'], resume.improved_text);
  const normalizedCurrentVersion = getFirstNumber(resume.currentVersion, resume['Current Version']);
  const normalizedGlobalRating = getFirstNumber(resume['Global Rating'], resume.global_rating);
  const normalizedImprovedGlobalRating = getFirstNumber(
    resume['Improved Global Rating'],
    resume.improved_global_rating,
    resume.improvedGlobalRating
  );
  const rawStatus = getFirstString(resume.Status, resume.status);
  const normalizedStatus = rawStatus?.toLowerCase();
  const hasImprovedVersion = Boolean(normalizedImprovedText) || (normalizedImprovedGlobalRating ?? 0) > 0;
  const status = hasImprovedVersion && (!normalizedStatus || normalizedStatus === 'analyzed')
    ? 'improved'
    : rawStatus;

  return {
    ...resume,
    id: normalizedId,
    ID: normalizedId,
    Name: normalizedName,
    name: normalizedName,
    'Original Name': normalizedOriginalName,
    originalName: normalizedOriginalName,
    Title: normalizedTitle,
    title: normalizedTitle,
    'File Name': normalizedFileName,
    fileName: normalizedFileName,
    'Original Text': normalizedOriginalText,
    originalText: normalizedOriginalText,
    'Improved Text': normalizedImprovedText,
    improvedText: normalizedImprovedText,
    'Current Version': normalizedCurrentVersion,
    currentVersion: normalizedCurrentVersion,
    'Global Rating': normalizedGlobalRating ?? resume['Global Rating'],
    global_rating: normalizedGlobalRating ?? resume.global_rating,
    'Improved Global Rating': normalizedImprovedGlobalRating ?? resume['Improved Global Rating'],
    improved_global_rating: normalizedImprovedGlobalRating ?? resume.improved_global_rating,
    Status: status as Resume['Status'],
    status,
    candidate_name: getFirstString(resume.candidate_name, normalizedName),
  };
};

export const normalizeResumeList = (resumes: Resume[] = []): Resume[] => resumes.map(normalizeResume);

export const applyResumeUpdate = (resume: Resume, updates: Partial<Resume>): Resume =>
  normalizeResume({ ...resume, ...updates });
