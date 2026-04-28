export interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  'Firm ID'?: string;
  'Created At'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  'Client ID'?: string;
  'Client Name'?: string;
  'Client Type'?: string;
  'Contact ID'?: string;
  'Contact Name'?: string;
  'Contact Email'?: string;
  'Contact Role'?: string;
  'Deal ID'?: string;
  'Deal Title'?: string;
  'Deal Status'?: string;
  'Adaptations Count'?: number;
  'Submissions Count'?: number;
  'Pipeline Count'?: number;
  'Has Attachments'?: boolean;
  [key: string]: unknown;
}

export interface Client {
  id: string;
  name: string;
  type: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface Deal {
  id: string;
  title: string;
  status: string;
  client_id?: string;
  client_name?: string;
}

export interface MissionFormData {
  Title: string;
  Content: string;
  Status: 'Active' | 'Closed' | 'Draft';
  'Client ID': string;
  'Contact ID': string;
  'Firm ID': string;
  'Deal ID': string;
}

export interface MissionStats {
  total: number;
  firms: number;
  linkedDeals: number;
  active: number;
  draft: number;
  closed: number;
}

export type MissionViewMode = 'list' | 'byDeal';

export const EMPTY_MISSION_FORM: MissionFormData = {
  Title: '',
  Content: '',
  Status: 'Active',
  'Client ID': '',
  'Contact ID': '',
  'Firm ID': '',
  'Deal ID': '',
};

export function getInitialMissionViewMode(viewMode?: string | null): MissionViewMode {
  return viewMode === 'byDeal' ? 'byDeal' : 'list';
}

export function buildMissionsSearchParams(page: number, limit: number, search: string) {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('limit', String(limit));

  if (search) {
    params.append('search', search);
  }

  return params;
}

export function buildMissionFormData(mission: Mission): MissionFormData {
  return {
    Title: mission.Title || '',
    Content: mission.Content || '',
    Status: mission.Status || 'Active',
    'Client ID': mission['Client ID'] || '',
    'Contact ID': mission['Contact ID'] || '',
    'Firm ID': mission['Firm ID'] || '',
    'Deal ID': mission['Deal ID'] || '',
  };
}

export function buildMissionSubmitPayload(formData: MissionFormData) {
  const dataToSend: Record<string, unknown> = {
    Title: formData.Title,
    Content: formData.Content,
    Status: formData.Status,
    'Client ID': formData['Client ID'] || null,
    'Contact ID': formData['Contact ID'] || null,
    'Deal ID': formData['Deal ID'] || null,
  };

  if (formData['Firm ID']) {
    dataToSend.firm_id = formData['Firm ID'];
  }

  return dataToSend;
}

export function computeMissionStats(missions: Mission[], totalCount: number): MissionStats {
  return {
    total: totalCount,
    firms: [...new Set(missions.map((mission) => mission.Firm).filter(Boolean))].length,
    linkedDeals: missions.filter((mission) => mission['Deal ID']).length,
    active: missions.filter((mission) => mission.Status === 'Active').length,
    draft: missions.filter((mission) => mission.Status === 'Draft').length,
    closed: missions.filter((mission) => mission.Status === 'Closed').length,
  };
}

export function canDeleteMission(mission: Mission | null | undefined): boolean {
  if (!mission) {
    return false;
  }

  return !mission['Has Attachments']
    && Number(mission['Adaptations Count'] || 0) === 0
    && Number(mission['Submissions Count'] || 0) === 0
    && Number(mission['Pipeline Count'] || 0) === 0;
}

export function mergePreservedMissionIntoResults(
  missions: Mission[],
  preservedMission: Mission | null | undefined,
  pageSize: number,
): Mission[] {
  if (!preservedMission?.id) {
    return missions;
  }

  const existingIndex = missions.findIndex((mission) => mission.id === preservedMission.id);
  if (existingIndex >= 0) {
    return missions.map((mission) => (
      mission.id === preservedMission.id ? preservedMission : mission
    ));
  }

  return [preservedMission, ...missions].slice(0, pageSize);
}
