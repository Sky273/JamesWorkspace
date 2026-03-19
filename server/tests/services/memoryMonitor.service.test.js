/**
 * Tests for Memory Monitor Service
 * Tests memory usage reporting, cache cleanup registration, start/stop
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    getMemoryUsage,
    registerCacheCleanupFunctions,
    startMemoryMonitor,
    stopMemoryMonitor
} from '../../services/memoryMonitor.service.js';

describe('Memory Monitor Service', () => {
    afterEach(() => {
        stopMemoryMonitor();
    });

    describe('getMemoryUsage', () => {
        it('should return memory stats in MB', () => {
            const mem = getMemoryUsage();

            expect(mem.rss).toBeGreaterThan(0);
            expect(mem.heapTotal).toBeGreaterThan(0);
            expect(mem.heapUsed).toBeGreaterThan(0);
            expect(typeof mem.external).toBe('number');
        });
    });

    describe('registerCacheCleanupFunctions', () => {
        it('should accept array of functions', () => {
            expect(() => registerCacheCleanupFunctions([vi.fn(), vi.fn()])).not.toThrow();
        });
    });

    describe('startMemoryMonitor / stopMemoryMonitor', () => {
        it('should start and stop without errors', () => {
            expect(() => startMemoryMonitor()).not.toThrow();
            expect(() => stopMemoryMonitor()).not.toThrow();
        });

        it('should be safe to call stop multiple times', () => {
            startMemoryMonitor();
            expect(() => stopMemoryMonitor()).not.toThrow();
            expect(() => stopMemoryMonitor()).not.toThrow();
        });
    });
});
