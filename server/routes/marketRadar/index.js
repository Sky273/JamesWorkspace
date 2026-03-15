/**
 * Market Radar Routes - Main Entry Point
 * Mounts all sub-routers for backward compatibility
 * 
 * Structure:
 * - collection.routes.js : /collect, /collect/:source
 * - facts.routes.js      : /facts/*, /latest, /trend, /regional
 * - search.routes.js     : /search/*, /salary-histogram, /top-companies
 * - reference.routes.js  : /referentiel, /categories, /config
 * - trends.routes.js     : /trends/*
 */

import express from 'express';
import collectionRoutes from './collection.routes.js';
import factsRoutes from './facts.routes.js';
import searchRoutes from './search.routes.js';
import referenceRoutes from './reference.routes.js';
import trendsRoutes from './trends.routes.js';

const router = express.Router();

// Mount all sub-routers at root level (they define their own paths)
router.use('/', collectionRoutes);
router.use('/', factsRoutes);
router.use('/', searchRoutes);
router.use('/', referenceRoutes);
router.use('/', trendsRoutes);

export default router;
