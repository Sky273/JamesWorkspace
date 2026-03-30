import { CACHE_TTL } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

// ============================================
// SIMPLE IN-MEMORY CACHE
// ============================================

class SimpleCache {
    constructor(name, ttl = 600000, maxSize = 1000) {
        this.name = name;
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            invalidations: 0
        };
        
        // Periodic cleanup every 5 minutes to remove expired entries
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    set(key, value) {
        this.stats.sets++;
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.stats.misses++;
            return null;
        }

        const age = Date.now() - item.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.value;
    }

    invalidate(key) {
        this.stats.invalidations++;
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }

    getStats() {
        return {
            name: this.name,
            ttl: this.ttl,
            size: this.cache.size,
            ...this.stats
        };
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
            safeLog('debug', 'Cache cleanup completed', {
                cacheName: this.name,
                entriesRemoved: cleaned,
                cacheSize: this.cache.size
            });
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

export const CACHE_KEYS = {
    settings: {
        UI_SETTINGS: 'settings',
        LLM_SETTINGS: 'llm-settings'
    },
    templates: {
        ALL_TEMPLATES: 'all_templates'
    },
    firms: {
        ALL_FIRMS: 'all_firms'
    }
};

// Create cache instances
export const settingsCache = new SimpleCache('settings', CACHE_TTL.SETTINGS);
export const templatesCache = new SimpleCache('templates', CACHE_TTL.TEMPLATES);
export const firmsCache = new SimpleCache('firms', CACHE_TTL.FIRMS);

export function invalidateSettingsCaches() {
    settingsCache.invalidate(CACHE_KEYS.settings.UI_SETTINGS);
    settingsCache.invalidate(CACHE_KEYS.settings.LLM_SETTINGS);
}

export function getCacheRegistryStats() {
    return {
        settings: settingsCache.getStats(),
        templates: templatesCache.getStats(),
        firms: firmsCache.getStats()
    };
}

// Initialize cache system
safeLog('info', 'Cache system initialized', {
    settingsTTL: `${CACHE_TTL.SETTINGS / 1000}s`,
    templatesTTL: `${CACHE_TTL.TEMPLATES / 1000}s`,
    firmsTTL: `${CACHE_TTL.FIRMS / 1000}s`
});

// Export cleanup function for graceful shutdown
export const cleanupAllCaches = () => {
    settingsCache.destroy();
    templatesCache.destroy();
    firmsCache.destroy();
    safeLog('info', 'All caches destroyed');
};

export default SimpleCache;
