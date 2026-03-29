/**
 * Retry Service with Exponential Backoff
 * 
 * Provides resilient API calls with:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Configurable retry strategies
 */

import { safeLog } from '../utils/logger.backend.js';

// ============================================
// RETRY CONFIGURATION
// ============================================

const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1, // 10% random jitter
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN']
};

// ============================================
// CIRCUIT BREAKER
// ============================================

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeoutMs = options.resetTimeoutMs || 60000; // 1 minute
        this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.halfOpenCalls = 0;
    }

    canExecute() {
        if (this.state === 'CLOSED') {
            return true;
        }

        if (this.state === 'OPEN') {
            // Check if we should transition to half-open
            if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
                this.halfOpenCalls = 0;
                safeLog('info', `Circuit breaker ${this.name} transitioning to HALF_OPEN`);
                return true;
            }
            return false;
        }

        if (this.state === 'HALF_OPEN') {
            // Allow limited calls in half-open state
            return this.halfOpenCalls < this.halfOpenMaxCalls;
        }

        return false;
    }

    recordSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.halfOpenMaxCalls) {
                this.state = 'CLOSED';
                this.failures = 0;
                this.successes = 0;
                safeLog('info', `Circuit breaker ${this.name} CLOSED after recovery`);
            }
        } else {
            this.failures = 0;
        }
    }

    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            safeLog('warn', `Circuit breaker ${this.name} re-opened after failure in HALF_OPEN`);
        } else if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            safeLog('warn', `Circuit breaker ${this.name} OPENED after ${this.failures} failures`);
        }
    }

    getState() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime
        };
    }

    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.halfOpenCalls = 0;
    }
}

// Circuit breakers for different services
const circuitBreakers = {
    openai: new CircuitBreaker('openai', { failureThreshold: 5, resetTimeoutMs: 60000 }),
    anthropic: new CircuitBreaker('anthropic', { failureThreshold: 5, resetTimeoutMs: 60000 }),
    deepseek: new CircuitBreaker('deepseek', { failureThreshold: 5, resetTimeoutMs: 60000 }),
    minimax: new CircuitBreaker('minimax', { failureThreshold: 5, resetTimeoutMs: 60000 })
};

// ============================================
// RETRY LOGIC
// ============================================

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt, config) {
    const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
    
    return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error, config) {
    // Check error code
    if (error.code && config.retryableErrors.includes(error.code)) {
        return true;
    }

    // Check HTTP status code
    if (error.response?.status && config.retryableStatusCodes.includes(error.response.status)) {
        return true;
    }

    // Check for specific error messages
    const errorMessage = error.message?.toLowerCase() || '';
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('network') ||
        errorMessage.includes('econnreset') ||
        errorMessage.includes('socket hang up')) {
        return true;
    }

    return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and circuit breaker
 * 
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {string} options.serviceName - Name of the service (for circuit breaker)
 * @param {string} options.operationName - Name of the operation (for logging)
 * @param {Object} options.retryConfig - Override default retry configuration
 * @returns {Promise<any>} - Result of the function
 */
export async function withRetry(fn, options = {}) {
    const {
        serviceName = 'default',
        operationName = 'operation',
        retryConfig = {}
    } = options;

    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    const circuitBreaker = circuitBreakers[serviceName];

    // Check circuit breaker
    if (circuitBreaker && !circuitBreaker.canExecute()) {
        const error = new Error(`Circuit breaker OPEN for ${serviceName}`);
        error.code = 'CIRCUIT_OPEN';
        safeLog('warn', `Circuit breaker preventing call to ${serviceName}`, { 
            operation: operationName,
            state: circuitBreaker.getState()
        });
        throw error;
    }

    let lastError;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = await fn();
            
            // Record success
            if (circuitBreaker) {
                circuitBreaker.recordSuccess();
            }
            
            if (attempt > 0) {
                safeLog('info', `${operationName} succeeded after ${attempt} retries`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            // Check if we should retry
            const shouldRetry = attempt < config.maxRetries && isRetryableError(error, config);
            
            if (!shouldRetry) {
                // Record failure for circuit breaker
                if (circuitBreaker) {
                    circuitBreaker.recordFailure();
                }
                
                safeLog('error', `${operationName} failed permanently`, {
                    attempt: attempt + 1,
                    error: error.message,
                    status: error.response?.status
                });
                
                throw error;
            }
            
            // Calculate delay and wait
            const delay = calculateDelay(attempt, config);
            
            safeLog('warn', `${operationName} failed, retrying in ${Math.round(delay)}ms`, {
                attempt: attempt + 1,
                maxRetries: config.maxRetries,
                error: error.message,
                status: error.response?.status
            });
            
            await sleep(delay);
        }
    }
    
    // Should not reach here, but just in case
    throw lastError;
}

/**
 * Create a retry wrapper for a specific service
 */
export function createRetryWrapper(serviceName, defaultConfig = {}) {
    return (fn, operationName) => withRetry(fn, {
        serviceName,
        operationName,
        retryConfig: defaultConfig
    });
}

// Pre-configured retry wrappers
export const retryOpenAI = createRetryWrapper('openai', {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 60000
});

export const retryAnthropic = createRetryWrapper('anthropic', {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 60000
});

export const retryDeepSeek = createRetryWrapper('deepseek', {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 60000
});

export const retryMiniMax = createRetryWrapper('minimax', {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 60000
});


// ============================================
// CIRCUIT BREAKER MANAGEMENT
// ============================================

/**
 * Get all circuit breaker states
 */
export function getCircuitBreakerStates() {
    const states = {};
    for (const [name, breaker] of Object.entries(circuitBreakers)) {
        states[name] = breaker.getState();
    }
    return states;
}

/**
 * Reset a specific circuit breaker
 */
export function resetCircuitBreaker(serviceName) {
    if (circuitBreakers[serviceName]) {
        circuitBreakers[serviceName].reset();
        safeLog('info', `Circuit breaker ${serviceName} manually reset`);
        return true;
    }
    return false;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers() {
    for (const breaker of Object.values(circuitBreakers)) {
        breaker.reset();
    }
    safeLog('info', 'All circuit breakers reset');
}

export { CircuitBreaker, circuitBreakers };
