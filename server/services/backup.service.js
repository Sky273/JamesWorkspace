/**
 * Backup Service
 * Re-exports from modular backup services for backward compatibility
 * 
 * @deprecated Import from './backup/index.js' instead
 */

// Re-export everything from the modular backup services
export * from './backup/index.js';

// Default export for backward compatibility
export { default } from './backup/index.js';
