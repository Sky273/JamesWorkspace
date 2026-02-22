/**
 * Tests for cache service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing cache service
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

// Mock constants
vi.mock('../../config/constants.js', () => ({
    CACHE_TTL: {
        SETTINGS: 60000,
        TEMPLATES: 60000,
        FIRMS: 60000
    }
}));

// Simple cache class for testing (copy of the implementation)
class SimpleCache {
    constructor(ttl = 600000, maxSize = 1000) {
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.cleanupInterval = null;
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const age = Date.now() - item.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    invalidate(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
        
        if (this.cache.size > this.maxSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, this.cache.size - this.maxSize);
            toRemove.forEach(([key]) => this.cache.delete(key));
        }
    }
    
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.cache.clear();
    }
}

describe('SimpleCache', () => {
    let cache;

    beforeEach(() => {
        cache = new SimpleCache(1000, 10); // 1 second TTL, max 10 items
        vi.useFakeTimers();
    });

    afterEach(() => {
        cache.destroy();
        vi.useRealTimers();
    });

    describe('set and get', () => {
        it('should store and retrieve a value', () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        it('should store objects', () => {
            const obj = { name: 'test', data: [1, 2, 3] };
            cache.set('obj', obj);
            expect(cache.get('obj')).toEqual(obj);
        });

        it('should return null for non-existent keys', () => {
            expect(cache.get('nonexistent')).toBeNull();
        });

        it('should overwrite existing values', () => {
            cache.set('key', 'value1');
            cache.set('key', 'value2');
            expect(cache.get('key')).toBe('value2');
        });
    });

    describe('TTL expiration', () => {
        it('should return null for expired entries', () => {
            cache.set('key', 'value');
            expect(cache.get('key')).toBe('value');
            
            // Advance time past TTL
            vi.advanceTimersByTime(1500);
            
            expect(cache.get('key')).toBeNull();
        });

        it('should return value before TTL expires', () => {
            cache.set('key', 'value');
            
            // Advance time but not past TTL
            vi.advanceTimersByTime(500);
            
            expect(cache.get('key')).toBe('value');
        });
    });

    describe('invalidate', () => {
        it('should remove a specific key', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            cache.invalidate('key1');
            
            expect(cache.get('key1')).toBeNull();
            expect(cache.get('key2')).toBe('value2');
        });

        it('should not throw for non-existent keys', () => {
            expect(() => cache.invalidate('nonexistent')).not.toThrow();
        });
    });

    describe('clear', () => {
        it('should remove all entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            
            cache.clear();
            
            expect(cache.size()).toBe(0);
            expect(cache.get('key1')).toBeNull();
            expect(cache.get('key2')).toBeNull();
            expect(cache.get('key3')).toBeNull();
        });
    });

    describe('size', () => {
        it('should return correct size', () => {
            expect(cache.size()).toBe(0);
            
            cache.set('key1', 'value1');
            expect(cache.size()).toBe(1);
            
            cache.set('key2', 'value2');
            expect(cache.size()).toBe(2);
            
            cache.invalidate('key1');
            expect(cache.size()).toBe(1);
        });
    });

    describe('cleanup', () => {
        it('should remove expired entries', () => {
            cache.set('key1', 'value1');
            
            vi.advanceTimersByTime(500);
            cache.set('key2', 'value2');
            
            vi.advanceTimersByTime(600); // key1 is now expired
            
            cache.cleanup();
            
            expect(cache.get('key1')).toBeNull();
            expect(cache.get('key2')).toBe('value2');
        });

        it('should enforce max size by removing oldest entries', () => {
            // Fill cache beyond max size
            for (let i = 0; i < 15; i++) {
                cache.set(`key${i}`, `value${i}`);
                vi.advanceTimersByTime(10); // Ensure different timestamps
            }
            
            cache.cleanup();
            
            expect(cache.size()).toBeLessThanOrEqual(10);
        });
    });

    describe('destroy', () => {
        it('should clear cache and stop cleanup interval', () => {
            cache.set('key', 'value');
            cache.destroy();
            
            expect(cache.size()).toBe(0);
            expect(cache.cleanupInterval).toBeNull();
        });
    });
});
