export interface AdaptationItem {
  id: string;
  mission_id: string;
  resume_id: string;
  resume_name?: string;
  candidate_name?: string;
  adapted_title?: string;
  match_score?: number;
  status?: string;
  created_at?: string;
}

export interface GroupedMission {
  id: string;
  title: string;
  status: string;
  client_name?: string;
  contact_name?: string;
  adaptations: AdaptationItem[];
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
  adaptations_count: number;
}

export interface GroupedData {
  deals: DealGroup[];
  unassigned: GroupedMission[];
  totalDeals: number;
  totalAssigned: number;
  totalUnassigned: number;
}
