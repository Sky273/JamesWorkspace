/**
 * Pipeline Service
 * Frontend service for managing candidate selection pipeline and interviews
 */

import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';

const API_BASE = '/api/pipeline';

// ============================================
// TYPES
// ============================================

export interface PipelineStage {
  id: string;
  label: string;
  labelEn: string;
  order: number;
  color: string;
}

export interface PipelineEntry {
  id: string;
  resume_id: string;
  mission_id: string | null;
  client_id: string | null;
  stage: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  moved_at: string;
  // Joined fields
  resume_name?: string;
  mission_title?: string;
  mission_client?: string;
  client_name?: string;
  global_score?: number;
  tags?: string[];
  interview_count?: number;
  next_interview?: string | null;
}

export interface PipelineHistory {
  id: string;
  pipeline_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string;
  changed_by_name?: string;
  notes: string | null;
  created_at: string;
}

export interface Interview {
  id: string;
  pipeline_id: string;
  title: string;
  description: string | null;
  interview_type: 'client' | 'partner' | 'technical' | 'hr';
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_link: string | null;
  attendees: Attendee[];
  calendar_event_id: string | null;
  calendar_provider: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  outcome: string | null;
  outcome_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  resume_id?: string;
  resume_name?: string;
  mission_title?: string;
  client_name?: string;
}

export interface Attendee {
  id?: string;
  name: string;
  email: string;
  role?: string;
}

export interface PipelineOverview {
  [stageId: string]: PipelineStage & {
    count: number;
    items: PipelineEntry[];
  };
}

export interface PipelineStats {
  total: number;
  new_count: number;
  screening_count: number;
  submitted_count: number;
  interview_count: number;
  interview_done_count: number;
  selected_count: number;
  rejected_count: number;
  on_hold_count: number;
  upcoming_interviews: number;
}

// ============================================
// PIPELINE STAGES
// ============================================

/**
 * Get all pipeline stages configuration
 */
export async function getStages(): Promise<PipelineStage[]> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/stages`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch pipeline stages');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching stages:', error);
    throw error;
  }
}

// ============================================
// PIPELINE CRUD
// ============================================

/**
 * Add a resume to the pipeline
 */
export async function addToPipeline(data: {
  resumeId: string;
  missionId?: string;
  clientId?: string;
  stage?: string;
  notes?: string;
}): Promise<PipelineEntry> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const response = await fetchWithAuth(API_BASE, fetchOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to add to pipeline' }));
      throw new Error(errorData.error || 'Failed to add to pipeline');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error adding to pipeline:', error);
    throw error;
  }
}

/**
 * Get pipeline entry by ID
 */
export async function getPipelineById(pipelineId: string): Promise<PipelineEntry> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Pipeline entry not found');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline entry:', error);
    throw error;
  }
}

/**
 * Get all pipeline entries for a resume
 */
export async function getPipelineByResumeId(resumeId: string): Promise<PipelineEntry[]> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/resume/${resumeId}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch pipeline entries');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline for resume:', error);
    throw error;
  }
}

/**
 * Get all pipeline entries for a mission
 */
export async function getPipelineByMissionId(missionId: string): Promise<PipelineEntry[]> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/mission/${missionId}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch pipeline entries');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline for mission:', error);
    throw error;
  }
}

/**
 * Get pipeline overview grouped by stage
 */
export async function getPipelineOverview(filters?: {
  clientId?: string;
  missionId?: string;
}): Promise<PipelineOverview> {
  try {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append('clientId', filters.clientId);
    if (filters?.missionId) params.append('missionId', filters.missionId);
    
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const url = `${API_BASE}/overview${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetchWithAuth(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch pipeline overview');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline overview:', error);
    throw error;
  }
}

/**
 * Move a candidate to a different stage
 */
export async function moveToStage(
  pipelineId: string,
  stage: string,
  notes?: string
): Promise<PipelineEntry> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, notes })
    });
    
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}/stage`, fetchOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update stage' }));
      throw new Error(errorData.error || 'Failed to update stage');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error moving pipeline stage:', error);
    throw error;
  }
}

/**
 * Update pipeline notes
 */
export async function updatePipelineNotes(
  pipelineId: string,
  notes: string
): Promise<PipelineEntry> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}/notes`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to update notes');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error updating pipeline notes:', error);
    throw error;
  }
}

