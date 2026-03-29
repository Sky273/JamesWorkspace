/**
 * Environment Variables Validation
 * Validates required environment variables at startup
 */

import { safeLog } from '../utils/logger.backend.js';

const REQUIRED_VARS = [
    { name: 'JWT_SECRET', minLength: 32, description: 'JWT signing secret' },
    { name: 'REFRESH_TOKEN_SECRET', minLength: 32, description: 'Refresh token secret' },
    { name: 'POSTGRES_HOST', description: 'PostgreSQL host' },
    { name: 'POSTGRES_DB', description: 'PostgreSQL database name' },
    { name: 'POSTGRES_USER', description: 'PostgreSQL user' },
    { name: 'POSTGRES_PASSWORD', description: 'PostgreSQL password' },
    { name: 'CSRF_SECRET', minLength: 32, description: 'CSRF protection secret' }
];

const RECOMMENDED_VARS = [
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key for LLM features' },
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic API key for Claude' },
    { name: 'DEEPSEEK_API_KEY', description: 'DeepSeek API key for DeepSeek models' },
    { name: 'GLM_API_KEY', description: 'GLM API key for GLM models' },
    { name: 'MINIMAX_API_KEY', description: 'MiniMax API key for MiniMax models' },
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

function canDerivePdfServerToken() {
    return !!(
        process.env.JWT_SECRET &&
        process.env.JWT_SECRET.length >= 32 &&
        process.env.CSRF_SECRET &&
        process.env.CSRF_SECRET.length >= 32
    );
}

export function validateEnvironment() {
    const errors = [];
    const warnings = [];
    const isProduction = process.env.NODE_ENV === 'production';
    const canDerivePdfToken = canDerivePdfServerToken();

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

    const pdfServerToken = process.env.PDF_SERVER_INTERNAL_TOKEN;
    if (!pdfServerToken) {
        const message = 'Missing required environment variable: PDF_SERVER_INTERNAL_TOKEN (Proxy to PDF server shared secret)';
        if (isProduction && !canDerivePdfToken) {
            errors.push(message);
        } else {
            warnings.push(
                isProduction
                    ? `${message}. Falling back to a token derived from JWT_SECRET and CSRF_SECRET for backward compatibility; set an explicit dedicated secret.`
                    : `${message}. Using the development/test fallback token outside production.`
            );
        }
    } else if (pdfServerToken.length < 32) {
        const message = 'PDF_SERVER_INTERNAL_TOKEN must be at least 32 characters long';
        if (isProduction && !canDerivePdfToken) {
            errors.push(message);
        } else {
            warnings.push(
                isProduction
                    ? `${message}. Falling back to a token derived from JWT_SECRET and CSRF_SECRET for backward compatibility; set an explicit dedicated secret.`
                    : `${message}. Using the development/test fallback token outside production.`
            );
        }
    } else if (looksLikePlaceholder(pdfServerToken)) {
        warnings.push('PDF_SERVER_INTERNAL_TOKEN appears to still use an example or placeholder value');
    }

    if (errors.length > 0) {
        safeLog('error', 'Environment validation failed', { errorCount: errors.length });
        errors.forEach(err => safeLog('error', err));
    }

    if (warnings.length > 0) {
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
        hasDeepSeek: !!process.env.DEEPSEEK_API_KEY,
        hasGlm: !!process.env.GLM_API_KEY,
        hasMiniMax: !!process.env.MINIMAX_API_KEY,
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


