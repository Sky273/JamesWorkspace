import path from 'path';
import { buildAllowedOrigins } from '../utils/originUtils.js';

// Environment variables and constants
export const PORT = process.env.PROXY_PORT || 3001;

// JWT Secret - MUST be set and at least 32 characters
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
        'CRITICAL: JWT_SECRET must be set in environment variables and be at least 32 characters long.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

// CSRF Secret - MUST be set and at least 32 characters
export const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
    throw new Error(
        'CRITICAL: CSRF_SECRET must be set in environment variables and be at least 32 characters long.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

// Refresh Token Secret - Separate from JWT_SECRET for enhanced security
// If not set, falls back to JWT_SECRET (less secure but backward compatible)
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;
if (REFRESH_TOKEN_SECRET === JWT_SECRET) {
    console.warn(
        'WARNING: REFRESH_TOKEN_SECRET is not set. Using JWT_SECRET as fallback.\n' +
        'For enhanced security, set a separate REFRESH_TOKEN_SECRET in your environment variables.\n' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

export const JWT_EXPIRES_IN = '1h';
export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const SALT_ROUNDS = 10;

// LLM API Keys
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_OPENAI_BASE_URL = process.env.GEMINI_OPENAI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
export const GLM_API_KEY = process.env.GLM_API_KEY;
export const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://api.z.ai/api/paas/v4';
export const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
export const MINIMAX_OPENAI_BASE_URL = process.env.MINIMAX_OPENAI_BASE_URL || 'https://api.minimax.io/v1';
export const MINIMAX_ANTHROPIC_BASE_URL = process.env.MINIMAX_ANTHROPIC_BASE_URL || 'https://api.minimax.io/anthropic';
export const MINIMAX_ENABLE_HIGHSPEED_MODELS = process.env.MINIMAX_ENABLE_HIGHSPEED_MODELS === 'true';
export const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
export const HUGGINGFACE_BASE_URL = process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1';
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || '';
export const OLLAMA_AUTO_PULL = process.env.OLLAMA_AUTO_PULL !== 'false';
export const OLLAMA_REQUEST_TIMEOUT_MS = parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS || '300000', 10);
export const PROFILE_MATCHING_LLM_MAX_CONCURRENCY = Math.min(
    Math.max(parseInt(process.env.PROFILE_MATCHING_LLM_MAX_CONCURRENCY || '0', 10) || 0, 0),
    100
);
export const PROFILE_MATCHING_LLM_BATCH_SIZE = Math.min(
    Math.max(parseInt(process.env.PROFILE_MATCHING_LLM_BATCH_SIZE || '0', 10) || 0, 0),
    100
);
export const PROFILE_MATCHING_LLM_PREFILTER_CAP = Math.max(
    parseInt(process.env.PROFILE_MATCHING_LLM_PREFILTER_CAP || '100', 10) || 0,
    0
);
export const PROFILE_MATCHING_LOCAL_SKILL_WEIGHT = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_SKILL_WEIGHT || '6', 10) || 6, 0);
export const PROFILE_MATCHING_LOCAL_TOOL_WEIGHT = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_TOOL_WEIGHT || '4', 10) || 4, 0);
export const PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT || '3', 10) || 3, 0);
export const PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT || '2', 10) || 2, 0);
export const PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT || '5', 10) || 5, 0);
export const PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT || '2', 10) || 2, 0);
export const PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER = Math.max(parseInt(process.env.PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER || '3', 10) || 3, 0);
export const LLM_RUNTIME_UNAVAILABLE_TTL_MS = Math.max(parseInt(process.env.LLM_RUNTIME_UNAVAILABLE_TTL_MS || `${6 * 60 * 60 * 1000}`, 10) || (6 * 60 * 60 * 1000), 60 * 1000);

// Market Radar - France Travail API (OAuth2)
export const FRANCE_TRAVAIL_CLIENT_ID = process.env.FRANCE_TRAVAIL_CLIENT_ID;
export const FRANCE_TRAVAIL_CLIENT_SECRET = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
export const FRANCE_TRAVAIL_TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
export const FRANCE_TRAVAIL_API_URL = process.env.FRANCE_TRAVAIL_API_URL || 'https://api.francetravail.io/partenaire/offresdemploi/v2';

// Rome 4.0 APIs
// 1. ROME 4.0 - Competences: pour recuperer la liste des metiers avec competences
export const ROME_COMPETENCES_API_URL = 'https://api.francetravail.io/partenaire/rome-competences/v1';
// 2. ROME 4.0 - Fiches Metiers: pour recuperer les fiches metiers detaillees
export const ROME_FICHES_METIERS_API_URL = 'https://api.francetravail.io/partenaire/rome-fiches-metiers/v1';

// Market Radar - Adzuna API
export const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
export const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
export const ADZUNA_API_URL = 'https://api.adzuna.com/v1/api';

// File upload configuration
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 50000;
export const MAX_PROMPT_LENGTH = 100000;
export const MAX_STRING_FIELD_LENGTH = 1000;
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (UPLOAD_DIR === path.parse(UPLOAD_DIR).root) {
    throw new Error('CRITICAL: UPLOAD_DIR cannot be the filesystem root.');
}

// Security configuration
export const MAX_LOGS = 1000;

// CORS - Normalize explicit origins from environment and merge with local defaults
export const ALLOWED_ORIGINS = buildAllowedOrigins(process.env);

// Cache TTL in milliseconds
export const CACHE_TTL = {
    SETTINGS: 10 * 60 * 1000,
    TEMPLATES: 10 * 60 * 1000,
    FIRMS: 15 * 60 * 1000,
    CLIENTS: 5 * 60 * 1000,
    DEALS: 5 * 60 * 1000,
    USERS: 5 * 60 * 1000,
    MISSIONS: 2 * 60 * 1000,
    RESUMES: 2 * 60 * 1000,
    CANDIDATE_PIPELINE: 2 * 60 * 1000,
    EMAIL_TEMPLATES: 10 * 60 * 1000,
    RESUME_COMMENTS: 2 * 60 * 1000,
    BACKUP_SETTINGS: 10 * 60 * 1000,
    JOBS: 30 * 1000,
    GDPR_AUDIT: 30 * 1000,
    GROUPED_VIEWS: 30 * 1000
};
export const CACHE_BACKEND = ['memory', 'redis'].includes((process.env.CACHE_BACKEND || '').toLowerCase())
    ? process.env.CACHE_BACKEND.toLowerCase()
    : 'memory';
export const CACHE_REDIS_URL = process.env.CACHE_REDIS_URL || 'redis://127.0.0.1:6379';
export const CACHE_KEY_PREFIX = process.env.CACHE_KEY_PREFIX || 'resumeconverter';

// SMTP Configuration for GDPR consent emails
export const SMTP_CONFIG = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    fromName: process.env.SMTP_FROM_NAME || 'ResumeConverter',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
};

// GDPR Consent Configuration
export const CONSENT_CONFIG = {
    tokenExpiryDays: 14,
    retentionDays: 730,
    reminderAfterDays: 7
};

// Rate limiting configuration
export const RATE_LIMIT = {
    GLOBAL: {
        windowMs: 15 * 60 * 1000,
        max: 1000
    },
    AUTH: {
        windowMs: 15 * 60 * 1000,
        max: 20
    },
    USER: {
        windowMs: 15 * 60 * 1000,
        max: 50
    }
};
