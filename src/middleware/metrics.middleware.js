import { metrics } from '../services/metrics.service.js';

// ============================================
// METRICS TRACKING MIDDLEWARE
// ============================================

/**
 * Middleware to track all requests and responses
 */
export function metricsMiddleware(req, res, next) {
    const startTime = Date.now();
    
    // Track request
    metrics.trackRequest(req.method, req.path);
    
    // Track response when finished - use 'finish' event which fires for all response types
    const finishHandler = () => {
        const responseTime = Date.now() - startTime;
        metrics.trackResponse(res.statusCode, responseTime);
        
        // Track errors (4xx and 5xx)
        if (res.statusCode >= 400) {
            const error = new Error(`HTTP ${res.statusCode}`);
            error.name = `HTTP${res.statusCode}Error`;
            metrics.trackError(error, req.path);
        }
        
        // Remove listener to prevent memory leak
        res.removeListener('finish', finishHandler);
    };
    
    res.on('finish', finishHandler);
    
    next();
}

/**
 * Wrapper for error handling that tracks errors
 */
export function trackError(error, req) {
    metrics.trackError(error, req.path);
}

export default metricsMiddleware;
