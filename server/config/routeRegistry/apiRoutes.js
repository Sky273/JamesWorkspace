import { isStripeCheckoutEnabled } from '../stripe.js';
import {
    registerBusinessDomainRoutes,
    registerCoreApiRoutes,
    registerIntelligenceRoutes,
    registerOperationsRoutes,
    registerResumeDomainRoutes
} from './apiRouteGroups.js';

function getApiCacheHeaders(method) {
    const normalizedMethod = String(method || 'GET').toUpperCase();
    const isSafeMethod = normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS';

    if (isSafeMethod) {
        return {
            'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
    }

    return {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    };
}

export function registerCacheControl(app) {
    app.use('/api', (req, res, next) => {
        res.set(getApiCacheHeaders(req.method));
        next();
    });
}

export function registerApiRoutes(app) {
    registerCoreApiRoutes(app);
    registerResumeDomainRoutes(app);
    registerBusinessDomainRoutes(app);
    registerIntelligenceRoutes(app);
    registerOperationsRoutes(app);

    if (isStripeCheckoutEnabled()) {
        app.use('/api/billing', async (req, res, next) => {
            try {
                const module = await import('../../routes/billing.routes.js');
                return module.default(req, res, next);
            } catch (error) {
                return next(error);
            }
        });
    }
}

export { getApiCacheHeaders };
