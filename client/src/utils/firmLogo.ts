import { resumeService } from './resumeService';

const logoMarkupCache = new Map<string, Promise<string>>();
const resumeFirmIdCache = new Map<string, Promise<string | null>>();

function getRecordValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildLogoMarkup(dataUrl: string): string {
  return `<img src="${dataUrl}" alt="Cabinet logo" class="firm-logo" style="max-height: 60px; max-width: 100%; object-fit: contain;" />`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read firm logo blob'));
    reader.readAsDataURL(blob);
  });
}

export function getFirmIdFromRecord(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) {
    return null;
  }

  return getRecordValue(record, ['FirmId', 'firmId', 'firm_id', 'Firm ID', 'Resume Firm ID']);
}

export async function resolveResumeFirmId(resumeId: string | null | undefined): Promise<string | null> {
  if (!resumeId) {
    return null;
  }

  if (!resumeFirmIdCache.has(resumeId)) {
    resumeFirmIdCache.set(resumeId, (async () => {
      const resume = await resumeService.getResume(resumeId) as Record<string, unknown> | null;
      return getFirmIdFromRecord(resume);
    })());
  }

  return resumeFirmIdCache.get(resumeId) || null;
}

export async function resolveFirmLogoMarkup({
  firmId,
  resumeId,
}: {
  firmId?: string | null;
  resumeId?: string | null;
}): Promise<string> {
  const resolvedFirmId = firmId || await resolveResumeFirmId(resumeId);
  if (!resolvedFirmId) {
    return '';
  }

  if (!logoMarkupCache.has(resolvedFirmId)) {
    logoMarkupCache.set(resolvedFirmId, (async () => {
      const response = await fetch(`/api/firms/${encodeURIComponent(resolvedFirmId)}/logo/image`);
      if (!response.ok) {
        return '';
      }

      const blob = await response.blob();
      if (!blob.size) {
        return '';
      }

      const dataUrl = await blobToDataUrl(blob);
      return dataUrl ? buildLogoMarkup(dataUrl) : '';
    })());
  }

  return logoMarkupCache.get(resolvedFirmId) || '';
}
