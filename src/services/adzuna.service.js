/**
 * Adzuna API Service
 * Handles job search and salary data collection for France
 * API Documentation: https://developer.adzuna.com/
 */

import axios from 'axios';
import { 
    ADZUNA_APP_ID, 
    ADZUNA_APP_KEY,
    ADZUNA_API_URL
} from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

// ============================================
// API CONFIGURATION
// ============================================

const COUNTRY_CODE = 'fr'; // France

/**
 * Check if Adzuna API is configured
 */
function isConfigured() {
    return !!(ADZUNA_APP_ID && ADZUNA_APP_KEY);
}

/**
 * Build base URL for Adzuna API
 */
function buildUrl(endpoint) {
    return `${ADZUNA_API_URL}/jobs/${COUNTRY_CODE}/${endpoint}`;
}

/**
 * Add authentication params to URL
 */
function addAuthParams(params = {}) {
    return {
        ...params,
        app_id: ADZUNA_APP_ID,
        app_key: ADZUNA_APP_KEY
    };
}

// ============================================
// API CALLS
// ============================================

/**
 * Search job listings
 * @param {Object} params - Search parameters
 * @param {string} params.what - Keywords to search
 * @param {string} params.where - Location (city, region)
 * @param {number} params.page - Page number (1-indexed)
 * @param {number} params.results_per_page - Results per page (max 50)
 * @param {string} params.category - Job category
 * @param {number} params.salary_min - Minimum salary
 * @param {number} params.salary_max - Maximum salary
 * @param {string} params.sort_by - Sort order (date, salary, relevance)
 * @returns {Object} - Search results
 */
async function searchJobs(params = {}) {
    if (!isConfigured()) {
        throw new Error('Adzuna API credentials not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY in environment variables.');
    }

    try {
        const page = params.page || 1;
        const url = buildUrl(`search/${page}`);
        
        const queryParams = addAuthParams({
            results_per_page: params.results_per_page || 50,
            content_type: 'application/json'
        });

        // Add optional search parameters
        if (params.what) queryParams.what = params.what;
        if (params.where) queryParams.where = params.where;
        if (params.category) queryParams.category = params.category;
        if (params.salary_min) queryParams.salary_min = params.salary_min;
        if (params.salary_max) queryParams.salary_max = params.salary_max;
        if (params.sort_by) queryParams.sort_by = params.sort_by;
        if (params.max_days_old) queryParams.max_days_old = params.max_days_old;
        if (params.full_time) queryParams.full_time = params.full_time;
        if (params.permanent) queryParams.permanent = params.permanent;

        safeLog('debug', 'Adzuna: Searching jobs', { params: queryParams, url });

        const response = await axios.get(url, { params: queryParams });

        safeLog('info', 'Adzuna: Search completed', {
            count: response.data.count,
            resultsReturned: response.data.results?.length || 0
        });

        return {
            count: response.data.count,
            results: response.data.results || [],
            mean: response.data.mean,
            location: response.data.location
        };
    } catch (error) {
        safeLog('error', 'Adzuna: Search failed', {
            error: error.message,
            response: error.response?.data
        });
        throw error;
    }
}

/**
 * Get job categories
 * @returns {Array} - List of categories
 */
async function getCategories() {
    if (!isConfigured()) {
        throw new Error('Adzuna API credentials not configured.');
    }

    try {
        const url = buildUrl('categories');
        const response = await axios.get(url, { 
            params: addAuthParams() 
        });

        return response.data.results || [];
    } catch (error) {
        safeLog('error', 'Adzuna: Categories fetch failed', { error: error.message });
        throw error;
    }
}

/**
 * Get salary histogram for a job search
 * @param {Object} params - Search parameters
 * @returns {Object} - Salary distribution histogram
 */
async function getSalaryHistogram(params = {}) {
    if (!isConfigured()) {
        throw new Error('Adzuna API credentials not configured.');
    }

    try {
        const url = buildUrl('histogram');
        const queryParams = addAuthParams({});
        
        if (params.what) queryParams.what = params.what;
        if (params.where) queryParams.where = params.where;
        if (params.category) queryParams.category = params.category;

        const response = await axios.get(url, { params: queryParams });

        return {
            histogram: response.data.histogram || {},
            location: response.data.location
        };
    } catch (error) {
        safeLog('error', 'Adzuna: Histogram fetch failed', { error: error.message });
        throw error;
    }
}

