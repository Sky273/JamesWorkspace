import type { Resume } from '../../types/entities';
import type { Deal } from './dealsTab.types';

export interface DealMission {
  id: string;
  title: string;
  status?: string;
  deal_id?: string | null;
  deal_title?: string;
  client_name?: string;
  contact_name?: string;
  contact_role?: string;
  created_at?: string;
  adaptations_count?: number;
}

export type DealResume = Resume & {
  deal_status?: string;
  deal_notes?: string;
  added_at?: string;
  added_by_name?: string;
};

export interface DealDetail extends Deal {
  notes?: string;
}

function getString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function getNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const normalizedValue = Number.parseFloat(value.replace(',', '.'));
      if (Number.isFinite(normalizedValue)) {
        return normalizedValue;
      }
    }
  }
  return undefined;
}

function getScoreString(source: Record<string, unknown>, keys: string[]): string | undefined {
  const score = getNumber(source, keys);
  return score === undefined ? undefined : String(score);
}

export function normalizeDeal(payload: Record<string, unknown>): DealDetail {
  return {
    id: getString(payload, ['id', 'ID']) || '',
    title: getString(payload, ['title', 'Title']) || '',
    description: getString(payload, ['description', 'Description']),
    status: (getString(payload, ['status', 'Status']) as Deal['status']) || 'open',
    priority: (getString(payload, ['priority', 'Priority']) as Deal['priority']) || 'medium',
    client_id: getString(payload, ['client_id', 'clientId']),
    client_name: getString(payload, ['client_name', 'clientName', 'Client Name']),
    client_type: getString(payload, ['client_type', 'clientType', 'Client Type']),
    contact_id: getString(payload, ['contact_id', 'contactId']),
    contact_name: getString(payload, ['contact_name', 'contactName', 'Contact Name']),
    contact_email: getString(payload, ['contact_email', 'contactEmail', 'Contact Email']),
    contact_role: getString(payload, ['contact_role', 'contactRole', 'Contact Role']),
    expected_start_date: getString(payload, ['expected_start_date', 'expectedStartDate', 'Expected Start Date']),
    expected_end_date: getString(payload, ['expected_end_date', 'expectedEndDate', 'Expected End Date']),
    budget_min: getNumber(payload, ['budget_min', 'budgetMin']),
    budget_max: getNumber(payload, ['budget_max', 'budgetMax']),
    resumes_count: getNumber(payload, ['resumes_count', 'resumesCount']) || 0,
    missions_count: getNumber(payload, ['missions_count', 'missionsCount']) || 0,
    created_at: getString(payload, ['created_at', 'createdAt', 'Created At']) || '',
    updated_at: getString(payload, ['updated_at', 'updatedAt', 'Updated At']) || '',
    notes: getString(payload, ['notes', 'Notes']),
  };
}

export function normalizeMission(payload: Record<string, unknown>): DealMission {
  return {
    id: getString(payload, ['id', 'ID']) || '',
    title: getString(payload, ['title', 'Title']) || '',
    status: getString(payload, ['status', 'Status']),
    deal_id: getString(payload, ['deal_id', 'dealId']) || null,
    deal_title: getString(payload, ['deal_title', 'dealTitle', 'Deal Title']),
    client_name: getString(payload, ['client_name', 'clientName', 'Client Name']),
    contact_name: getString(payload, ['contact_name', 'contactName', 'Contact Name']),
    contact_role: getString(payload, ['contact_role', 'contactRole', 'Contact Role']),
    created_at: getString(payload, ['created_at', 'createdAt', 'Created At']),
    adaptations_count: getNumber(payload, ['adaptations_count', 'adaptationsCount']),
  };
}

export function normalizeResume(payload: Record<string, unknown>): DealResume {
  return {
    id: getString(payload, ['id', 'ID']) || '',
    Name: getString(payload, ['name', 'Name', 'filename', 'Filename', 'file_name', 'File Name']) || '',
    Title: getString(payload, ['title', 'Title']),
    Status: (getString(payload, ['status', 'Status']) as Resume['Status']) || undefined,
    'Global Rating': getScoreString(payload, ['global_rating', 'globalRating', 'Global Rating']),
    'Improved Global Rating': getScoreString(payload, ['improved_global_rating', 'improvedGlobalRating', 'Improved Global Rating']),
    Skills: getString(payload, ['skills', 'Skills']),
    Industries: getString(payload, ['industries', 'Industries']),
    Tools: getString(payload, ['tools', 'Tools']),
    'Soft Skills': getString(payload, ['soft_skills', 'softSkills', 'Soft Skills']),
    FirmName: getString(payload, ['firm_name', 'firmName', 'FirmName']),
    'Created At': getString(payload, ['created_at', 'createdAt', 'Created At']),
    candidate_name: getString(payload, ['candidate_name', 'candidateName']),
    candidate_email: getString(payload, ['candidate_email', 'candidateEmail']),
    consent_status: (getString(payload, ['consent_status', 'consentStatus']) as Resume['consent_status']) || undefined,
    consent_token_expires_at: getString(payload, ['consent_token_expires_at', 'consentTokenExpiresAt']) || null,
    retention_until: getString(payload, ['retention_until', 'retentionUntil']) || null,
    deal_status: getString(payload, ['deal_status', 'dealStatus']),
    deal_notes: getString(payload, ['deal_notes', 'dealNotes']),
    added_at: getString(payload, ['added_at', 'addedAt']),
    added_by_name: getString(payload, ['added_by_name', 'addedByName']),
  };
}
