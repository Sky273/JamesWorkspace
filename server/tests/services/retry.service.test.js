/**
 * Tests for Retry Service
 * Tests withRetry, circuit breaker, delay calculation, and management functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    withRetry,
    createRetryWrapper,
    CircuitBreaker,
    getCircuitBreakerStates,
    resetCircuitBreaker,
    resetAllCircuitBreakers
} from '../../services/retry.service.js';

describe('Retry Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAllCircuitBreakers();
    });

    describe('CircuitBreaker', () => {
        it('should start in CLOSED state', () => {
            const cb = new CircuitBreaker('test');
            expect(cb.getState().state).toBe('CLOSED');
        });

        it('should allow execution when CLOSED', () => {
            const cb = new CircuitBreaker('test');
            expect(cb.canExecute()).toBe(true);
        });

        it('should open after reaching failure threshold', () => {
            const cb = new CircuitBreaker('test', { failureThreshold: 3 });

            cb.recordFailure();
            cb.recordFailure();
            expect(cb.getState().state).toBe('CLOSED');

            cb.recordFailure();
            expect(cb.getState().state).toBe('OPEN');
        });

        it('should block execution when OPEN', () => {
            const cb = new CircuitBreaker('test', { failureThreshold: 1 });
            cb.recordFailure();
            expect(cb.canExecute()).toBe(false);
        });

        it('should transition to HALF_OPEN after reset timeout', () => {
            const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 100 });
            cb.recordFailure(); // OPEN
            // Simulate time passing by backdating lastFailureTime
            cb.lastFailureTime = Date.now() - 200;
            expect(cb.canExecute()).toBe(true);
            expect(cb.getState().state).toBe('HALF_OPEN');
        });

        it('should close after enough successes in HALF_OPEN', () => {
            const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 100, halfOpenMaxCalls: 2 });
            cb.recordFailure(); // OPEN
            cb.lastFailureTime = Date.now() - 200;
            cb.canExecute(); // transitions to HALF_OPEN

            cb.recordSuccess();
            cb.recordSuccess();
            expect(cb.getState().state).toBe('CLOSED');
        });

        it('should re-open on failure in HALF_OPEN', () => {
            const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeoutMs: 100 });
            cb.recordFailure(); // OPEN
            cb.lastFailureTime = Date.now() - 200;
            cb.canExecute(); // HALF_OPEN

            cb.recordFailure();
            expect(cb.getState().state).toBe('OPEN');
        });

        it('should reset to initial state', () => {
            const cb = new CircuitBreaker('test', { failureThreshold: 1 });
            cb.recordFailure();
            expect(cb.getState().state).toBe('OPEN');

            cb.reset();
            expect(cb.getState().state).toBe('CLOSED');
            expect(cb.getState().failures).toBe(0);
        });
    });

    describe('withRetry', () => {
        it('should return result on first success', async () => {
            const fn = vi.fn(() => Promise.resolve('ok'));

            const result = await withRetry(fn, { operationName: 'test' });

            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on retryable error and succeed', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
                .mockResolvedValueOnce('ok');

            const result = await withRetry(fn, {
                operationName: 'test',
                retryConfig: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 10 }
            });

            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should retry on aborted transport errors', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('aborted'))
                .mockResolvedValueOnce('ok');

            const result = await withRetry(fn, {
                serviceName: 'deepseek',
                operationName: 'deepseek-test',
                retryConfig: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 10 }
            });

            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should throw on non-retryable error immediately', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('bad request'));

            await expect(withRetry(fn, {
                operationName: 'test',
                retryConfig: { maxRetries: 3, initialDelayMs: 1 }
            })).rejects.toThrow('bad request');

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should throw after exhausting retries', async () => {
            const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
            const fn = vi.fn().mockRejectedValue(err);

            await expect(withRetry(fn, {
                operationName: 'test',
                retryConfig: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 5 }
            })).rejects.toThrow('timeout');

            expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
        });

        it('should throw CIRCUIT_OPEN when breaker is open', async () => {
            // Open the openai circuit breaker by recording failures
            resetCircuitBreaker('openai');
            // Manually trigger enough failures
            for (let i = 0; i < 6; i++) {
                try {
                    await withRetry(() => Promise.reject(new Error('fail')), {
                        serviceName: 'openai',
                        operationName: 'test'
                    });
                } catch (_) { /* expected */ }
            }

            await expect(withRetry(() => Promise.resolve('ok'), {
                serviceName: 'openai',
                operationName: 'test'
            })).rejects.toThrow('Circuit breaker OPEN');
        });
    });

    describe('createRetryWrapper', () => {
        it('should create a wrapper function', () => {
            const wrapper = createRetryWrapper('openai');
            expect(typeof wrapper).toBe('function');
        });
    });

    describe('Circuit breaker management', () => {
        it('getCircuitBreakerStates should return all states', () => {
            const states = getCircuitBreakerStates();
            expect(states.openai).toBeDefined();
            expect(states.anthropic).toBeDefined();
            expect(states.deepseek).toBeDefined();
            expect(states.glm).toBeDefined();
            expect(states.minimax).toBeDefined();
        });

        it('resetCircuitBreaker should reset specific breaker', () => {
            expect(resetCircuitBreaker('openai')).toBe(true);
            expect(resetCircuitBreaker('nonexistent')).toBe(false);
        });

        it('resetAllCircuitBreakers should not throw', () => {
            expect(() => resetAllCircuitBreakers()).not.toThrow();
        });
    });
});
