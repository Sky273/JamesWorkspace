/**
 * Market Radar Service
 * Frontend service for market radar API calls
 */

import {
  buildQueryString,
  getMarketRadarApiJson,
  postMarketRadarApiJson,
  TEN_MINUTES,
} from './marketRadarService.utils';

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
  const data = await postMarketRadarApiJson<{ summary: CollectionSummary }>('/collect', {}, THIRTY_MINUTES);
  return data.summary;
}

/**
 * Trigger collection for a specific source (admin only)
 * Returns immediately - collection runs in background on server
 */
export async function triggerSourceCollection(
  source: 'france_travail' | 'adzuna'
): Promise<{ success: boolean; message: string; jobId: string }> {
  return postMarketRadarApiJson(`/collect/${source}`);
}

/**
 * Get facts with optional filters and pagination
 */
export async function getFacts(params: FactsQueryParams = {}): Promise<FactsResponse> {
  const query = buildQueryString(params as Record<string, string | number | undefined>);
  return getMarketRadarApiJson<FactsResponse>(`/facts${query}`, TEN_MINUTES);
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
  return getMarketRadarApiJson<AllFactsResponse>('/facts/all', TEN_MINUTES);
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
  return getMarketRadarApiJson('/facts/filters', TEN_MINUTES);
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
  return getMarketRadarApiJson('/facts/summary', TEN_MINUTES);
}

/**
 * Get latest facts for a specific type
 * Uses 2 minute timeout for large datasets
 */
export async function getLatestFacts(
  type: string,
  source?: string
): Promise<{ success: boolean; facts: MarketFact[] }> {
  const query = buildQueryString({ source });
  return getMarketRadarApiJson(`/latest/${type}${query}`, TEN_MINUTES);
}

/**
 * Get trend data for a keyword
 */
export async function getKeywordTrend(
  keyword: string,
  days: number = 30
): Promise<TrendResponse> {
  return getMarketRadarApiJson(`/trend/${encodeURIComponent(keyword)}?days=${days}`);
}

/**
 * Get regional comparison
 */
export async function getRegionalComparison(
  date?: string,
  source?: string
): Promise<{ success: boolean; regions: MarketFact[] }> {
  const query = buildQueryString({ date, source });
  return getMarketRadarApiJson(`/regional${query}`);
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
  const query = buildQueryString(params as Record<string, string | number | undefined>);
  return getMarketRadarApiJson(`/search/france-travail${query}`);
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
  const query = buildQueryString(params);
  return getMarketRadarApiJson(`/search/adzuna${query}`);
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
  jobId: string;
  estimatedDuration: string;
}> {
  return postMarketRadarApiJson('/trends/collect');
}

/**
 * Trigger DYN_1 (employment dynamics) collection only - TEMPORARY
 * Returns immediately - collection runs in background on server
 */
export async function triggerDynamicsCollection(): Promise<{
  success: boolean;
  message: string;
  jobId: string;
  estimatedDuration: string;
}> {
  return postMarketRadarApiJson('/trends/collect-dynamics');
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
  const query = buildQueryString(params as Record<string, string | number | undefined>);
  return getMarketRadarApiJson(`/trends${query}`, TEN_MINUTES);
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
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return getMarketRadarApiJson(`/trends/all${query}`, TEN_MINUTES);
}

/**
 * Get metadata for a specific trend (on-demand loading for hover)
 */
export async function getTrendMetadata(trendId: string): Promise<{
  success: boolean;
  trend: MarketTrend;
}> {
  return getMarketRadarApiJson(`/trends/${encodeURIComponent(trendId)}/metadata`);
}

/**
 * Get available filter options for trends
 * Uses 2 minute timeout for large datasets
 */
export async function getTrendFilters(): Promise<{
  success: boolean;
  filters: TrendFilters;
}> {
  return getMarketRadarApiJson('/trends/filters', TEN_MINUTES);
}

/**
 * Get trends summary
 * Uses 2 minute timeout for large datasets
 */
export async function getTrendsSummary(): Promise<{
  success: boolean;
  summary: TrendsSummary;
}> {
  return getMarketRadarApiJson('/trends/summary', TEN_MINUTES);
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
  return getMarketRadarApiJson('/trends/audit');
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
  return getMarketRadarApiJson('/config');
}
