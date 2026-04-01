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
