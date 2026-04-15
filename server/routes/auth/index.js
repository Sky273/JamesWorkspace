/**
 * Auth Routes - Main Entry Point
 * Combines all auth sub-routes into a single router
 */

import express from 'express';
import signinRoutes from './signin.routes.js';
import usersRoutes from './users.routes.js';

const router = express.Router();

function createLazyAuthRoute(modulePath) {
    let routeModulePromise = null;

    return async (req, res, next) => {
        try {
            if (!routeModulePromise) {
                routeModulePromise = import(modulePath);
            }

            const routeModule = await routeModulePromise;
            return routeModule.default(req, res, next);
        } catch (error) {
            return next(error);
        }
    };
}

// Mount sub-routes
router.use('/', signinRoutes);
router.use('/', usersRoutes);
router.use('/', createLazyAuthRoute('./google.routes.js'));
router.use('/', createLazyAuthRoute('./passwordReset.routes.js'));

export default router;
