/**
 * API Documentation Routes
 * Serves OpenAPI/Swagger documentation
 * 
 * Note: The Swagger UI HTML page is served by registerSwaggerRoutes() in routeRegistry.js
 * with externalized scripts for CSP compliance. This router only handles the JSON endpoint
 * as a fallback (the primary JSON endpoint is also in registerSwaggerRoutes).
 */

import express from 'express';
import { swaggerDocument } from '../config/swagger.js';

const router = express.Router();

// GET /api/docs - Get OpenAPI specification as JSON
router.get('/', (req, res) => {
    res.json(swaggerDocument);
});

// GET /api/docs/ui - Redirect to the CSP-compliant Swagger UI
// The actual Swagger UI is served by registerSwaggerRoutes() in routeRegistry.js
// which uses externalized scripts (no inline scripts) for CSP compliance
router.get('/ui', (req, res) => {
    // registerSwaggerRoutes already handles this route before this router,
    // but if somehow reached, fall back to the JSON spec instead of looping.
    res.redirect('/api/docs');
});

export default router;
