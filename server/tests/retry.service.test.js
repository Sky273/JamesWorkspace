/**
 * Tests for Retry Service with Circuit Breaker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger
vi.mock('../src/utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { 
    withRetry, 
    CircuitBreaker, 
    getCircuitBreakerStates, 
    resetCircuitBreaker,
    resetAllCircuitBreakers 
} from '../services/retry.service.js';

describe('CircuitBreaker', () => {
    let breaker;

    beforeEach(() => {
        breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            halfOpenMaxCalls: 2
        });
    });

    it('should start in CLOSED state', () => {
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.canExecute()).toBe(true);
    });

    it('should open after reaching failure threshold', () => {
        breaker.recordFailure();
        breaker.recordFailure();
        expect(breaker.state).toBe('CLOSED');
        
        breaker.recordFailure();
        expect(breaker.state).toBe('OPEN');
        expect(breaker.canExecute()).toBe(false);
    });

    it('should reset failure count on success', () => {
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordSuccess();
        
        expect(breaker.failures).toBe(0);
        expect(breaker.state).toBe('CLOSED');
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
        // Open the circuit
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();
        expect(breaker.state).toBe('OPEN');

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Should transition to HALF_OPEN on next check
        expect(breaker.canExecute()).toBe(true);
        expect(breaker.state).toBe('HALF_OPEN');
    });

    it('should close after successful calls in HALF_OPEN state', async () => {
        // Open the circuit
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 1100));
        breaker.canExecute(); // Trigger transition to HALF_OPEN

        // Record successful calls
        breaker.recordSuccess();
        breaker.recordSuccess();

        expect(breaker.state).toBe('CLOSED');
    });

    it('should re-open on failure in HALF_OPEN state', async () => {
        // Open the circuit
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 1100));
        breaker.canExecute(); // Trigger transition to HALF_OPEN

        // Record failure
        breaker.recordFailure();

        expect(breaker.state).toBe('OPEN');
    });

    it('should reset properly', () => {
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();
        expect(breaker.state).toBe('OPEN');

        breaker.reset();

        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failures).toBe(0);
        expect(breaker.canExecute()).toBe(true);
    });
});

describe('withRetry', () => {
    beforeEach(() => {
        resetAllCircuitBreakers();
    });

    it('should return result on first successful call', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const result = await withRetry(fn, {
            operationName: 'test operation'
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
        const error = new Error('timeout');
        error.code = 'ETIMEDOUT';
        
        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValue('success');

        const result = await withRetry(fn, {
            operationName: 'test operation',
            retryConfig: { maxRetries: 3, initialDelayMs: 10 }
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
        const error = new Error('validation error');
        error.response = { status: 400 };
        
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, {
            operationName: 'test operation',
            retryConfig: { maxRetries: 3, initialDelayMs: 10 }
        })).rejects.toThrow('validation error');

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 rate limit error', async () => {
        const error = new Error('rate limited');
        error.response = { status: 429 };
        
        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValue('success');

        const result = await withRetry(fn, {
            operationName: 'test operation',
            retryConfig: { maxRetries: 3, initialDelayMs: 10 }
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 server error', async () => {
        const error = new Error('server error');
        error.response = { status: 500 };
        
        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockRejectedValueOnce(error)
            .mockResolvedValue('success');

        const result = await withRetry(fn, {
            operationName: 'test operation',
            retryConfig: { maxRetries: 3, initialDelayMs: 10 }
        });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
        const error = new Error('persistent error');
        error.response = { status: 503 };
        
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, {
            operationName: 'test operation',
            retryConfig: { maxRetries: 2, initialDelayMs: 10 }
        })).rejects.toThrow('persistent error');

        expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should throw immediately when circuit is open', async () => {
        // Get the openai circuit breaker and force it open
        const states = getCircuitBreakerStates();
        expect(states.openai).toBeDefined();

        // Manually trigger failures to open the circuit
        const error = new Error('server error');
        error.response = { status: 500 };
        const fn = vi.fn().mockRejectedValue(error);

        // This should open the circuit after failures
        for (let i = 0; i < 5; i++) {
            try {
                await withRetry(fn, {
                    serviceName: 'openai',
                    operationName: 'test',
                    retryConfig: { maxRetries: 0, initialDelayMs: 10 }
                });
            } catch (_e) {
                // Expected
            }
        }

        // Now the circuit should be open
        const newStates = getCircuitBreakerStates();
        expect(newStates.openai.state).toBe('OPEN');

        // Next call should fail immediately with circuit open error
        await expect(withRetry(fn, {
            serviceName: 'openai',
            operationName: 'test',
            retryConfig: { maxRetries: 3, initialDelayMs: 10 }
        })).rejects.toThrow('Circuit breaker OPEN');
    });
});

describe('Circuit Breaker Management', () => {
    beforeEach(() => {
        resetAllCircuitBreakers();
    });

    it('should get all circuit breaker states', () => {
        const states = getCircuitBreakerStates();
        
        expect(states).toHaveProperty('openai');
        expect(states).toHaveProperty('anthropic');
        expect(states).toHaveProperty('deepseek');
        expect(states).toHaveProperty('glm');
        expect(states).toHaveProperty('minimax');
        
        expect(states.openai.state).toBe('CLOSED');
    });

    it('should reset specific circuit breaker', () => {
        // Force open the openai circuit
        const error = new Error('error');
        error.response = { status: 500 };
        const fn = vi.fn().mockRejectedValue(error);

        // Open the circuit
        (async () => {
            for (let i = 0; i < 5; i++) {
                try {
                    await withRetry(fn, {
                        serviceName: 'openai',
                        operationName: 'test',
                        retryConfig: { maxRetries: 0, initialDelayMs: 1 }
                    });
                } catch (_e) { /* expected */ }
            }
        })();

        // Reset it
        const result = resetCircuitBreaker('openai');
        expect(result).toBe(true);

        const states = getCircuitBreakerStates();
        expect(states.openai.state).toBe('CLOSED');
    });

    it('should return false for unknown circuit breaker', () => {
        const result = resetCircuitBreaker('unknown');
        expect(result).toBe(false);
    });
});
