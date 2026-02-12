/**
 * Resume Versions Service
 * Frontend service for managing CV version history
 */

import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';
import { ResumeVersion, ResumeVersionsResponse, Resume } from '../types/entities';
import logger from '../utils/logger.frontend';

const API_BASE = '/api/resumes';

/**
 * Get all versions for a resume
 * @param resumeId - Resume UUID
 * @param options - Pagination options
 * @returns Promise<ResumeVersionsResponse>
 */
export async function getVersions(
  resumeId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ResumeVersionsResponse> {
  const { limit = 50, offset = 0 } = options;
  
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(
      `${API_BASE}/${resumeId}/versions?limit=${limit}&offset=${offset}`,
      fetchOptions
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch versions' }));
      throw new Error(errorData.error || 'Failed to fetch versions');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[resumeVersionsService] Error fetching versions:', error);
    throw error;
  }
}

/**
 * Get a specific version by version number
 * @param resumeId - Resume UUID
 * @param versionNumber - Version number to retrieve
 * @returns Promise<ResumeVersion>
 */
export async function getVersion(
  resumeId: string,
  versionNumber: number
): Promise<ResumeVersion> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(
      `${API_BASE}/${resumeId}/versions/${versionNumber}`,
      fetchOptions
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Version not found' }));
      throw new Error(errorData.error || 'Version not found');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[resumeVersionsService] Error fetching version:', error);
    throw error;
  }
}

/**
 * Restore a previous version (creates a new version with the old content)
 * @param resumeId - Resume UUID
 * @param versionNumber - Version number to restore
 * @returns Promise<{ success: boolean; message: string; newVersion: ResumeVersion }>
 */
export async function restoreVersion(
  resumeId: string,
  versionNumber: number
): Promise<{ success: boolean; message: string; newVersion: ResumeVersion }> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'POST' });
    const response = await fetchWithAuth(
      `${API_BASE}/${resumeId}/versions/${versionNumber}/restore`,
      fetchOptions
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to restore version' }));
      throw new Error(errorData.error || 'Failed to restore version');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[resumeVersionsService] Error restoring version:', error);
    throw error;
  }
}

/**
 * Format change reason for display
 * @param reason - Raw change reason from API
 * @returns Formatted display string
 */
export function formatChangeReason(reason: string | null | undefined): string {
  if (!reason) return 'Modification';
  
  const reasonMap: Record<string, string> = {
    'initial_improvement': 'Amélioration initiale',
    'manual_edit': 'Modification manuelle',
    'restore': 'Restauration',
  };
  
  // Handle restore_from_vX format
  if (reason.startsWith('restore_from_v')) {
    const version = reason.replace('restore_from_v', '');
    return `Restauration depuis v${version}`;
  }
  
  return reasonMap[reason] || reason;
}

/**
 * Format version date for display
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatVersionDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default {
  getVersions,
  getVersion,
  restoreVersion,
  formatChangeReason,
  formatVersionDate
};
