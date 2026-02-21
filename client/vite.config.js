import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import commonjs from '@rollup/plugin-commonjs';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import compression from 'vite-plugin-compression';
import zlib from 'zlib';

// Plugin to configure HTTP server timeouts, compression, and diagnose 400 errors
const httpConfigPlugin = () => ({
  name: 'http-config',
  configureServer(server) {
    // Log cache cleanup on startup
    console.log('\n🧹 Vite cache cleaned on startup (--force flag)');
    console.log('✅ Dependencies re-optimized\n');
    
    // Configure the underlying HTTP server once it's created
    server.httpServer?.on('listening', () => {
      const httpServer = server.httpServer;
      // Increase keep-alive timeout to 30 minutes (default is 5 seconds in Node.js)
      httpServer.keepAliveTimeout = 30 * 60 * 1000; // 30 minutes
      // Headers timeout should be slightly higher
      httpServer.headersTimeout = 31 * 60 * 1000; // 31 minutes
      // Request timeout
      httpServer.requestTimeout = 5 * 60 * 1000; // 5 minutes for request processing
      console.log('[Vite] HTTP server timeouts configured: keepAlive=30min, headers=31min');
      console.log('[Vite] Compression middleware enabled (gzip/brotli)');
    });
    
    // Compression middleware for dev server (same behavior as production)
    server.middlewares.use((req, res, next) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const url = req.url || '';
      
      // Skip SPA routes (paths without file extensions that are not API calls)
      // These should be handled by Vite's SPA fallback, not as static files
      const isSpaRoute = !url.includes('.') && !url.startsWith('/api/') && !url.startsWith('/@') && !url.startsWith('/node_modules/');
      if (isSpaRoute && url !== '/') {
        return next();
      }
      
      // Only compress text-based assets
      const compressibleExtensions = /\.(js|mjs|css|html|json|svg|txt|xml)(\?.*)?$/i;
      const shouldCompress = compressibleExtensions.test(url);
      
      if (shouldCompress && (acceptEncoding.includes('br') || acceptEncoding.includes('gzip'))) {
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);
        const chunks = [];
        
        res.write = function(chunk, encoding, callback) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          if (typeof encoding === 'function') {
            callback = encoding;
            encoding = undefined;
          }
          if (callback) callback();
          return true;
        };
        
        res.end = function(chunk, encoding, callback) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          
          const body = Buffer.concat(chunks);
          
          // Only compress if body is larger than 1KB
          if (body.length > 1024) {
            const useBrotli = acceptEncoding.includes('br');
            const compressMethod = useBrotli ? zlib.brotliCompressSync : zlib.gzipSync;
            const encoding = useBrotli ? 'br' : 'gzip';
            
            try {
              const compressed = compressMethod(body);
              res.setHeader('Content-Encoding', encoding);
              res.setHeader('Vary', 'Accept-Encoding');
              res.removeHeader('Content-Length');
              return originalEnd.call(res, compressed, callback);
            } catch (e) {
              // Fallback to uncompressed on error
              return originalEnd.call(res, body, callback);
            }
          }
          
          return originalEnd.call(res, body, callback);
        };
      }
      
      next();
    });
    
    // Log all requests at the earliest possible point
    server.middlewares.use((req, res, next) => {
      console.log(`[Vite] ${new Date().toISOString()} ${req.method} ${req.url}`);
      
      // Intercept response to log errors
      const originalEnd = res.end.bind(res);
      res.end = function(...args) {
        if (res.statusCode >= 400) {
          console.error(`[Vite] Error ${res.statusCode} on ${req.method} ${req.url}`);
        }
        return originalEnd(...args);
      };
      
      next();
    });
  }
});

// HTTPS configuration helper
const getHttpsConfig = (httpsEnabled) => {
  if (!httpsEnabled) return false;
  
  const certsPath = path.resolve(__dirname, '..', 'certificates');
  const keyPath = path.join(certsPath, 'private.key');
  const certPath = path.join(certsPath, 'certificate.crt');
  
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.warn('⚠️  HTTPS enabled but certificates not found. Falling back to HTTP.');
    return false;
  }
  
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
};

