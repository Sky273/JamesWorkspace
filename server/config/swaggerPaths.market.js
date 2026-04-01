export function createMarketSwaggerPaths({
    auth401,
    forbidden403,
    notFound404,
    security,
    securityCsrf,
    paramId,
    paramPage,
    paramLimit
}) {
    return {
        '/market-radar/collect': {
            post: {
                tags: ['Market Radar'],
                summary: 'Run full data collection (admin)',
                description: 'Collect data from all sources (France Travail + Adzuna). Heavy operation.',
                security: securityCsrf,
                responses: { 200: { description: 'Collection results' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/market-radar/collect/{source}': {
            post: {
                tags: ['Market Radar'],
                summary: 'Collect from specific source (admin)',
                security: securityCsrf,
                parameters: [{ name: 'source', in: 'path', required: true, schema: { type: 'string', enum: ['france_travail', 'adzuna'] } }],
                responses: { 200: { description: 'Collection results' }, 401: auth401, 403: forbidden403 }
            }
        },
        '/market-radar/search/france-travail': {
            get: {
                tags: ['Market Radar'],
                summary: 'Search France Travail API',
                security,
                parameters: [{ name: 'motsCles', in: 'query', schema: { type: 'string' } }, { name: 'codeROME', in: 'query', schema: { type: 'string' } }, { name: 'departement', in: 'query', schema: { type: 'string' } }, { name: 'region', in: 'query', schema: { type: 'string' } }],
                responses: { 200: { description: 'France Travail search results' }, 401: auth401 }
            }
        },
        '/market-radar/search/adzuna': {
            get: {
                tags: ['Market Radar'],
                summary: 'Search Adzuna API',
                security,
                parameters: [{ name: 'what', in: 'query', schema: { type: 'string' } }, { name: 'where', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }],
                responses: { 200: { description: 'Adzuna search results' }, 401: auth401 }
            }
        },
        '/market-radar/salary-histogram': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get salary histogram (Adzuna)',
                security,
                parameters: [{ name: 'what', in: 'query', schema: { type: 'string' } }, { name: 'where', in: 'query', schema: { type: 'string' } }],
                responses: { 200: { description: 'Salary distribution data' }, 401: auth401 }
            }
        },
        '/market-radar/top-companies': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get top hiring companies (Adzuna)',
                security,
                parameters: [{ name: 'what', in: 'query', schema: { type: 'string' } }, { name: 'where', in: 'query', schema: { type: 'string' } }],
                responses: { 200: { description: 'Top companies list' }, 401: auth401 }
            }
        },
        '/market-radar/facts': {
            get: {
                tags: ['Market Radar'],
                summary: 'Get market facts (paginated)',
                security,
                parameters: [{ name: 'startDate', in: 'query', schema: { type: 'string' } }, { name: 'endDate', in: 'query', schema: { type: 'string' } }, { name: 'source', in: 'query', schema: { type: 'string' } }, { name: 'keyword', in: 'query', schema: { type: 'string' } }, paramPage, paramLimit],
                responses: { 200: { description: 'Paginated market facts' }, 401: auth401 }
            }
        },
        '/market-radar/facts/all': {
            get: { tags: ['Market Radar'], summary: 'Get all facts (cached)', security, responses: { 200: { description: 'All market facts' }, 401: auth401 } }
        },
        '/market-radar/facts/filters': {
            get: { tags: ['Market Radar'], summary: 'Get facts filter options', security, responses: { 200: { description: 'Filter options' }, 401: auth401 } }
        },
        '/market-radar/facts/summary': {
            get: { tags: ['Market Radar'], summary: 'Get facts summary', security, responses: { 200: { description: 'Aggregated summary' }, 401: auth401 } }
        },
        '/market-radar/facts/cache/refresh': {
            post: { tags: ['Market Radar'], summary: 'Refresh facts cache (admin)', security: securityCsrf, responses: { 200: { description: 'Cache refreshed' }, 401: auth401, 403: forbidden403 } }
        },
        '/market-radar/latest/{type}': {
            get: { tags: ['Market Radar'], summary: 'Get latest facts by type', security, parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' } }, { name: 'source', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Latest facts' }, 401: auth401 } }
        },
        '/market-radar/trend/{keyword}': {
            get: { tags: ['Market Radar'], summary: 'Get trend for keyword', security, parameters: [{ name: 'keyword', in: 'path', required: true, schema: { type: 'string' } }, { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }], responses: { 200: { description: 'Trend data' }, 401: auth401 } }
        },
        '/market-radar/regional': {
            get: { tags: ['Market Radar'], summary: 'Get regional comparison', security, parameters: [{ name: 'date', in: 'query', schema: { type: 'string' } }, { name: 'source', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Regional comparison data' }, 401: auth401 } }
        },
        '/market-radar/referentiel/{type}': {
            get: { tags: ['Market Radar'], summary: 'Get reference data (France Travail)', security, parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' }, description: 'Reference type (metiers, appellations, domaines...)' }], responses: { 200: { description: 'Reference data' }, 401: auth401 } }
        },
        '/market-radar/categories': {
            get: { tags: ['Market Radar'], summary: 'Get job categories (Adzuna)', security, responses: { 200: { description: 'Job categories' }, 401: auth401 } }
        },
        '/market-radar/config': {
            get: { tags: ['Market Radar'], summary: 'Get radar configuration', security, responses: { 200: { description: 'Config with ROME codes, regions, keywords' }, 401: auth401 } }
        },
        '/market-radar/trends': {
            get: { tags: ['Market Radar'], summary: 'Get market trends (paginated)', security, parameters: [{ name: 'type', in: 'query', schema: { type: 'string' } }, { name: 'codeRome', in: 'query', schema: { type: 'string' } }, { name: 'regionCode', in: 'query', schema: { type: 'string' } }, paramPage, paramLimit], responses: { 200: { description: 'Market trends data' }, 401: auth401 } }
        },
        '/market-radar/trends/all': {
            get: { tags: ['Market Radar'], summary: 'Get all trends (for map)', security, parameters: [{ name: 'type', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'All trends grouped by type' }, 401: auth401 } }
        },
        '/market-radar/trends/summary': {
            get: { tags: ['Market Radar'], summary: 'Get trends summary', security, responses: { 200: { description: 'Aggregated trends summary' }, 401: auth401 } }
        },
        '/market-radar/trends/filters': {
            get: { tags: ['Market Radar'], summary: 'Get trend filter options', security, responses: { 200: { description: 'Available types, regions, ROME codes' }, 401: auth401 } }
        },
        '/market-radar/trends/{id}/metadata': {
            get: { tags: ['Market Radar'], summary: 'Get trend metadata', security, parameters: [paramId], responses: { 200: { description: 'Trend metadata' }, 401: auth401, 404: notFound404 } }
        },
        '/market-radar/trends/collect': {
            post: { tags: ['Market Radar'], summary: 'Collect trends (admin)', description: 'Trigger market trends collection (background task)', security: securityCsrf, responses: { 200: { description: 'Collection started' }, 401: auth401, 403: forbidden403 } }
        },
        '/market-radar/trends/collect-dynamics': {
            post: { tags: ['Market Radar'], summary: 'Collect employment dynamics (admin)', security: securityCsrf, responses: { 200: { description: 'Collection started' }, 401: auth401, 403: forbidden403 } }
        },
        '/market-radar/trends/cache/refresh': {
            post: { tags: ['Market Radar'], summary: 'Refresh trends cache (admin)', security: securityCsrf, responses: { 200: { description: 'Cache refreshed' }, 401: auth401, 403: forbidden403 } }
        },
        '/market-radar/trends/verify/{type}/{regionCode}/{codeRome}': {
            get: { tags: ['Market Radar'], summary: 'Verify trend data (admin)', description: 'Compare stored data with live API response', security, parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' } }, { name: 'regionCode', in: 'path', required: true, schema: { type: 'string' } }, { name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Verification result' }, 401: auth401, 403: forbidden403 } }
        },
        '/market-radar/trends/audit': {
            get: { tags: ['Market Radar'], summary: 'Get trends audit report (admin)', security, responses: { 200: { description: 'Freshness report' }, 401: auth401, 403: forbidden403 } }
        },
        '/rome/metiers': {
            get: { tags: ['ROME'], summary: 'Get ROME métiers', description: 'Search and list ROME 4.0 job classifications', security, parameters: [{ name: 'codeRome', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }, paramPage, paramLimit], responses: { 200: { description: 'Array of métiers', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RomeMetier' } } } } }, 401: auth401 } }
        },
        '/rome/metiers/stats': {
            get: { tags: ['ROME'], summary: 'Get ROME statistics', security, responses: { 200: { description: 'ROME collection stats' }, 401: auth401 } }
        },
        '/rome/metiers/{codeRome}': {
            get: { tags: ['ROME'], summary: 'Get métier by ROME code', security, parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Métier details' }, 401: auth401, 404: notFound404 } }
        },
        '/rome/api/grands-domaines': { get: { tags: ['ROME'], summary: 'Get grands domaines (live API)', security, responses: { 200: { description: 'Grands domaines list' }, 401: auth401 } } },
        '/rome/api/domaines': { get: { tags: ['ROME'], summary: 'Get domaines (live API)', security, responses: { 200: { description: 'Domaines list' }, 401: auth401 } } },
        '/rome/api/metiers': { get: { tags: ['ROME'], summary: 'Get all métiers (live API)', security, responses: { 200: { description: 'Métiers list' }, 401: auth401 } } },
        '/rome/api/metiers/it': { get: { tags: ['ROME'], summary: 'Get IT métiers (live API)', security, responses: { 200: { description: 'IT métiers' }, 401: auth401 } } },
        '/rome/api/metiers/{codeRome}': { get: { tags: ['ROME'], summary: 'Get métier details (live API)', security, parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Métier details' }, 401: auth401, 404: notFound404 } } },
        '/rome/api/metiers/{codeRome}/competences': { get: { tags: ['ROME'], summary: 'Get competences for métier (live API)', security, parameters: [{ name: 'codeRome', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Competences list' }, 401: auth401, 404: notFound404 } } },
        '/rome/api/search': { get: { tags: ['ROME'], summary: 'Search métiers (live API)', security, parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Search results' }, 401: auth401 } } },
        '/rome/collect': { post: { tags: ['ROME'], summary: 'Collect ROME data (admin)', description: 'Fetch and store ROME 4.0 data from France Travail API', security: securityCsrf, responses: { 200: { description: 'Collection results' }, 401: auth401, 403: forbidden403 } } }
    };
}
