import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateQuery, validators } from '../utils/validation.js';
import { getSecurityLogs, getSecurityLogsCount } from '../services/security.service.js';
import { getProxyLogs, getProxyLogsCount, getProxyLogsStats, safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout } from '../utils/postgresHelpers.js';

const router = express.Router();

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/admin/security-logs - Get security and proxy logs combined
router.get('/security-logs', authenticateToken, requireAdmin, validateQuery({
    limit: (val) => {
        if (val === 'all') {
            return { valid: true, value: 'all' };
        }
        return validators.positiveInteger(val);
    },
    offset: validators.positiveInteger,
    level: validators.enum(['INFO', 'WARNING', 'ERROR', 'SECURITY', 'DEBUG', 'WARN']),
    event: validators.maxLength(100),
    source: validators.enum(['security', 'proxy'])
}), (req, res) => {
    try {
        const { level, event, source, limit = 100, offset = 0 } = req.query;
        const parsedLimit = limit === 'all' ? Infinity : parseInt(limit);
        const parsedOffset = parseInt(offset) || 0;
        const normalizedLevel = level?.toUpperCase();
        
        // Get logs from appropriate source(s) - already sorted newest first
        let logs;
        if (source === 'security') {
            logs = getSecurityLogs().map(log => ({ ...log, source: 'security' }));
        } else if (source === 'proxy') {
            logs = getProxyLogs();
        } else {
            // Merge both sources - they're already sorted, use merge sort approach
            const secLogs = getSecurityLogs().map(log => ({ ...log, source: 'security' }));
            const proxyLogsArr = getProxyLogs();
            logs = mergeSortedArrays(secLogs, proxyLogsArr);
        }
        
        // Apply filters in single pass and collect results up to limit+offset
        const filteredLogs = [];
        let totalMatching = 0;
        
        for (const log of logs) {
            // Apply filters
            if (normalizedLevel && log.level?.toUpperCase() !== normalizedLevel) continue;
            if (event && log.event !== event) continue;
            
            totalMatching++;
            
            // Only collect logs within the requested window
            if (totalMatching > parsedOffset && filteredLogs.length < parsedLimit) {
                filteredLogs.push(log);
            }
        }
        
        res.json({
            logs: filteredLogs,
            total: totalMatching,
            offset: parsedOffset,
            limit: limit === 'all' ? 'all' : parsedLimit
        });
    } catch (error) {
        safeLog('error', 'Error fetching security logs', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch security logs' });
    }
});

/**
 * Merge two sorted arrays (newest first) into one sorted array
 * O(n+m) instead of O((n+m) * log(n+m)) for concat+sort
 */
function mergeSortedArrays(arr1, arr2) {
    const result = [];
    let i = 0, j = 0;
    
    while (i < arr1.length && j < arr2.length) {
        const time1 = new Date(arr1[i].timestamp).getTime();
        const time2 = new Date(arr2[j].timestamp).getTime();
        
        if (time1 >= time2) {
            result.push(arr1[i++]);
        } else {
            result.push(arr2[j++]);
        }
    }
    
    // Add remaining elements
    while (i < arr1.length) result.push(arr1[i++]);
    while (j < arr2.length) result.push(arr2[j++]);
    
    return result;
}

// GET /api/admin/security-stats - Get combined security and proxy statistics
router.get('/security-stats', authenticateToken, requireAdmin, (req, res) => {
    try {
        // Get counts from optimized functions
        const securityCount = getSecurityLogsCount();
        const proxyCount = getProxyLogsCount();
        
        // Get proxy logs stats (already optimized)
        const proxyStats = getProxyLogsStats();
        
        // Initialize stats
        const stats = {
            total: securityCount + proxyCount,
            byLevel: { ...proxyStats.byLevel },
            byEvent: {},
            bySource: {
                security: securityCount,
                proxy: proxyCount
            },
            recent: {
                last24h: proxyStats.recent.last24h,
                lastHour: proxyStats.recent.lastHour
            }
        };
        
        // Process security logs for additional stats
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;
        
        for (const log of getSecurityLogs()) {
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            if (log.event) {
                stats.byEvent[log.event] = (stats.byEvent[log.event] || 0) + 1;
            }
            
            const logTime = new Date(log.timestamp).getTime();
            if (logTime > oneDayAgo) stats.recent.last24h++;
            if (logTime > oneHourAgo) stats.recent.lastHour++;
        }
        
        res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching security stats', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch security stats' });
    }
});

// GET /api/admin/users - Get all users (admin only) - alias for /api/auth/users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const records = await selectWithTimeout('users', {});
        const users = records.map(record => ({
            id: record.id,
            name: record.name,
            email: record.email,
            customer: record.customer_name,
            role: record.role || 'user',
            status: record.status || 'Active',
            Name: record.name,
            Email: record.email,
            CustomerName: record.customer_name,
            Role: record.role,
            Status: record.status
        }));
        res.json(users);
    } catch (error) {
        safeLog('error', 'Error fetching users', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

export default router;
