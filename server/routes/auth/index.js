/**
 * Auth Routes - Main Entry Point
 * Combines all auth sub-routes into a single router
 */

import express from 'express';
import signinRoutes from './signin.routes.js';
import usersRoutes from './users.routes.js';
import googleRoutes, { destroyAuthOauthStates } from './google.routes.js';

const router = express.Router();

// Mount sub-routes
router.use('/', signinRoutes);
router.use('/', usersRoutes);
router.use('/', googleRoutes);

// Re-export cleanup function
export { destroyAuthOauthStates };

export default router;