/**
 * Get historical salary data
 * @param {Object} params - Search parameters
 * @param {number} params.months - Number of months of history
 * @returns {Object} - Historical salary data
 */
async function getHistoricalSalary(params = {}) {
    if (!isConfigured()) {
        throw new Error('Adzuna API credentials not configured.');
    }

    try {
        const url = buildUrl('history');
        const queryParams = addAuthParams({
            months: params.months || 12
        });
        
        if (params.what) queryParams.what = params.what;
        if (params.where) queryParams.where = params.where;
        if (params.category) queryParams.category = params.category;

        const response = await axios.get(url, { params: queryParams });

        return {
            month: response.data.month || {},
            location: response.data.location
        };
    } catch (error) {
        safeLog('error', 'Adzuna: Historical salary fetch failed', { error: error.message });
        throw error;
    }
}

/**
 * Get top companies hiring
 * @param {Object} params - Search parameters
 * @returns {Object} - Top companies data
 */
async function getTopCompanies(params = {}) {
    if (!isConfigured()) {
        throw new Error('Adzuna API credentials not configured.');
    }

    try {
        const url = buildUrl('top_companies');
        const queryParams = addAuthParams({});
        
        if (params.what) queryParams.what = params.what;
        if (params.where) queryParams.where = params.where;

        const response = await axios.get(url, { params: queryParams });

        return {
            leaderboard: response.data.leaderboard || [],
            location: response.data.location
        };
    } catch (error) {
        safeLog('error', 'Adzuna: Top companies fetch failed', { error: error.message });
        throw error;
    }
}

/**
 * Get regional job data
 * @param {Object} params - Search parameters
 * @returns {Object} - Regional data
 */
async function getRegionalData(params = {}) {
    if (!isConfigured()) {
        throw new Error('Adzuna API credentials not configured.');
    }

    try {
        const url = buildUrl('geodata');
        const queryParams = addAuthParams({});
        
        if (params.what) queryParams.what = params.what;
        if (params.category) queryParams.category = params.category;

        const response = await axios.get(url, { params: queryParams });

        return {
            locations: response.data.locations || [],
            location: response.data.location
        };
    } catch (error) {
        safeLog('error', 'Adzuna: Regional data fetch failed', { error: error.message });
        throw error;
    }
}

// ============================================
// DATA COLLECTION FOR MARKET RADAR
// ============================================

// IT-related categories in Adzuna
const IT_CATEGORIES = [
    'it-jobs',
    'engineering-jobs'
];

// French regions/cities to track
const FRENCH_LOCATIONS = [
    { name: 'Paris', code: 'paris' },
    { name: 'Lyon', code: 'lyon' },
    { name: 'Marseille', code: 'marseille' },
    { name: 'Toulouse', code: 'toulouse' },
    { name: 'Bordeaux', code: 'bordeaux' },
    { name: 'Nantes', code: 'nantes' },
    { name: 'Lille', code: 'lille' },
    { name: 'Strasbourg', code: 'strasbourg' },
    { name: 'Nice', code: 'nice' },
    { name: 'Rennes', code: 'rennes' },
    { name: 'Montpellier', code: 'montpellier' },
    { name: 'Grenoble', code: 'grenoble' }
];

// IT Skills/Keywords to track (same as France Travail for consistency)
const IT_KEYWORDS = [
    'javascript', 'typescript', 'react', 'angular', 'vue',
    'node.js', 'python', 'java', 'c#', '.net',
    'php', 'ruby', 'go', 'rust', 'kotlin',
    'aws', 'azure', 'gcp', 'cloud', 'devops',
    'docker', 'kubernetes', 'terraform',
    'sql', 'postgresql', 'mongodb',
    'machine learning', 'data science',
    'cybersecurity', 'security',
    'agile', 'scrum',
    'fullstack', 'frontend', 'backend',
    'ios', 'android', 'mobile'
];

/**
 * Collect market facts for IT jobs from Adzuna
 * @param {Object} options - Collection options
 * @returns {Array} - Collected facts
 */
