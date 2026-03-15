/**
 * Templates Routes
 * 
 * This file re-exports the modular templates routes from ./templates/
 * 
 * Structure:
 * - ./templates/index.js              : Main router (mounts sub-routers)
 * - ./templates/crud.routes.js        : GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 * - ./templates/extraction.routes.js  : POST /extract-from-cv (DOCX/PDF extraction)
 */

export { default } from './templates/index.js';
