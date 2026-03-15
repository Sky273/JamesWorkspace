/**
 * Market Radar Routes
 * 
 * This file re-exports the modular market radar routes from ./marketRadar/
 * 
 * Structure:
 * - ./marketRadar/index.js              : Main router (mounts sub-routers)
 * - ./marketRadar/collection.routes.js   : /collect, /collect/:source
 * - ./marketRadar/facts.routes.js        : /facts/*, /latest, /trend, /regional
 * - ./marketRadar/search.routes.js       : /search/*, /salary-histogram, /top-companies
 * - ./marketRadar/reference.routes.js    : /referentiel, /categories, /config
 * - ./marketRadar/trends.routes.js       : /trends/*
 */

export { default } from './marketRadar/index.js';
