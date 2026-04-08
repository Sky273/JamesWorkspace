/**
 * Types and constants for DealsTab
 * Extracted from DealsTab.tsx
 */

export interface Deal {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'won' | 'lost' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client_id?: string;
  client_name?: string;
  client_type?: string;
  contact_id?: string;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
  expected_start_date?: string;
  expected_end_date?: string;
  budget_min?: number;
  budget_max?: number;
  notes?: string;
  resumes_count: number;
  missions_count: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  type: 'client' | 'prospect';
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface DealFormData {
  title: string;
  description?: string;
  client_id?: string;
  contact_id?: string;
  status: string;
  priority: string;
  expected_start_date?: string;
  expected_end_date?: string;
  budget_min?: number | '';
  budget_max?: number | '';
  notes?: string;
}

export interface DealsTabProps {
  preFilterClientId?: string;
}

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'En cours', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  won: { label: 'Gagnée', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  lost: { label: 'Perdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  on_hold: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' }
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  low: { label: 'Basse', color: 'text-gray-500', icon: '○' },
  medium: { label: 'Moyenne', color: 'text-blue-500', icon: '●' },
  high: { label: 'Haute', color: 'text-orange-500', icon: '●●' },
  urgent: { label: 'Urgente', color: 'text-red-500', icon: '●●●' }
};