async function collectMarketFacts(options = {}) {
    if (!isConfigured()) {
        safeLog('warn', 'Adzuna: API not configured, skipping collection');
        return [];
    }

    const locations = options.locations || FRENCH_LOCATIONS;
    const keywords = options.keywords || IT_KEYWORDS.slice(0, 15);
    const categories = options.categories || IT_CATEGORIES;
    
    const facts = [];
    const collectionDate = new Date().toISOString().split('T')[0];
    
    safeLog('info', 'Adzuna: Starting market facts collection', {
        locationsCount: locations.length,
        keywordsCount: keywords.length,
        categoriesCount: categories.length
    });

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Collect by location and category
    for (const category of categories) {
        for (const location of locations) {
            try {
                await delay(200); // Rate limiting
                
                const result = await searchJobs({
                    category,
                    where: location.code,
                    results_per_page: 1
                });

                // Get salary histogram for this location/category
                let salaryData = null;
                try {
                    await delay(200);
                    salaryData = await getSalaryHistogram({
                        category,
                        where: location.code
                    });
                } catch (e) {
                    // Salary data might not be available
                }

                facts.push({
                    date: collectionDate,
                    source: 'adzuna',
                    type: 'category_location',
                    category,
                    location: location.name,
                    locationCode: location.code,
                    jobCount: result.count,
                    meanSalary: result.mean || null,
                    salaryHistogram: salaryData?.histogram || null,
                    metadata: {}
                });

                safeLog('debug', 'Adzuna: Collected fact', {
                    category,
                    location: location.name,
                    count: result.count,
                    meanSalary: result.mean
                });
            } catch (error) {
                safeLog('warn', 'Adzuna: Failed to collect fact', {
                    category,
                    location: location.name,
                    error: error.message
                });
            }
        }
    }

    // Collect by keyword (national level)
    for (const keyword of keywords) {
        try {
            await delay(200);
            
            const result = await searchJobs({
                what: keyword,
                results_per_page: 1
            });

            // Get salary histogram for this keyword
            let salaryData = null;
            try {
                await delay(200);
                salaryData = await getSalaryHistogram({ what: keyword });
            } catch (e) {
                // Salary data might not be available
            }

            // Get historical salary trend
            let historicalData = null;
            try {
                await delay(200);
                historicalData = await getHistoricalSalary({ 
                    what: keyword,
                    months: 6
                });
            } catch (e) {
                // Historical data might not be available
            }

            facts.push({
                date: collectionDate,
                source: 'adzuna',
                type: 'keyword_national',
                keyword,
                jobCount: result.count,
                meanSalary: result.mean || null,
                salaryHistogram: salaryData?.histogram || null,
                salaryHistory: historicalData?.month || null,
                metadata: {}
            });

            safeLog('debug', 'Adzuna: Collected keyword fact', {
                keyword,
                count: result.count,
                meanSalary: result.mean
            });
        } catch (error) {
            safeLog('warn', 'Adzuna: Failed to collect keyword fact', {
                keyword,
                error: error.message
            });
        }
    }

    // Collect top companies for IT
    try {
        await delay(200);
        const topCompanies = await getTopCompanies({ what: 'developer' });
        
        facts.push({
            date: collectionDate,
            source: 'adzuna',
            type: 'top_companies',
            category: 'it-jobs',
            topCompanies: topCompanies.leaderboard,
            metadata: {}
        });
    } catch (error) {
        safeLog('warn', 'Adzuna: Failed to collect top companies', { error: error.message });
    }

    // Collect regional distribution
    try {
        await delay(200);
        const regionalData = await getRegionalData({ what: 'developer' });
        
        facts.push({
            date: collectionDate,
            source: 'adzuna',
            type: 'regional_distribution',
            category: 'it-jobs',
            regions: regionalData.locations,
            metadata: {}
        });
    } catch (error) {
        safeLog('warn', 'Adzuna: Failed to collect regional data', { error: error.message });
    }

    safeLog('info', 'Adzuna: Market facts collection completed', {
        totalFacts: facts.length
    });

    return facts;
}

export {
    isConfigured,
    searchJobs,
    getCategories,
    getSalaryHistogram,
    getHistoricalSalary,
    getTopCompanies,
    getRegionalData,
    collectMarketFacts,
    IT_CATEGORIES,
    FRENCH_LOCATIONS,
    IT_KEYWORDS
};
