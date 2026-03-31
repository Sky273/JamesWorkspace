/**
 * Route Registry
 * Aggregates route registration by responsibility.
 */

export { registerSwaggerRoutes } from './routeRegistry/swaggerRoutes.js';
export { registerCacheControl, registerApiRoutes } from './routeRegistry/apiRoutes.js';
export { registerProxyRoutes } from './routeRegistry/proxyRoutes.js';
