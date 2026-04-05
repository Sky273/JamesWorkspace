export interface Resume {
  id: string;
  Name: string;
  Title?: string;
  'Global Score'?: number;
  Tags?: string[];
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
