export interface Resume {
  id: string;
  Name: string;
  Title?: string;
  'Global Score'?: number;
  Tags?: string[];
}

export interface AdaptationOption {
  id: string;
  resumeId: string;
  resumeName: string;
  candidateName?: string;
  adaptedTitle?: string;
  matchScore?: number;
  status?: string;
}

export interface CandidateOption {
  id: string;
  resumeId: string;
  name: string;
  title?: string;
  score?: number;
  tags?: string[];
  source: 'resume' | 'adaptation';
  hasMissionAdaptation?: boolean;
  adaptationId?: string;
  adaptationStatus?: string;
}

export interface MissionPipelineKanbanProps {
  missionId: string;
  missionTitle: string;
  onClose?: () => void;
}

export interface InterviewFormValues {
  title: string;
  description: string;
  interviewType: 'client' | 'partner' | 'technical' | 'hr';
  scheduledAt: string;
  durationMinutes: number;
  location: string;
  meetingLink: string;
}
