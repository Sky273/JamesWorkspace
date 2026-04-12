/**
 * Rome 4.0 Frontend Service
 * Handles API calls to Rome endpoints
 */

import { fetchWithAuth } from '../utils/apiInterceptor';
import { createAuthOptionsWithCsrf } from '../utils/apiInterceptor';

const API_BASE = '/api/rome';

// ============================================
// TYPES
// ============================================

export interface Competence {
  code: string;
  libelle: string;
  type?: string;
  enjeu?: string;
}

export interface Enjeu {
  code: string;
  libelle: string;
}

export interface Savoir {
  code: string;
  libelle: string;
  categorie?: string;
}

export interface Metier {
  id?: string;
  CodeRome: string;
  Libelle: string;
  Obsolete?: boolean;
  // New structured fields from Rome 4.0 Fiches Métiers API
  Enjeux?: Enjeu[];
  CompetencesDetaillees?: Competence[];
  MacroSavoirFaire?: Competence[];
  Savoirs?: Savoir[];
  FicheMetierJSON?: string;
  LastUpdated?: string;
}

export interface GrandDomaine {
  code: string;
  libelle: string;
}

export interface Domaine {
  code: string;
  libelle: string;
  codeGrandDomaine?: string;
}

export interface CollectionSummary {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ code: string; error: string }>;
}

export interface MetiersStats {
  totalMetiers: number;
  totalCompetences: number;
  totalCompetencesDetaillees: number;
  totalMacroSavoirFaire: number;
  totalSavoirs: number;
  lastUpdated: string | null;
}

// ============================================
// STORED METIERS (from database)
// ============================================

export interface MetiersQueryParams {
  codeRome?: string;
  grandDomaine?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  forceRefresh?: boolean;
}

export interface MetiersResponse {
  metiers: Metier[];
  totalCount: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  } | null;
}

/**
 * Get stored métiers from database (without pagination - returns array)
 * Uses 2 minute timeout for large datasets
 */
export async function getStoredMetiers(filters?: {
  codeRome?: string;
  grandDomaine?: string;
  search?: string;
  forceRefresh?: boolean;
}): Promise<Metier[]> {
  const TEN_MINUTES = 600000;
  
  const params = new URLSearchParams();
  if (filters?.codeRome) params.append('codeRome', filters.codeRome);
  if (filters?.grandDomaine) params.append('grandDomaine', filters.grandDomaine);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.forceRefresh) params.append('refresh', '1');

  const url = `${API_BASE}/metiers${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetchWithAuth(url, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch métiers');
  }

  const data = await response.json();
  return data.data || data.metiers || data;
}

/**
 * Get stored métiers from database with pagination
 * Uses 2 minute timeout for large datasets
 */
export async function getStoredMetiersPaginated(filters: MetiersQueryParams): Promise<MetiersResponse> {
  const TEN_MINUTES = 600000;
  
  const params = new URLSearchParams();
  if (filters.codeRome) params.append('codeRome', filters.codeRome);
  if (filters.grandDomaine) params.append('grandDomaine', filters.grandDomaine);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
  if (filters.forceRefresh) params.append('refresh', '1');
  // Always include details (Enjeux, CompetencesDetaillees, MacroSavoirFaire, Savoirs)
  params.append('includeDetails', 'true');

  const url = `${API_BASE}/metiers${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetchWithAuth(url, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch métiers');
  }

  const data = await response.json();
  
  // If pagination info is present
  if (data.pagination) {
    return {
      metiers: data.data || data.metiers,
      totalCount: data.pagination.totalCount,
      pagination: data.pagination
    };
  }
  
  // Fallback if no pagination
  const metiers = data.data || data.metiers || data;
  return {
    metiers,
    totalCount: metiers.length,
    pagination: null
  };
}

/**
 * Get global statistics for métiers (total count, total competences, last update)
 */
export async function getMetiersStats(): Promise<MetiersStats> {
  const response = await fetchWithAuth(`${API_BASE}/metiers/stats`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch métiers stats');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get a specific métier by code ROME
 */
export async function getMetierByCode(codeRome: string): Promise<Metier> {
  const response = await fetchWithAuth(`${API_BASE}/metiers/${codeRome}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Métier not found');
  }

  const data = await response.json();
  return data.data;
}

// ============================================
// API QUERIES (live from France Travail)
// ============================================

/**
 * Get grands domaines from Rome API
 */
export async function getGrandsDomaines(): Promise<GrandDomaine[]> {
  const response = await fetchWithAuth(`${API_BASE}/api/grands-domaines`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch grands domaines');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get domaines professionnels from Rome API
 */
export async function getDomaines(codeGrandDomaine?: string): Promise<Domaine[]> {
  const url = codeGrandDomaine 
    ? `${API_BASE}/api/domaines?codeGrandDomaine=${codeGrandDomaine}`
    : `${API_BASE}/api/domaines`;
  
  const response = await fetchWithAuth(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch domaines');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get IT métiers from Rome API (live query)
 */
export async function getITMetiersFromAPI(): Promise<unknown[]> {
  const response = await fetchWithAuth(`${API_BASE}/api/metiers/it`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch IT métiers');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get métier details from Rome API (live query)
 */
export async function getMetierFromAPI(codeRome: string): Promise<unknown> {
  const response = await fetchWithAuth(`${API_BASE}/api/metiers/${codeRome}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch métier');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get compétences for a métier from Rome API
 */
export async function getCompetencesFromAPI(codeRome: string): Promise<Competence[]> {
  const response = await fetchWithAuth(`${API_BASE}/api/metiers/${codeRome}/competences`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch compétences');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Search métiers by keyword
 */
export async function searchMetiers(query: string): Promise<unknown[]> {
  const response = await fetchWithAuth(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Search failed');
  }

  const data = await response.json();
  return data.data;
}

// ============================================
// ADMIN ACTIONS
// ============================================

/**
 * Trigger IT métiers collection (admin only)
 * Returns immediately - collection runs in background on server
 */
export async function collectITMetiers(): Promise<{ success: boolean; message: string; jobId: string }> {
  const options = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  const response = await fetchWithAuth(`${API_BASE}/collect`, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Collection failed');
  }

  return response.json();
}