/**
 * Remove from pipeline
 */
export async function removeFromPipeline(pipelineId: string): Promise<void> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'DELETE' });
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to remove from pipeline');
    }
  } catch (error) {
    logger.error('[pipelineService] Error removing from pipeline:', error);
    throw error;
  }
}

/**
 * Get pipeline history
 */
export async function getPipelineHistory(pipelineId: string): Promise<PipelineHistory[]> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}/history`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline history:', error);
    throw error;
  }
}

// ============================================
// INTERVIEW OPERATIONS
// ============================================

/**
 * Schedule an interview
 */
export async function scheduleInterview(
  pipelineId: string,
  data: {
    title: string;
    description?: string;
    interviewType?: string;
    scheduledAt: string;
    durationMinutes?: number;
    location?: string;
    meetingLink?: string;
    attendees?: Attendee[];
    calendarEventId?: string;
    calendarProvider?: string;
  }
): Promise<Interview> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}/interviews`, fetchOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to schedule interview' }));
      throw new Error(errorData.error || 'Failed to schedule interview');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error scheduling interview:', error);
    throw error;
  }
}

/**
 * Get interviews for a pipeline entry
 */
export async function getInterviews(pipelineId: string): Promise<Interview[]> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/${pipelineId}/interviews`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch interviews');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching interviews:', error);
    throw error;
  }
}

/**
 * Get upcoming interviews
 */
export async function getUpcomingInterviews(days?: number): Promise<Interview[]> {
  try {
    const params = days ? `?days=${days}` : '';
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`${API_BASE}/interviews/upcoming${params}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch upcoming interviews');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching upcoming interviews:', error);
    throw error;
  }
}

/**
 * Update an interview
 */
export async function updateInterview(
  interviewId: string,
  updates: Partial<Interview>
): Promise<Interview> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    const response = await fetchWithAuth(`${API_BASE}/interviews/${interviewId}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to update interview');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error updating interview:', error);
    throw error;
  }
}

/**
 * Complete an interview with outcome
 */
export async function completeInterview(
  interviewId: string,
  outcome: string,
  outcomeNotes?: string
): Promise<Interview> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, outcomeNotes })
    });
    
    const response = await fetchWithAuth(`${API_BASE}/interviews/${interviewId}/complete`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to complete interview');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error completing interview:', error);
    throw error;
  }
}

/**
 * Cancel an interview
 */
export async function cancelInterview(interviewId: string): Promise<Interview> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'POST' });
    const response = await fetchWithAuth(`${API_BASE}/interviews/${interviewId}/cancel`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to cancel interview');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error cancelling interview:', error);
    throw error;
  }
}

/**
 * Delete an interview
 */
export async function deleteInterview(interviewId: string): Promise<void> {
  try {
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'DELETE' });
    const response = await fetchWithAuth(`${API_BASE}/interviews/${interviewId}`, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to delete interview');
    }
  } catch (error) {
    logger.error('[pipelineService] Error deleting interview:', error);
    throw error;
  }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get pipeline statistics
 */
export async function getPipelineStats(filters?: {
  missionId?: string;
  clientId?: string;
}): Promise<PipelineStats> {
  try {
    const params = new URLSearchParams();
    if (filters?.missionId) params.append('missionId', filters.missionId);
    if (filters?.clientId) params.append('clientId', filters.clientId);
    
    const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
    const url = `${API_BASE}/stats${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetchWithAuth(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }
    
    return await response.json();
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline stats:', error);
    throw error;
  }
}

export default {
  getStages,
  addToPipeline,
  getPipelineById,
  getPipelineByResumeId,
  getPipelineByMissionId,
  getPipelineOverview,
  moveToStage,
  updatePipelineNotes,
  removeFromPipeline,
  getPipelineHistory,
  scheduleInterview,
  getInterviews,
  getUpcomingInterviews,
  updateInterview,
  completeInterview,
  cancelInterview,
  deleteInterview,
  getPipelineStats
};
