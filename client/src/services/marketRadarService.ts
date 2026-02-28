/**
 * Market Radar Service
 * Frontend service for market radar API calls
 */

import { fetchWithAuth, fetchWithCsrfRetry, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';

const API_BASE = '/api/market-radar';

export interface MarketFact {
  id: string;
  Date: string;
  Source: string;
  Region?: string;
  RegionCode?: string;
  Location?: string;
  Keyword?: string;
  RomeCode?: string;
  Type?: string;
  JobCount: number;
  MeanSalary?: number;
  Metadata?: Record<string, unknown>;
}

export interface CollectionSummary {
  startTime: string;
  endTime: string;
  duration: number;
  totalFacts: number;
  stored: number;
  failed: number;
  sources: {
    franceTravail?: {
      collected: number;
      stored: number;
      failed: number;
      status: string;
      error?: string;
    };
    adzuna?: {
      collected: number;
      stored: number;
      failed: number;
      status: string;
      error?: string;
    };
  };
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface FactsResponse {
  success: boolean;
  count: number;
  dateRange: { start: string; end: string };
  facts: MarketFact[];
  pagination?: PaginationInfo | null;
}

export interface FactsQueryParams {
  startDate?: string;
  endDate?: string;
  source?: string;
  region?: string;
  keyword?: string;
  location?: string;
  page?: number;
  pageSize?: number;
}

export interface TrendResponse {
  success: boolean;
  keyword: string;
  days: number;
  dataPoints: number;
  trend: Array<{
    date: string;
    source: string;
    jobCount: number;
    meanSalary?: number;
  }>;
}

export interface SearchResult {
  success: boolean;
  source: string;
  results: Array<{
    id: string;
    title?: string;
    intitule?: string;
    company?: string;
    entreprise?: { nom?: string };
    location?: string;
    lieuTravail?: { libelle?: string };
    salary?: string;
    salaire?: { libelle?: string };
    description?: string;
    url?: string;
    redirect_url?: string;
  }>;
  totalCount?: number;
  count?: number;
}

/**
 * Trigger full data collection (admin only)
 * Uses 30 minute timeout due to large number of API calls
 */
export async function triggerFullCollection(): Promise<CollectionSummary> {
  const THIRTY_MINUTES = 1800000;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), THIRTY_MINUTES);

  const options = await createAuthOptionsWithCsrf({
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  try {
    const response = await fetchWithCsrfRetry(`${API_BASE}/collect`, options, THIRTY_MINUTES);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Collection failed');
    }

    const data = await response.json();
    return data.summary;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Trigger collection for a specific source (admin only)
 * Uses 30 minute timeout due to large number of API calls
 */
export async function triggerSourceCollection(
  source: 'france_travail' | 'adzuna'
): Promise<CollectionSummary> {
  const THIRTY_MINUTES = 1800000;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), THIRTY_MINUTES);

  const options = await createAuthOptionsWithCsrf({
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  try {
    const response = await fetchWithCsrfRetry(`${API_BASE}/collect/${source}`, options, THIRTY_MINUTES);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Collection failed');
    }

    const data = await response.json();
    return data.summary;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get facts with optional filters and pagination
 */
export async function getFacts(params: FactsQueryParams = {}): Promise<FactsResponse> {
  const TEN_MINUTES = 600000;
  
  const queryParams = new URLSearchParams();
  if (params.startDate) queryParams.append('startDate', params.startDate);
  if (params.endDate) queryParams.append('endDate', params.endDate);
  if (params.source) queryParams.append('source', params.source);
  if (params.region) queryParams.append('region', params.region);
  if (params.keyword) queryParams.append('keyword', params.keyword);
  if (params.location) queryParams.append('location', params.location);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());

  const url = `${API_BASE}/facts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const response = await fetchWithAuth(url, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch facts');
  }

  return response.json();
}

/**
 * Response type for getAllFacts
 */
export interface AllFactsResponse {
  success: boolean;
  facts: MarketFact[];
  totalCount: number;
  duration: number;
}

/**
 * Get ALL facts data (no pagination, uses server cache)
 */
export async function getAllFacts(): Promise<AllFactsResponse> {
  const TEN_MINUTES = 600000;
  
  const response = await fetchWithAuth(`${API_BASE}/facts/all`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch all facts');
  }

  return response.json();
}

/**
 * Facts filter options type
 */
export interface FactsFilters {
  sources: string[];
  regions: string[];
  keywords: string[];
  locations: string[];
}

/**
 * Get available filter options for facts
 */
export async function getFactsFilters(): Promise<{
  success: boolean;
  filters: FactsFilters;
}> {
  const TEN_MINUTES = 600000;
  
  const response = await fetchWithAuth(`${API_BASE}/facts/filters`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch facts filters');
  }

  return response.json();
}

/**
 * Facts summary type
 */
export interface FactsSummary {
  totalRecords: number;
  totalJobs: number;
  totalRegions: number;
  totalKeywords: number;
  sources: { source: string; count: number; totalJobs: number; latestDate: string }[];
  regions: string[];
  keywords: string[];
}

/**
 * Get facts summary
 */
export async function getFactsSummary(): Promise<{
  success: boolean;
  summary: FactsSummary;
}> {
  const TEN_MINUTES = 600000;
  
  const response = await fetchWithAuth(`${API_BASE}/facts/summary`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch facts summary');
  }

  return response.json();
}

/**
 * Get latest facts for a specific type
 * Uses 2 minute timeout for large datasets
 */
export async function getLatestFacts(
  type: string,
  source?: string
): Promise<{ success: boolean; facts: MarketFact[] }> {
  const TEN_MINUTES = 600000;
  
  const queryParams = source ? `?source=${source}` : '';
  const response = await fetchWithAuth(`${API_BASE}/latest/${type}${queryParams}`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch latest facts');
  }

  return response.json();
}

/**
 * Get trend data for a keyword
 */
export async function getKeywordTrend(
  keyword: string,
  days: number = 30
): Promise<TrendResponse> {
  const response = await fetchWithAuth(`${API_BASE}/trend/${encodeURIComponent(keyword)}?days=${days}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch trend');
  }

  return response.json();
}

/**
 * Get regional comparison
 */
export async function getRegionalComparison(
  date?: string,
  source?: string
): Promise<{ success: boolean; regions: MarketFact[] }> {
  const queryParams = new URLSearchParams();
  if (date) queryParams.append('date', date);
  if (source) queryParams.append('source', source);

  const url = `${API_BASE}/regional${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const response = await fetchWithAuth(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch regional data');
  }

  return response.json();
}

/**
 * Live search on France Travail
 */
export async function searchFranceTravail(params: {
  motsCles?: string;
  codeROME?: string;
  departement?: string;
  region?: string;
  typeContrat?: string;
}): Promise<SearchResult> {
  const queryParams = new URLSearchParams();
  if (params.motsCles) queryParams.append('motsCles', params.motsCles);
  if (params.codeROME) queryParams.append('codeROME', params.codeROME);
  if (params.departement) queryParams.append('departement', params.departement);
  if (params.region) queryParams.append('region', params.region);
  if (params.typeContrat) queryParams.append('typeContrat', params.typeContrat);

  const response = await fetchWithAuth(`${API_BASE}/search/france-travail?${queryParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Search failed');
  }

  return response.json();
}

/**
 * Live search on Adzuna
 */
export async function searchAdzuna(params: {
  what?: string;
  where?: string;
  category?: string;
  salary_min?: number;
  salary_max?: number;
}): Promise<SearchResult> {
  const queryParams = new URLSearchParams();
  if (params.what) queryParams.append('what', params.what);
  if (params.where) queryParams.append('where', params.where);
  if (params.category) queryParams.append('category', params.category);
  if (params.salary_min) queryParams.append('salary_min', params.salary_min.toString());
  if (params.salary_max) queryParams.append('salary_max', params.salary_max.toString());

  const response = await fetchWithAuth(`${API_BASE}/search/adzuna?${queryParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Search failed');
  }

  return response.json();
}

// ============================================
// MARKET TRENDS
// ============================================

export interface MarketTrend {
  id: string;
  Date: string;
  Type: string;
  CodeRome?: string;
  RomeLabel?: string;
  Region?: string;
  RegionCode?: string;
  Secteur?: string;
  Value?: number;
  ValueLabel?: string;
  Metadata?: Record<string, unknown>;
  // Audit fields
  CollectedAt?: string;
  ApiEndpoint?: string;
  QuarterPeriod?: string;
  ApiResponseHash?: string;
  PreviousValue?: number;
}

export interface TrendsSummary {
  totalRecords: number;
  types: Array<{ 
    type: string; 
    count: number; 
    latestDate?: string;
    aggregatedValue?: number;
    isSumType?: boolean;
    valueCount?: number;  // Number of records with valid (non-null) values
  }>;
  regions: string[];
  romeCodes: string[];
}

export interface TrendFilters {
  types: string[];
  regions: Array<{ code: string; name: string }>;
  romeCodes: string[];
}

// PaginationInfo removed - using server-side filtering without pagination

/**
 * Trigger market trends collection (fire-and-forget)
 * Returns immediately - collection runs in background on server
 */
export async function triggerTrendsCollection(): Promise<{
  success: boolean;
  message: string;
  estimatedDuration: string;
}> {
  const options = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  const response = await fetchWithAuth(`${API_BASE}/trends/collect`, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start trends collection');
  }

  return response.json();
}

/**
 * Trigger DYN_1 (employment dynamics) collection only - TEMPORARY
 * Returns immediately - collection runs in background on server
 */
export async function triggerDynamicsCollection(): Promise<{
  success: boolean;
  message: string;
  estimatedDuration: string;
}> {
  const options = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  const response = await fetchWithAuth(`${API_BASE}/trends/collect-dynamics`, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start dynamics collection');
  }

  return response.json();
}

export interface TrendsQueryParams {
  type?: string;
  codeRome?: string;
  regionCode?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface TrendsResponse {
  success: boolean;
  grouped?: boolean;
  // When grouped is false or undefined (single type filter)
  trends?: MarketTrend[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  } | null;
  // When grouped is true (no type filter)
  groupedTrends?: Record<string, MarketTrend[]>;
  countsByType?: Record<string, number>;
  totalCount: number;
}

/**
 * Get stored market trends with server-side filters and pagination
 */
export async function getTrends(params: TrendsQueryParams = {}): Promise<TrendsResponse> {
  const TEN_MINUTES = 600000;
  
  const queryParams = new URLSearchParams();
  if (params.type) queryParams.append('type', params.type);
  if (params.codeRome) queryParams.append('codeRome', params.codeRome);
  if (params.regionCode) queryParams.append('regionCode', params.regionCode);
  if (params.sortField) queryParams.append('sortField', params.sortField);
  if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());

  const response = await fetchWithAuth(`${API_BASE}/trends?${queryParams.toString()}`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch trends');
  }

  return response.json();
}

/**
 * Response type for getAllTrends
 */
export interface AllTrendsResponse {
  success: boolean;
  trends: MarketTrend[];
  byType: Record<string, MarketTrend[]>;
  totalCount: number;
  duration: number;
}

/**
 * Get ALL trends data for map view (no pagination, NO metadata)
 * Optimized for PostgreSQL - direct query without loading metadata
 * Returns all trends grouped by type for efficient map rendering
 * @param type - Optional type filter for specific trend type
 */
export async function getAllTrends(type?: string): Promise<AllTrendsResponse> {
  const TEN_MINUTES = 600000;
  
  const queryParams = type ? `?type=${encodeURIComponent(type)}` : '';
  const response = await fetchWithAuth(`${API_BASE}/trends/all${queryParams}`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch all trends');
  }

  return response.json();
}

/**
 * Get metadata for a specific trend (on-demand loading for hover)
 */
export async function getTrendMetadata(trendId: string): Promise<{
  success: boolean;
  trend: MarketTrend;
}> {
  const response = await fetchWithAuth(`${API_BASE}/trends/${encodeURIComponent(trendId)}/metadata`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch trend metadata');
  }

  return response.json();
}

/**
 * Get available filter options for trends
 * Uses 2 minute timeout for large datasets
 */
export async function getTrendFilters(): Promise<{
  success: boolean;
  filters: TrendFilters;
}> {
  const TEN_MINUTES = 600000;
  
  const response = await fetchWithAuth(`${API_BASE}/trends/filters`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch trend filters');
  }

  return response.json();
}

/**
 * Get trends summary
 * Uses 2 minute timeout for large datasets
 */
export async function getTrendsSummary(): Promise<{
  success: boolean;
  summary: TrendsSummary;
}> {
  const TEN_MINUTES = 600000;
  
  const response = await fetchWithAuth(`${API_BASE}/trends/summary`, {}, TEN_MINUTES);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch trends summary');
  }

  return response.json();
}

/**
 * Audit report interface
 */
export interface TrendsAuditReport {
  overall: {
    total_records: number;
    total_types: number;
    total_regions: number;
    total_rome_codes: number;
    oldest_data: string;
    newest_data: string;
  };
  byType: Array<{
    type: string;
    totalRecords: number;
    oldestCollection: string;
    newestCollection: string;
    freshness: {
      fresh: number;
      recent: number;
      stale: number;
    };
    updatedRecords: number;
    avgChangePercent: string | null;
  }>;
  significantChanges: Array<{
    type: string;
    regionCode: string;
    codeRome: string;
    romeLabel: string;
    previousValue: number;
    currentValue: number;
    changePercent: number;
    collectedAt: string;
  }>;
}

/**
 * Get trends audit report (admin only)
 */
export async function getTrendsAudit(): Promise<{
  success: boolean;
  audit: TrendsAuditReport;
  generatedAt: string;
}> {
  const response = await fetchWithAuth(`${API_BASE}/trends/audit`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch audit report');
  }

  return response.json();
}

/**
 * Get radar configuration
 */
export async function getRadarConfig(): Promise<{
  success: boolean;
  config: {
    romeCodes: string[];
    regions: Array<{ code: string; name: string }>;
    keywords: {
      franceTravail: string[];
      adzuna: string[];
    };
  };
}> {
  const response = await fetchWithAuth(`${API_BASE}/config`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch config');
  }

  return response.json();
}