export default defineConfig(({ mode }) => {
  // Load env from client directory (VITE_ prefixed variables)
  const env = loadEnv(mode, __dirname, '');
  const HTTPS_ENABLED = env.VITE_HTTPS_ENABLED === 'true';
  const HTTPS_PORT = env.VITE_HTTPS_PORT || '3443';
  
  console.log(`🔐 HTTPS_ENABLED: ${HTTPS_ENABLED} (env value: "${env.VITE_HTTPS_ENABLED}")`);
  
  return {
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    httpConfigPlugin(),
    // Gzip compression for production builds
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files > 1KB
      deleteOriginFile: false,
      filter: /\.(js|mjs|json|css|html|svg|txt|xml|wasm)$/i,
    }),
    // Brotli compression (better compression ratio)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
      filter: /\.(js|mjs|json|css|html|svg|txt|xml|wasm)$/i,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: HTTPS_ENABLED ? 443 : 5173,
    strictPort: true,
    https: getHttpsConfig(HTTPS_ENABLED),
    allowedHosts: ['www.resumeconverter.net', 'resumeconverter.net', 'localhost'],
    hmr: false, // Disable HMR for external domain access
    proxy: {
      '/api': {
        target: HTTPS_ENABLED ? `https://localhost:${HTTPS_PORT}` : 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 600000, // 10 minutes timeout for proxy
        proxyTimeout: 600000, // 10 minutes timeout for proxy connection
        rewrite: (path) => path,
        configure: (proxy, options) => {
          // Set proxy timeout to 10 minutes
          proxy.options.timeout = 600000;
          proxy.options.proxyTimeout = 600000;
          
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] Error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Set socket timeout on the outgoing request to 10 minutes
            proxyReq.socket?.setTimeout(600000);
            console.log('[Vite Proxy] Proxying:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
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
        target: HTTPS_ENABLED ? `https://localhost:${HTTPS_PORT}` : 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: true,
      allow: ['.', '..', '../node_modules']
    },
    // Ensure SPA routing works - all non-file requests should serve index.html
    middlewareMode: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '/tinymce': path.resolve(__dirname, '../node_modules/tinymce'),
      '@root': path.resolve(__dirname, '..'),
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // Fix for React exports not being recognized
      mainFields: ['module', 'main'],
    },
    // Exclude .env files from optimization
    exclude: ['.env', '.env.local', '.env.development', '.env.production'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'tinymce/tinymce',
      'tinymce/icons/default',
      'tinymce/themes/silver',
      'tinymce/models/dom/model',
      'tinymce/plugins/advlist',
      'tinymce/plugins/autolink',
      'tinymce/plugins/lists',
      'tinymce/plugins/link',
      'tinymce/plugins/image',
      'tinymce/plugins/charmap',
      'tinymce/plugins/preview',
      'tinymce/plugins/anchor',
      'tinymce/plugins/searchreplace',
      'tinymce/plugins/visualblocks',
      'tinymce/plugins/code',
      'tinymce/plugins/fullscreen',
      'tinymce/plugins/insertdatetime',
      'tinymce/plugins/media',
      'tinymce/plugins/table',
      'tinymce/plugins/help',
      'tinymce/plugins/wordcount'
    ]
  },
  build: {
    // Output directory (inside client/)
    outDir: 'dist',
    // Use esbuild for minification (faster and more stable than terser)
    minify: 'esbuild',
    // Enable source maps for debugging
    sourcemap: true,
    // Chunk size warning limit (in kB)
    chunkSizeWarningLimit: 500,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Disable modulePreload polyfill to avoid unused preload warnings in production
    modulePreload: {
      polyfill: false
    },
    commonjsOptions: {
      include: [/tinymce/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: [
        commonjs({
          include: /node_modules/,
          transformMixedEsModules: true,
        }),
      ],
      output: {
        // Manual chunk splitting for better caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) {
              return 'vendor-react';
            }
            // UI libraries
            if (id.includes('framer-motion') || id.includes('@headlessui') || id.includes('@heroicons')) {
              return 'vendor-ui';
            }
            // Charts
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            // Map libraries
            if (id.includes('maplibre') || id.includes('react-map-gl') || id.includes('mapbox')) {
              return 'vendor-map';
            }
            // PDF libraries
            if (id.includes('pdfjs-dist') || id.includes('html2pdf') || id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            // TinyMCE
            if (id.includes('tinymce')) {
              return 'vendor-tinymce';
            }
            // i18n
            if (id.includes('i18next')) {
              return 'vendor-i18n';
            }
            // Three.js (WebGL)
            if (id.includes('three')) {
              return 'vendor-three';
            }
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      onwarn(warning, warn) {
        // Suppress warnings about vite-plugin-node-polyfills
        if (warning.message?.includes('vite-plugin-node-polyfills')) {
          return;
        }
        warn(warning);
      },
      // Tree-shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
      },
    }
  }
};
});
