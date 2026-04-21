/**
 * Pipeline Service
 * Frontend service for managing candidate selection pipeline and interviews
 */

import logger from '../utils/logger.frontend';
import {
  buildPipelineQuery,
  fetchPipelineApiJson,
  fetchPipelineApiVoid,
} from './pipelineService.utils';

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
  adaptation_id?: string | null;
  has_mission_adaptation?: boolean;
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
    return await fetchPipelineApiJson<PipelineStage[]>('/stages', { fallbackMessage: 'Failed to fetch pipeline stages' });
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
  adaptationId?: string;
  missionId?: string;
  clientId?: string;
  stage?: string;
  notes?: string;
}): Promise<PipelineEntry> {
  try {
    return await fetchPipelineApiJson<PipelineEntry>('', {
      method: 'POST',
      body: data,
      fallbackMessage: 'Failed to add to pipeline',
    });
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
    return await fetchPipelineApiJson<PipelineEntry>(`/${pipelineId}`, { fallbackMessage: 'Pipeline entry not found' });
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline entry:', error);
    throw error;
  }
}

/**
 * Get all pipeline entries for a resume
 */
export async function getPipelineByResumeId(
  resumeId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<PipelineEntry[]> {
  try {
    const suffix = options.forceRefresh ? '?refresh=1' : '';
    return await fetchPipelineApiJson<PipelineEntry[]>(`/resume/${resumeId}${suffix}`, { fallbackMessage: 'Failed to fetch pipeline entries' });
  } catch (error) {
    logger.error('[pipelineService] Error fetching pipeline for resume:', error);
    throw error;
  }
}

/**
 * Get all pipeline entries for a mission
 */
export async function getPipelineByMissionId(
  missionId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<PipelineEntry[]> {
  try {
    const suffix = options.forceRefresh ? '?refresh=1' : '';
    return await fetchPipelineApiJson<PipelineEntry[]>(`/mission/${missionId}${suffix}`, { fallbackMessage: 'Failed to fetch pipeline entries' });
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
    const query = buildPipelineQuery(filters);
    return await fetchPipelineApiJson<PipelineOverview>(`/overview${query}`, { fallbackMessage: 'Failed to fetch pipeline overview' });
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
    return await fetchPipelineApiJson<PipelineEntry>(`/${pipelineId}/stage`, {
      method: 'PATCH',
      body: { stage, notes },
      fallbackMessage: 'Failed to update stage',
    });
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
    return await fetchPipelineApiJson<PipelineEntry>(`/${pipelineId}/notes`, {
      method: 'PATCH',
      body: { notes },
      fallbackMessage: 'Failed to update notes',
    });
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
    await fetchPipelineApiVoid(`/${pipelineId}`, 'DELETE', 'Failed to remove from pipeline');
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
    return await fetchPipelineApiJson<PipelineHistory[]>(`/${pipelineId}/history`, { fallbackMessage: 'Failed to fetch history' });
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
    return await fetchPipelineApiJson<Interview>(`/${pipelineId}/interviews`, {
      method: 'POST',
      body: data,
      fallbackMessage: 'Failed to schedule interview',
    });
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
    return await fetchPipelineApiJson<Interview[]>(`/${pipelineId}/interviews`, { fallbackMessage: 'Failed to fetch interviews' });
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
    const query = buildPipelineQuery({ days });
    return await fetchPipelineApiJson<Interview[]>(`/interviews/upcoming${query}`, { fallbackMessage: 'Failed to fetch upcoming interviews' });
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
    return await fetchPipelineApiJson<Interview>(`/interviews/${interviewId}`, {
      method: 'PATCH',
      body: updates as Record<string, unknown>,
      fallbackMessage: 'Failed to update interview',
    });
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
    return await fetchPipelineApiJson<Interview>(`/interviews/${interviewId}/complete`, {
      method: 'POST',
      body: { outcome, outcomeNotes },
      fallbackMessage: 'Failed to complete interview',
    });
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
    return await fetchPipelineApiJson<Interview>(`/interviews/${interviewId}/cancel`, {
      method: 'POST',
      fallbackMessage: 'Failed to cancel interview',
    });
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
    await fetchPipelineApiVoid(`/interviews/${interviewId}`, 'DELETE', 'Failed to delete interview');
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
    const query = buildPipelineQuery(filters);
    return await fetchPipelineApiJson<PipelineStats>(`/stats${query}`, { fallbackMessage: 'Failed to fetch statistics' });
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
