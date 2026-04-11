import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import compression from 'vite-plugin-compression';

import { httpConfigPlugin } from './vite/httpConfigPlugin.js';
import { getHttpsConfig } from './vite/httpsConfig.js';
import { manualChunks } from './vite/manualChunks.js';
import { tiptapV3SourcePlugin } from './vite/tiptapV3SourcePlugin.js';

const OPTIMIZE_DEPENDENCY_INCLUDE = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-i18next',
  'i18next',
  'i18next-browser-languagedetector',
  'html-parse-stringify',
];

const COMPRESSED_ASSET_FILTER = /\.(js|mjs|json|css|html|svg|txt|xml|wasm)$/i;
const COMPRESSION_VERBOSE = process.platform !== 'win32';
const NON_CRITICAL_MODULE_PRELOAD_PATTERNS = [
  /assets\/js\/vendor-react-.*\.js$/,
  /^vendor-react-.*\.js$/,
  /assets\/js\/vendor-ui-.*\.js$/,
  /^vendor-ui-.*\.js$/,
  /assets\/js\/vendor-i18n-.*\.js$/,
  /^vendor-i18n-.*\.js$/,
  /assets\/js\/vendor-utils-.*\.js$/,
  /^vendor-utils-.*\.js$/,
  /assets\/js\/authService-.*\.js$/,
  /^authService-.*\.js$/,
  /assets\/js\/AuthContext-.*\.js$/,
  /^AuthContext-.*\.js$/,
  /assets\/js\/apiInterceptor-.*\.js$/,
  /^apiInterceptor-.*\.js$/,
  /assets\/js\/llmTimeouts-.*\.js$/,
  /^llmTimeouts-.*\.js$/,
  /assets\/js\/vendor-map-core-.*\.js$/,
  /^vendor-map-core-.*\.js$/,
  /assets\/css\/vendor-map-core-.*\.css$/,
  /assets\/js\/vendor-markdown-.*\.js$/,
  /^vendor-markdown-.*\.js$/,
  /assets\/js\/vendor-charts-.*\.js$/,
  /^vendor-charts-.*\.js$/,
  /assets\/js\/vendor-three-.*\.js$/,
  /^vendor-three-.*\.js$/,
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const httpsEnabled = env.VITE_HTTPS_ENABLED === 'true';
  const httpsPort = env.VITE_HTTPS_PORT || '3443';
  const disableAssetCompression = env.VITE_DISABLE_ASSET_COMPRESSION === 'true';

  console.log(`HTTPS_ENABLED: ${httpsEnabled} (env value: "${env.VITE_HTTPS_ENABLED}")`);

  return {
    plugins: [
      tiptapV3SourcePlugin(),
      tailwindcss(),
      react(),
      httpConfigPlugin(),
      ...(
        disableAssetCompression
          ? []
          : [
              compression({
                algorithm: 'gzip',
                ext: '.gz',
                threshold: 1024,
                deleteOriginFile: false,
                filter: COMPRESSED_ASSET_FILTER,
                verbose: COMPRESSION_VERBOSE,
              }),
              compression({
                algorithm: 'brotliCompress',
                ext: '.br',
                threshold: 1024,
                deleteOriginFile: false,
                filter: COMPRESSED_ASSET_FILTER,
                verbose: COMPRESSION_VERBOSE,
              }),
            ]
      ),
    ],
    server: {
      host: '0.0.0.0',
      port: httpsEnabled ? 443 : 5173,
      strictPort: true,
      https: getHttpsConfig({
        certificatesDir: path.resolve(__dirname, '..', 'certificates'),
        httpsEnabled,
      }),
      allowedHosts: ['www.resumeconverter.net', 'resumeconverter.net', 'localhost'],
      hmr: {
        overlay: false,
      },
      proxy: {
        '/api': {
          target: httpsEnabled ? `https://localhost:${httpsPort}` : 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 600000,
          proxyTimeout: 600000,
          rewrite: (requestPath) => requestPath,
          configure: (proxy) => {
            proxy.options.timeout = 600000;
            proxy.options.proxyTimeout = 600000;

            proxy.on('error', (err) => {
              console.error('[Vite Proxy] Error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.socket?.setTimeout(600000);
              console.log('[Vite Proxy] Proxying:', req.method, req.url, '?', proxyReq.path);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('[Vite Proxy] Response:', proxyRes.statusCode, 'from', req.url);
            });
          },
        },
        '/generate-pdf': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: httpsEnabled ? `https://localhost:${httpsPort}` : 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
      fs: {
        strict: true,
        allow: ['.', '..', '../node_modules'],
      },
      middlewareMode: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@root': path.resolve(__dirname, '..'),
        'html-parse-stringify': path.resolve(__dirname, '../node_modules/html-parse-stringify/dist/html-parse-stringify.umd.js'),
      },
    },
    optimizeDeps: {
      force: true,
      rolldownOptions: {
        resolve: {
          mainFields: ['module', 'main'],
        },
      },
      exclude: ['.env', '.env.local', '.env.development', '.env.production'],
      include: OPTIMIZE_DEPENDENCY_INCLUDE,
    },
    build: {
      outDir: 'dist',
      minify: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1100,
      target: 'es2020',
      modulePreload: {
        polyfill: false,
        resolveDependencies: (_filename, deps) =>
          deps.filter(
            (dependency) =>
              !NON_CRITICAL_MODULE_PRELOAD_PATTERNS.some((pattern) => pattern.test(dependency)),
          ),
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks,
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
        onwarn(warning, warn) {
          warn(warning);
        },
        treeshake: {
          moduleSideEffects: true,
          propertyReadSideEffects: false,
        },
      },
    },
  };
});

