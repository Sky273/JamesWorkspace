// Environment variables and constants
export const PORT = process.env.PROXY_PORT || 3001;

// JWT Secret - MUST be set and at least 32 characters
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
        '❌ CRITICAL: JWT_SECRET must be set in environment variables and be at least 32 characters long.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

// CSRF Secret - MUST be set and at least 32 characters
export const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
    throw new Error(
        '❌ CRITICAL: CSRF_SECRET must be set in environment variables and be at least 32 characters long.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

// Refresh Token Secret - Separate from JWT_SECRET for enhanced security
// If not set, falls back to JWT_SECRET (less secure but backward compatible)
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;
if (REFRESH_TOKEN_SECRET === JWT_SECRET) {
    console.warn(
        '⚠️  WARNING: REFRESH_TOKEN_SECRET is not set. Using JWT_SECRET as fallback.\n' +
        'For enhanced security, set a separate REFRESH_TOKEN_SECRET in your environment variables.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

export const JWT_EXPIRES_IN = '1h';
export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const SALT_ROUNDS = 10;

// Table names (PostgreSQL)
export const RESUME_TABLE = 'resumes';
export const USERS_TABLE = 'Users';
export const SETTINGS_TABLE = 'LLMSettings';
export const MISSIONS_TABLE = 'Offers';
export const ADAPTATIONS_TABLE = 'ResumeAdaptations';
export const TEMPLATES_TABLE = 'Templates';
export const CUSTOMERS_TABLE = 'Customers';
export const MARKET_FACTS_TABLE = 'MarketFacts';

// LLM API Keys
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Market Radar - France Travail API (OAuth2)
// Register at: https://francetravail.io/ or https://www.emploi-store-dev.fr/
export const FRANCE_TRAVAIL_CLIENT_ID = process.env.FRANCE_TRAVAIL_CLIENT_ID;
export const FRANCE_TRAVAIL_CLIENT_SECRET = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
export const FRANCE_TRAVAIL_TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
// Try alternative API URL if 403 error persists
// Production: https://api.francetravail.io/partenaire/offresdemploi/v2
// Alternative: https://api.emploi-store.fr/partenaire/offresdemploi/v2
export const FRANCE_TRAVAIL_API_URL = process.env.FRANCE_TRAVAIL_API_URL || 'https://api.francetravail.io/partenaire/offresdemploi/v2';

// Rome 4.0 APIs
// 1. ROME 4.0 - Compétences : pour récupérer la liste des métiers avec compétences
export const ROME_COMPETENCES_API_URL = 'https://api.francetravail.io/partenaire/rome-competences/v1';
// 2. ROME 4.0 - Fiches Métiers : pour récupérer les fiches métiers détaillées
export const ROME_FICHES_METIERS_API_URL = 'https://api.francetravail.io/partenaire/rome-fiches-metiers/v1';
export const ROME_METIERS_TABLE = 'RomeMetiers';
export const INDUSTRY_ALIASES_TABLE = 'industry_aliases';

// Market Radar - Adzuna API
// Register at: https://developer.adzuna.com/signup
export const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
export const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
export const ADZUNA_API_URL = 'https://api.adzuna.com/v1/api';

// File upload configuration
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_TEXT_LENGTH = 50000;
export const MAX_PROMPT_LENGTH = 100000;
export const MAX_STRING_FIELD_LENGTH = 1000;
// Upload directory relative to project root (where package.json is)
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Security configuration
export const MAX_LOGS = 1000;

// CORS - Use environment variables only
// Set ALLOWED_ORIGINS in .env as comma-separated list: http://localhost:5173,https://your-domain.com
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:4173',  // Vite preview server
        'http://localhost:3000',
        'http://localhost:3001',  // Proxy server HTTP
        'https://localhost:3443', // Proxy server HTTPS (production mode)
        'http://localhost:3002'   // PDF server
    ];

// Cache TTL (Time To Live) in milliseconds
export const CACHE_TTL = {
    SETTINGS: 10 * 60 * 1000,      // 10 minutes
    TEMPLATES: 10 * 60 * 1000,     // 10 minutes
    CUSTOMERS: 15 * 60 * 1000      // 15 minutes
};

// Rate limiting configuration
export const RATE_LIMIT = {
    GLOBAL: {
        windowMs: 15 * 60 * 1000,  // 15 minutes
        max: 1000                   // requests per window
    },
    AUTH: {
        windowMs: 15 * 60 * 1000,  // 15 minutes
        max: 20                     // login attempts per window
    },
    USER: {
        windowMs: 15 * 60 * 1000,  // 15 minutes
        max: 50                     // requests per user per window
    }
};
