export interface GroupedMission {
  id: string;
  title: string;
  content?: string;
  status: string;
  keywords?: string;
  required_skills?: string;
  preferred_skills?: string;
  created_at: string;
  updated_at?: string;
  firm?: string;
  client_id?: string;
  contact_id?: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
  adaptations_count: number;
}

export interface DealGroup {
  id: string;
  title: string;
  status: string;
  priority: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  missions: GroupedMission[];
  missions_count: number;
  resumes_count: number;
}

export interface GroupedData {
  deals: DealGroup[];
  unassigned: GroupedMission[];
  totalDeals: number;
  totalAssigned: number;
  totalUnassigned: number;
}

export interface MissionsDealsGroupedViewProps {
  onAddMission: () => void;
}
