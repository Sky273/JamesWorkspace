import { CACHE_TTL } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

// ============================================
// SIMPLE IN-MEMORY CACHE
// ============================================

class SimpleCache {
    constructor(ttl = 600000, maxSize = 1000) {
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
        
        // Periodic cleanup every 5 minutes to remove expired entries
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
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
        let cleaned = 0;
        
        // Remove expired entries
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        // Enforce max size (remove oldest entries if over limit)
        if (this.cache.size > this.maxSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, this.cache.size - this.maxSize);
            toRemove.forEach(([key]) => this.cache.delete(key));
            cleaned += toRemove.length;
        }
        
        if (cleaned > 0) {
            safeLog('debug', 'Cache cleanup completed', { entriesRemoved: cleaned, cacheSize: this.cache.size });
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

// Create cache instances
export const settingsCache = new SimpleCache(CACHE_TTL.SETTINGS);
export const templatesCache = new SimpleCache(CACHE_TTL.TEMPLATES);
export const customersCache = new SimpleCache(CACHE_TTL.CUSTOMERS);

// Initialize cache system
safeLog('info', 'Cache system initialized', {
    settingsTTL: `${CACHE_TTL.SETTINGS / 1000}s`,
    templatesTTL: `${CACHE_TTL.TEMPLATES / 1000}s`,
    customersTTL: `${CACHE_TTL.CUSTOMERS / 1000}s`
});

// Export cleanup function for graceful shutdown
export const cleanupAllCaches = () => {
    settingsCache.destroy();
    templatesCache.destroy();
    customersCache.destroy();
    safeLog('info', 'All caches destroyed');
};

export default SimpleCache;
