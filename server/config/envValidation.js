/**
 * Environment Variables Validation
 * Validates required environment variables at startup
 */

import { safeLog } from '../utils/logger.backend.js';

const REQUIRED_VARS = [
    { name: 'JWT_SECRET', minLength: 32, description: 'JWT signing secret' },
    { name: 'POSTGRES_HOST', description: 'PostgreSQL host' },
    { name: 'POSTGRES_DB', description: 'PostgreSQL database name' },
    { name: 'POSTGRES_USER', description: 'PostgreSQL user' },
    { name: 'POSTGRES_PASSWORD', description: 'PostgreSQL password' },
    { name: 'CSRF_SECRET', minLength: 32, description: 'CSRF protection secret' }
];

const RECOMMENDED_VARS = [
    { name: 'REFRESH_TOKEN_SECRET', minLength: 32, description: 'Dedicated refresh token secret' },
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key for LLM features' },
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic API key for Claude' },
    { name: 'GEMINI_API_KEY', description: 'Google AI API key for hosted Gemma models' },
    { name: 'DEEPSEEK_API_KEY', description: 'DeepSeek API key for DeepSeek models' },
    { name: 'GLM_API_KEY', description: 'GLM API key for GLM models' },
    { name: 'MINIMAX_API_KEY', description: 'MiniMax API key for MiniMax models' },
    { name: 'CACHE_BACKEND', description: 'Cache backend (memory or redis)' },
    { name: 'NODE_ENV', description: 'Environment (development/production)' }
];

const PLACEHOLDER_PATTERNS = [
    /change-this-in-production/i,
    /your-super-secret/i,
    /your-secure-password/i,
    /your-google-client/i,
    /your-64-character-hex/i,
    /your-domain\.com/i,
    /your-client-id/i,
    /your-client-secret/i,
    /your-openai-api-key/i,
    /your-anthropic-api-key/i
];

function looksLikePlaceholder(value = '') {
    return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value));
}

export function validateEnvironment() {
    const errors = [];
    const warnings = [];
    const isProduction = process.env.NODE_ENV === 'production';
    const quietExpectedWarnings = process.env.E2E_QUIET_EXPECTED_WARNINGS === 'true';

    for (const varConfig of REQUIRED_VARS) {
        const value = process.env[varConfig.name];
        if (!value) {
            errors.push(`Missing required environment variable: ${varConfig.name} (${varConfig.description})`);
        } else if (varConfig.minLength && value.length < varConfig.minLength) {
            errors.push(`${varConfig.name} must be at least ${varConfig.minLength} characters long`);
        } else if (looksLikePlaceholder(value)) {
            errors.push(`${varConfig.name} is still using an example or placeholder value`);
        }
    }

    for (const varConfig of RECOMMENDED_VARS) {
        const value = process.env[varConfig.name];
        if (!value) {
            warnings.push(`Missing recommended variable: ${varConfig.name} (${varConfig.description})`);
        } else if (varConfig.minLength && value.length < varConfig.minLength) {
            warnings.push(`${varConfig.name} should be at least ${varConfig.minLength} characters long`);
        } else if (looksLikePlaceholder(value)) {
            warnings.push(`${varConfig.name} appears to still use an example or placeholder value`);
        }
    }

    if (process.env.CACHE_BACKEND && !['memory', 'redis'].includes(process.env.CACHE_BACKEND.toLowerCase())) {
        warnings.push('CACHE_BACKEND should be either "memory" or "redis"');
    }

    const pdfServerToken = process.env.PDF_SERVER_INTERNAL_TOKEN;
    if (!pdfServerToken) {
        const message = 'Missing required environment variable: PDF_SERVER_INTERNAL_TOKEN (Proxy to PDF server shared secret)';
        if (isProduction) {
            errors.push(message);
        } else {
            warnings.push(`${message}. Internal PDF generation routes will stay unavailable until it is set.`);
        }
    } else if (pdfServerToken.length < 32) {
        const message = 'PDF_SERVER_INTERNAL_TOKEN must be at least 32 characters long';
        if (isProduction) {
            errors.push(message);
        } else {
            warnings.push(`${message}. Internal PDF generation routes will stay unavailable until it is fixed.`);
        }
    } else if (looksLikePlaceholder(pdfServerToken)) {
        warnings.push('PDF_SERVER_INTERNAL_TOKEN appears to still use an example or placeholder value');
    }

    if (errors.length > 0) {
        safeLog('error', 'Environment validation failed', { errorCount: errors.length });
        errors.forEach(err => safeLog('error', err));
    }

    if (warnings.length > 0 && !quietExpectedWarnings) {
        safeLog('warn', 'Environment validation warnings', { warningCount: warnings.length });
        warnings.forEach(warn => safeLog('warn', warn));
    }

    if (errors.length === 0 && warnings.length === 0) {
        safeLog('info', 'Environment validation passed');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

export function validateEnvironmentOrExit(exitOnError = true) {
    const result = validateEnvironment();

    if (!result.valid && exitOnError) {
        console.error('\nEnvironment validation failed. Please check your .env file.\n');
        result.errors.forEach(err => console.error(`  - ${err}`));
        console.error('\nSee .env.example for required variables.\n');
        process.exit(1);
    }

    return result;
}

export function getEnvironmentInfo() {
    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasRefreshSecret: !!process.env.REFRESH_TOKEN_SECRET,
        hasPostgres: !!process.env.POSTGRES_HOST,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
        hasGemini: !!process.env.GEMINI_API_KEY,
        hasDeepSeek: !!process.env.DEEPSEEK_API_KEY,
        hasGlm: !!process.env.GLM_API_KEY,
        hasMiniMax: !!process.env.MINIMAX_API_KEY,
        cacheBackend: process.env.CACHE_BACKEND || 'memory',
        hasRedisUrl: !!process.env.CACHE_REDIS_URL,
        minimaxHighspeedEnabled: process.env.MINIMAX_ENABLE_HIGHSPEED_MODELS === 'true',
        hasCsrf: !!process.env.CSRF_SECRET,
        hasPdfServerToken: !!process.env.PDF_SERVER_INTERNAL_TOKEN
    };
}

export default {
    validateEnvironment,
    validateEnvironmentOrExit,
    getEnvironmentInfo
};


