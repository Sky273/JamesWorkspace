/// <reference types="vite/client" />

/**
 * Vite Environment Variables
 * 
 * SECURITY NOTE: Never add API keys or secrets here!
 * All sensitive operations must go through the proxy server.
 * Only non-sensitive, public configuration should be exposed to the frontend.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
