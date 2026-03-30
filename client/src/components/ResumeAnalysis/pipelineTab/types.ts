import type { PipelineEntry, PipelineHistory, PipelineStage, Interview } from '../../../services/pipelineService';

export interface Mission {
  id: string;
  title: string;
  client: string;
}

export interface Client {
  id: string;
  name: string;
  type?: string;
}

export interface NewPipelineState {
  missionId: string;
  clientId: string;
  notes: string;
}

export interface NewInterviewState {
  title: string;
  description: string;
  interviewType: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string;
  meetingLink: string;
  attendees: { name: string; email: string }[];
}

export interface InterviewOutcomeState {
  outcome: string;
  outcomeNotes: string;
}

export type PipelineTabTranslateFn = (key: string, options?: unknown) => string;
export type { PipelineEntry, PipelineHistory, PipelineStage, Interview };
