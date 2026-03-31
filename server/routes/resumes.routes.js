/**
 * Resume Routes
 * 
 * This file re-exports the modular resume routes from ./resumes/
 * 
 * Structure:
 * - ./resumes/index.js         : Main router aggregating all modules
 * - ./resumes/crud.routes.js   : GET /, GET /:id, PUT /:id, DELETE /:id
 * - ./resumes/upload.routes.js : POST /extract-doc, POST /extract-pdf
 * - ./resumes/stats.routes.js  : GET /stats, GET /grouped-by-deal
 * - ./resumes/aiModify.handler.js : AI modification handler
 * - ./resumes/versions.routes.js : Version management
 * - ./resumes/helpers.js       : Shared utility functions
 */

import router from './resumes/index.js';

export default router;
