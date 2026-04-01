/**
 * Auth Routes
 * Re-exports from modular auth routes for backward compatibility
 * 
 * @deprecated Import from './auth/index.js' instead
 */

// Re-export everything from the modular auth routes
export { destroyAuthOauthStates, startAuthOauthStatesCleanup } from './auth/index.js';

// Default export for backward compatibility
export { default } from './auth/index.js';
