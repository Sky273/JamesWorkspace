import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import commonjs from '@rollup/plugin-commonjs';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import compression from 'vite-plugin-compression';

// Plugin to configure HTTP server timeouts and diagnose 400 errors
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

export default defineConfig({
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
    port: 5173,
    strictPort: true,
    allowedHosts: ['www.resumeconverter.net', 'resumeconverter.net', 'localhost'],
    hmr: false, // Disable HMR for external domain access
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
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
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: false,
      allow: ['..']
    }
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
});
