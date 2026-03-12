// vite.config.js
import { defineConfig, loadEnv } from "file:///C:/Users/mail/CascadeProjects/ResumeConverter/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/mail/CascadeProjects/ResumeConverter/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import fs from "fs";
import commonjs from "file:///C:/Users/mail/CascadeProjects/ResumeConverter/node_modules/@rollup/plugin-commonjs/dist/es/index.js";
import { nodePolyfills } from "file:///C:/Users/mail/CascadeProjects/ResumeConverter/node_modules/vite-plugin-node-polyfills/dist/index.js";
import compression from "file:///C:/Users/mail/CascadeProjects/ResumeConverter/node_modules/vite-plugin-compression/dist/index.mjs";
import zlib from "zlib";
var __vite_injected_original_dirname = "C:\\Users\\mail\\CascadeProjects\\ResumeConverter\\client";
var httpConfigPlugin = () => ({
  name: "http-config",
  configureServer(server) {
    console.log("\n\u{1F9F9} Vite cache cleaned on startup (--force flag)");
    console.log("\u2705 Dependencies re-optimized\n");
    server.httpServer?.on("listening", () => {
      const httpServer = server.httpServer;
      httpServer.keepAliveTimeout = 30 * 60 * 1e3;
      httpServer.headersTimeout = 31 * 60 * 1e3;
      httpServer.requestTimeout = 5 * 60 * 1e3;
      console.log("[Vite] HTTP server timeouts configured: keepAlive=30min, headers=31min");
      console.log("[Vite] Compression middleware enabled (gzip/brotli)");
    });
    server.middlewares.use((req, res, next) => {
      const acceptEncoding = req.headers["accept-encoding"] || "";
      const url = req.url || "";
      const isSpaRoute = !url.includes(".") && !url.startsWith("/api/") && !url.startsWith("/@") && !url.startsWith("/node_modules/");
      if (isSpaRoute && url !== "/") {
        return next();
      }
      const compressibleExtensions = /\.(js|mjs|css|html|json|svg|txt|xml)(\?.*)?$/i;
      const shouldCompress = compressibleExtensions.test(url);
      if (shouldCompress && (acceptEncoding.includes("br") || acceptEncoding.includes("gzip"))) {
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);
        const chunks = [];
        res.write = function(chunk, encoding, callback) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          if (typeof encoding === "function") {
            callback = encoding;
            encoding = void 0;
          }
          if (callback) callback();
          return true;
        };
        res.end = function(chunk, encoding, callback) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const body = Buffer.concat(chunks);
          if (body.length > 1024) {
            const useBrotli = acceptEncoding.includes("br");
            const compressMethod = useBrotli ? zlib.brotliCompressSync : zlib.gzipSync;
            const encoding2 = useBrotli ? "br" : "gzip";
            try {
              const compressed = compressMethod(body);
              res.setHeader("Content-Encoding", encoding2);
              res.setHeader("Vary", "Accept-Encoding");
              res.removeHeader("Content-Length");
              return originalEnd.call(res, compressed, callback);
            } catch (e) {
              return originalEnd.call(res, body, callback);
            }
          }
          return originalEnd.call(res, body, callback);
        };
      }
      next();
    });
    server.middlewares.use((req, res, next) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(302, { Location: "/favicon.svg" });
        res.end();
        return;
      }
      next();
    });
    server.middlewares.use((req, res, next) => {
      if (req.url === "/favicon.svg" || req.url === "/favicon.ico") {
        return next();
      }
      console.log(`[Vite] ${(/* @__PURE__ */ new Date()).toISOString()} ${req.method} ${req.url}`);
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
var getHttpsConfig = (httpsEnabled) => {
  if (!httpsEnabled) return false;
  const certsPath = path.resolve(__vite_injected_original_dirname, "..", "certificates");
  const keyPath = path.join(certsPath, "private.key");
  const certPath = path.join(certsPath, "certificate.crt");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.warn("\u26A0\uFE0F  HTTPS enabled but certificates not found. Falling back to HTTP.");
    return false;
  }
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
};
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, __vite_injected_original_dirname, "");
  const HTTPS_ENABLED = env.VITE_HTTPS_ENABLED === "true";
  const HTTPS_PORT = env.VITE_HTTPS_PORT || "3443";
  console.log(`\u{1F510} HTTPS_ENABLED: ${HTTPS_ENABLED} (env value: "${env.VITE_HTTPS_ENABLED}")`);
  return {
    plugins: [
      react(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true
        },
        protocolImports: true
      }),
      httpConfigPlugin(),
      // Gzip compression for production builds
      compression({
        algorithm: "gzip",
        ext: ".gz",
        threshold: 1024,
        // Only compress files > 1KB
        deleteOriginFile: false,
        filter: /\.(js|mjs|json|css|html|svg|txt|xml|wasm)$/i
      }),
      // Brotli compression (better compression ratio)
      compression({
        algorithm: "brotliCompress",
        ext: ".br",
        threshold: 1024,
        deleteOriginFile: false,
        filter: /\.(js|mjs|json|css|html|svg|txt|xml|wasm)$/i
      })
    ],
    server: {
      host: "0.0.0.0",
      port: HTTPS_ENABLED ? 443 : 5173,
      strictPort: true,
      https: getHttpsConfig(HTTPS_ENABLED),
      allowedHosts: ["www.resumeconverter.net", "resumeconverter.net", "localhost"],
      hmr: {
        overlay: false
        // Disable error overlay - we handle errors in ErrorBoundary
      },
      proxy: {
        "/api": {
          target: HTTPS_ENABLED ? `https://localhost:${HTTPS_PORT}` : "http://localhost:3001",
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 6e5,
          // 10 minutes timeout for proxy
          proxyTimeout: 6e5,
          // 10 minutes timeout for proxy connection
          rewrite: (path2) => path2,
          configure: (proxy, options) => {
            proxy.options.timeout = 6e5;
            proxy.options.proxyTimeout = 6e5;
            proxy.on("error", (err, req, res) => {
              console.error("[Vite Proxy] Error:", err.message);
            });
            proxy.on("proxyReq", (proxyReq, req, res) => {
              proxyReq.socket?.setTimeout(6e5);
              console.log("[Vite Proxy] Proxying:", req.method, req.url, "\u2192", proxyReq.path);
            });
            proxy.on("proxyRes", (proxyRes, req, res) => {
              console.log("[Vite Proxy] Response:", proxyRes.statusCode, "from", req.url);
            });
          }
        },
        "/generate-pdf": {
          target: "http://localhost:3002",
          changeOrigin: true,
          secure: false
        },
        "/health": {
          target: HTTPS_ENABLED ? `https://localhost:${HTTPS_PORT}` : "http://localhost:3001",
          changeOrigin: true,
          secure: false
        }
      },
      fs: {
        strict: true,
        allow: [".", "..", "../node_modules"]
      },
      // Ensure SPA routing works - all non-file requests should serve index.html
      middlewareMode: false
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src"),
        "/tinymce": path.resolve(__vite_injected_original_dirname, "../node_modules/tinymce"),
        "@root": path.resolve(__vite_injected_original_dirname, ".."),
        // Fix for html-parse-stringify ESM issue in Vite 7 - use UMD version
        "html-parse-stringify": path.resolve(__vite_injected_original_dirname, "../node_modules/html-parse-stringify/dist/html-parse-stringify.umd.js")
      }
    },
    optimizeDeps: {
      // Force pre-bundling of problematic ESM packages for Vite 7
      force: true,
      esbuildOptions: {
        // Fix for React exports not being recognized
        mainFields: ["module", "main"]
      },
      // Exclude .env files from optimization
      exclude: [".env", ".env.local", ".env.development", ".env.production"],
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "react-i18next",
        "i18next",
        "i18next-browser-languagedetector",
        "html-parse-stringify",
        "tinymce/tinymce",
        "tinymce/icons/default",
        "tinymce/themes/silver",
        "tinymce/models/dom/model",
        "tinymce/plugins/advlist",
        "tinymce/plugins/autolink",
        "tinymce/plugins/lists",
        "tinymce/plugins/link",
        "tinymce/plugins/image",
        "tinymce/plugins/charmap",
        "tinymce/plugins/preview",
        "tinymce/plugins/anchor",
        "tinymce/plugins/searchreplace",
        "tinymce/plugins/visualblocks",
        "tinymce/plugins/code",
        "tinymce/plugins/fullscreen",
        "tinymce/plugins/insertdatetime",
        "tinymce/plugins/media",
        "tinymce/plugins/table",
        "tinymce/plugins/help",
        "tinymce/plugins/wordcount"
      ]
    },
    build: {
      // Output directory (inside client/)
      outDir: "dist",
      // Use esbuild for minification (faster and more stable than terser)
      minify: "esbuild",
      // Enable source maps for debugging
      sourcemap: true,
      // Chunk size warning limit (in kB)
      // Increased to 1500 to suppress warnings for necessary large libs (TinyMCE, maplibre, Three.js)
      // These libs are already lazy-loaded, so they don't affect initial page load
      chunkSizeWarningLimit: 1500,
      // Target modern browsers for smaller output
      target: "es2020",
      // Disable modulePreload polyfill to avoid unused preload warnings in production
      modulePreload: {
        polyfill: false
      },
      commonjsOptions: {
        include: [/tinymce/, /node_modules/],
        transformMixedEsModules: true,
        // Fix for void-elements and html-parse-stringify in Vite 7
        esmExternals: true
      },
      rollupOptions: {
        plugins: [
          commonjs({
            include: /node_modules/,
            transformMixedEsModules: true
          })
        ],
        output: {
          // Manual chunk splitting for better caching
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react-dom") || id.includes("react-router") || id.includes("/react/")) {
                return "vendor-react";
              }
              if (id.includes("framer-motion") || id.includes("@headlessui") || id.includes("@heroicons")) {
                return "vendor-ui";
              }
              if (id.includes("recharts") || id.includes("d3-")) {
                return "vendor-charts";
              }
              if (id.includes("maplibre") || id.includes("react-map-gl") || id.includes("mapbox")) {
                return "vendor-map";
              }
              if (id.includes("pdfjs-dist") || id.includes("html2pdf") || id.includes("jspdf")) {
                return "vendor-pdf";
              }
              if (id.includes("tinymce")) {
                return "vendor-tinymce";
              }
              if (id.includes("i18next")) {
                return "vendor-i18n";
              }
              if (id.includes("three")) {
                return "vendor-three";
              }
            }
          },
          // Optimize chunk file names
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash].[ext]"
        },
        onwarn(warning, warn) {
          if (warning.message?.includes("vite-plugin-node-polyfills")) {
            return;
          }
          warn(warning);
        },
        // Tree-shaking optimization
        treeshake: {
          moduleSideEffects: true,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYWlsXFxcXENhc2NhZGVQcm9qZWN0c1xcXFxSZXN1bWVDb252ZXJ0ZXJcXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYWlsXFxcXENhc2NhZGVQcm9qZWN0c1xcXFxSZXN1bWVDb252ZXJ0ZXJcXFxcY2xpZW50XFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9tYWlsL0Nhc2NhZGVQcm9qZWN0cy9SZXN1bWVDb252ZXJ0ZXIvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGNvbW1vbmpzIGZyb20gJ0Byb2xsdXAvcGx1Z2luLWNvbW1vbmpzJztcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XG5pbXBvcnQgY29tcHJlc3Npb24gZnJvbSAndml0ZS1wbHVnaW4tY29tcHJlc3Npb24nO1xuaW1wb3J0IHpsaWIgZnJvbSAnemxpYic7XG5cbi8vIFBsdWdpbiB0byBjb25maWd1cmUgSFRUUCBzZXJ2ZXIgdGltZW91dHMsIGNvbXByZXNzaW9uLCBhbmQgZGlhZ25vc2UgNDAwIGVycm9yc1xuY29uc3QgaHR0cENvbmZpZ1BsdWdpbiA9ICgpID0+ICh7XG4gIG5hbWU6ICdodHRwLWNvbmZpZycsXG4gIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAvLyBMb2cgY2FjaGUgY2xlYW51cCBvbiBzdGFydHVwXG4gICAgY29uc29sZS5sb2coJ1xcblx1RDgzRVx1RERGOSBWaXRlIGNhY2hlIGNsZWFuZWQgb24gc3RhcnR1cCAoLS1mb3JjZSBmbGFnKScpO1xuICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgRGVwZW5kZW5jaWVzIHJlLW9wdGltaXplZFxcbicpO1xuICAgIFxuICAgIC8vIENvbmZpZ3VyZSB0aGUgdW5kZXJseWluZyBIVFRQIHNlcnZlciBvbmNlIGl0J3MgY3JlYXRlZFxuICAgIHNlcnZlci5odHRwU2VydmVyPy5vbignbGlzdGVuaW5nJywgKCkgPT4ge1xuICAgICAgY29uc3QgaHR0cFNlcnZlciA9IHNlcnZlci5odHRwU2VydmVyO1xuICAgICAgLy8gSW5jcmVhc2Uga2VlcC1hbGl2ZSB0aW1lb3V0IHRvIDMwIG1pbnV0ZXMgKGRlZmF1bHQgaXMgNSBzZWNvbmRzIGluIE5vZGUuanMpXG4gICAgICBodHRwU2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSAzMCAqIDYwICogMTAwMDsgLy8gMzAgbWludXRlc1xuICAgICAgLy8gSGVhZGVycyB0aW1lb3V0IHNob3VsZCBiZSBzbGlnaHRseSBoaWdoZXJcbiAgICAgIGh0dHBTZXJ2ZXIuaGVhZGVyc1RpbWVvdXQgPSAzMSAqIDYwICogMTAwMDsgLy8gMzEgbWludXRlc1xuICAgICAgLy8gUmVxdWVzdCB0aW1lb3V0XG4gICAgICBodHRwU2VydmVyLnJlcXVlc3RUaW1lb3V0ID0gNSAqIDYwICogMTAwMDsgLy8gNSBtaW51dGVzIGZvciByZXF1ZXN0IHByb2Nlc3NpbmdcbiAgICAgIGNvbnNvbGUubG9nKCdbVml0ZV0gSFRUUCBzZXJ2ZXIgdGltZW91dHMgY29uZmlndXJlZDoga2VlcEFsaXZlPTMwbWluLCBoZWFkZXJzPTMxbWluJyk7XG4gICAgICBjb25zb2xlLmxvZygnW1ZpdGVdIENvbXByZXNzaW9uIG1pZGRsZXdhcmUgZW5hYmxlZCAoZ3ppcC9icm90bGkpJyk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ29tcHJlc3Npb24gbWlkZGxld2FyZSBmb3IgZGV2IHNlcnZlciAoc2FtZSBiZWhhdmlvciBhcyBwcm9kdWN0aW9uKVxuICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICBjb25zdCBhY2NlcHRFbmNvZGluZyA9IHJlcS5oZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXSB8fCAnJztcbiAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XG4gICAgICBcbiAgICAgIC8vIFNraXAgU1BBIHJvdXRlcyAocGF0aHMgd2l0aG91dCBmaWxlIGV4dGVuc2lvbnMgdGhhdCBhcmUgbm90IEFQSSBjYWxscylcbiAgICAgIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGJ5IFZpdGUncyBTUEEgZmFsbGJhY2ssIG5vdCBhcyBzdGF0aWMgZmlsZXNcbiAgICAgIGNvbnN0IGlzU3BhUm91dGUgPSAhdXJsLmluY2x1ZGVzKCcuJykgJiYgIXVybC5zdGFydHNXaXRoKCcvYXBpLycpICYmICF1cmwuc3RhcnRzV2l0aCgnL0AnKSAmJiAhdXJsLnN0YXJ0c1dpdGgoJy9ub2RlX21vZHVsZXMvJyk7XG4gICAgICBpZiAoaXNTcGFSb3V0ZSAmJiB1cmwgIT09ICcvJykge1xuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBPbmx5IGNvbXByZXNzIHRleHQtYmFzZWQgYXNzZXRzXG4gICAgICBjb25zdCBjb21wcmVzc2libGVFeHRlbnNpb25zID0gL1xcLihqc3xtanN8Y3NzfGh0bWx8anNvbnxzdmd8dHh0fHhtbCkoXFw/LiopPyQvaTtcbiAgICAgIGNvbnN0IHNob3VsZENvbXByZXNzID0gY29tcHJlc3NpYmxlRXh0ZW5zaW9ucy50ZXN0KHVybCk7XG4gICAgICBcbiAgICAgIGlmIChzaG91bGRDb21wcmVzcyAmJiAoYWNjZXB0RW5jb2RpbmcuaW5jbHVkZXMoJ2JyJykgfHwgYWNjZXB0RW5jb2RpbmcuaW5jbHVkZXMoJ2d6aXAnKSkpIHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxXcml0ZSA9IHJlcy53cml0ZS5iaW5kKHJlcyk7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRW5kID0gcmVzLmVuZC5iaW5kKHJlcyk7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICBcbiAgICAgICAgcmVzLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmIChjaHVuaykgY2h1bmtzLnB1c2goQnVmZmVyLmlzQnVmZmVyKGNodW5rKSA/IGNodW5rIDogQnVmZmVyLmZyb20oY2h1bmspKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGVuY29kaW5nO1xuICAgICAgICAgICAgZW5jb2RpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIHJlcy5lbmQgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgaWYgKGNodW5rKSBjaHVua3MucHVzaChCdWZmZXIuaXNCdWZmZXIoY2h1bmspID8gY2h1bmsgOiBCdWZmZXIuZnJvbShjaHVuaykpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGJvZHkgPSBCdWZmZXIuY29uY2F0KGNodW5rcyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gT25seSBjb21wcmVzcyBpZiBib2R5IGlzIGxhcmdlciB0aGFuIDFLQlxuICAgICAgICAgIGlmIChib2R5Lmxlbmd0aCA+IDEwMjQpIHtcbiAgICAgICAgICAgIGNvbnN0IHVzZUJyb3RsaSA9IGFjY2VwdEVuY29kaW5nLmluY2x1ZGVzKCdicicpO1xuICAgICAgICAgICAgY29uc3QgY29tcHJlc3NNZXRob2QgPSB1c2VCcm90bGkgPyB6bGliLmJyb3RsaUNvbXByZXNzU3luYyA6IHpsaWIuZ3ppcFN5bmM7XG4gICAgICAgICAgICBjb25zdCBlbmNvZGluZyA9IHVzZUJyb3RsaSA/ICdicicgOiAnZ3ppcCc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGNvbXByZXNzZWQgPSBjb21wcmVzc01ldGhvZChib2R5KTtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1FbmNvZGluZycsIGVuY29kaW5nKTtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignVmFyeScsICdBY2NlcHQtRW5jb2RpbmcnKTtcbiAgICAgICAgICAgICAgcmVzLnJlbW92ZUhlYWRlcignQ29udGVudC1MZW5ndGgnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsRW5kLmNhbGwocmVzLCBjb21wcmVzc2VkLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIHVuY29tcHJlc3NlZCBvbiBlcnJvclxuICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxFbmQuY2FsbChyZXMsIGJvZHksIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIG9yaWdpbmFsRW5kLmNhbGwocmVzLCBib2R5LCBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIG5leHQoKTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBSZWRpcmVjdCAvZmF2aWNvbi5pY28gdG8gL2Zhdmljb24uc3ZnIHRvIHByZXZlbnQgNDA0XG4gICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgIGlmIChyZXEudXJsID09PSAnL2Zhdmljb24uaWNvJykge1xuICAgICAgICByZXMud3JpdGVIZWFkKDMwMiwgeyBMb2NhdGlvbjogJy9mYXZpY29uLnN2ZycgfSk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbmV4dCgpO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIExvZyBhbGwgcmVxdWVzdHMgYXQgdGhlIGVhcmxpZXN0IHBvc3NpYmxlIHBvaW50XG4gICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgIC8vIFNraXAgbG9nZ2luZyBmYXZpY29uIHJlcXVlc3RzXG4gICAgICBpZiAocmVxLnVybCA9PT0gJy9mYXZpY29uLnN2ZycgfHwgcmVxLnVybCA9PT0gJy9mYXZpY29uLmljbycpIHtcbiAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKGBbVml0ZV0gJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9ICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfWApO1xuICAgICAgXG4gICAgICAvLyBJbnRlcmNlcHQgcmVzcG9uc2UgdG8gbG9nIGVycm9yc1xuICAgICAgY29uc3Qgb3JpZ2luYWxFbmQgPSByZXMuZW5kLmJpbmQocmVzKTtcbiAgICAgIHJlcy5lbmQgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBbVml0ZV0gRXJyb3IgJHtyZXMuc3RhdHVzQ29kZX0gb24gJHtyZXEubWV0aG9kfSAke3JlcS51cmx9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsRW5kKC4uLmFyZ3MpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgbmV4dCgpO1xuICAgIH0pO1xuICB9XG59KTtcblxuLy8gSFRUUFMgY29uZmlndXJhdGlvbiBoZWxwZXJcbmNvbnN0IGdldEh0dHBzQ29uZmlnID0gKGh0dHBzRW5hYmxlZCkgPT4ge1xuICBpZiAoIWh0dHBzRW5hYmxlZCkgcmV0dXJuIGZhbHNlO1xuICBcbiAgY29uc3QgY2VydHNQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJywgJ2NlcnRpZmljYXRlcycpO1xuICBjb25zdCBrZXlQYXRoID0gcGF0aC5qb2luKGNlcnRzUGF0aCwgJ3ByaXZhdGUua2V5Jyk7XG4gIGNvbnN0IGNlcnRQYXRoID0gcGF0aC5qb2luKGNlcnRzUGF0aCwgJ2NlcnRpZmljYXRlLmNydCcpO1xuICBcbiAgaWYgKCFmcy5leGlzdHNTeW5jKGtleVBhdGgpIHx8ICFmcy5leGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgIGNvbnNvbGUud2FybignXHUyNkEwXHVGRTBGICBIVFRQUyBlbmFibGVkIGJ1dCBjZXJ0aWZpY2F0ZXMgbm90IGZvdW5kLiBGYWxsaW5nIGJhY2sgdG8gSFRUUC4nKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAga2V5OiBmcy5yZWFkRmlsZVN5bmMoa2V5UGF0aCksXG4gICAgY2VydDogZnMucmVhZEZpbGVTeW5jKGNlcnRQYXRoKSxcbiAgfTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgLy8gTG9hZCBlbnYgZnJvbSBjbGllbnQgZGlyZWN0b3J5IChWSVRFXyBwcmVmaXhlZCB2YXJpYWJsZXMpXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgX19kaXJuYW1lLCAnJyk7XG4gIGNvbnN0IEhUVFBTX0VOQUJMRUQgPSBlbnYuVklURV9IVFRQU19FTkFCTEVEID09PSAndHJ1ZSc7XG4gIGNvbnN0IEhUVFBTX1BPUlQgPSBlbnYuVklURV9IVFRQU19QT1JUIHx8ICczNDQzJztcbiAgXG4gIGNvbnNvbGUubG9nKGBcdUQ4M0RcdUREMTAgSFRUUFNfRU5BQkxFRDogJHtIVFRQU19FTkFCTEVEfSAoZW52IHZhbHVlOiBcIiR7ZW52LlZJVEVfSFRUUFNfRU5BQkxFRH1cIilgKTtcbiAgXG4gIHJldHVybiB7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIG5vZGVQb2x5ZmlsbHMoe1xuICAgICAgZ2xvYmFsczoge1xuICAgICAgICBCdWZmZXI6IHRydWUsXG4gICAgICAgIGdsb2JhbDogdHJ1ZSxcbiAgICAgICAgcHJvY2VzczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBwcm90b2NvbEltcG9ydHM6IHRydWUsXG4gICAgfSksXG4gICAgaHR0cENvbmZpZ1BsdWdpbigpLFxuICAgIC8vIEd6aXAgY29tcHJlc3Npb24gZm9yIHByb2R1Y3Rpb24gYnVpbGRzXG4gICAgY29tcHJlc3Npb24oe1xuICAgICAgYWxnb3JpdGhtOiAnZ3ppcCcsXG4gICAgICBleHQ6ICcuZ3onLFxuICAgICAgdGhyZXNob2xkOiAxMDI0LCAvLyBPbmx5IGNvbXByZXNzIGZpbGVzID4gMUtCXG4gICAgICBkZWxldGVPcmlnaW5GaWxlOiBmYWxzZSxcbiAgICAgIGZpbHRlcjogL1xcLihqc3xtanN8anNvbnxjc3N8aHRtbHxzdmd8dHh0fHhtbHx3YXNtKSQvaSxcbiAgICB9KSxcbiAgICAvLyBCcm90bGkgY29tcHJlc3Npb24gKGJldHRlciBjb21wcmVzc2lvbiByYXRpbylcbiAgICBjb21wcmVzc2lvbih7XG4gICAgICBhbGdvcml0aG06ICdicm90bGlDb21wcmVzcycsXG4gICAgICBleHQ6ICcuYnInLFxuICAgICAgdGhyZXNob2xkOiAxMDI0LFxuICAgICAgZGVsZXRlT3JpZ2luRmlsZTogZmFsc2UsXG4gICAgICBmaWx0ZXI6IC9cXC4oanN8bWpzfGpzb258Y3NzfGh0bWx8c3ZnfHR4dHx4bWx8d2FzbSkkL2ksXG4gICAgfSksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBwb3J0OiBIVFRQU19FTkFCTEVEID8gNDQzIDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGh0dHBzOiBnZXRIdHRwc0NvbmZpZyhIVFRQU19FTkFCTEVEKSxcbiAgICBhbGxvd2VkSG9zdHM6IFsnd3d3LnJlc3VtZWNvbnZlcnRlci5uZXQnLCAncmVzdW1lY29udmVydGVyLm5ldCcsICdsb2NhbGhvc3QnXSxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlIC8vIERpc2FibGUgZXJyb3Igb3ZlcmxheSAtIHdlIGhhbmRsZSBlcnJvcnMgaW4gRXJyb3JCb3VuZGFyeVxuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6IEhUVFBTX0VOQUJMRUQgPyBgaHR0cHM6Ly9sb2NhbGhvc3Q6JHtIVFRQU19QT1JUfWAgOiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgdGltZW91dDogNjAwMDAwLCAvLyAxMCBtaW51dGVzIHRpbWVvdXQgZm9yIHByb3h5XG4gICAgICAgIHByb3h5VGltZW91dDogNjAwMDAwLCAvLyAxMCBtaW51dGVzIHRpbWVvdXQgZm9yIHByb3h5IGNvbm5lY3Rpb25cbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgLy8gU2V0IHByb3h5IHRpbWVvdXQgdG8gMTAgbWludXRlc1xuICAgICAgICAgIHByb3h5Lm9wdGlvbnMudGltZW91dCA9IDYwMDAwMDtcbiAgICAgICAgICBwcm94eS5vcHRpb25zLnByb3h5VGltZW91dCA9IDYwMDAwMDtcbiAgICAgICAgICBcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCByZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1ZpdGUgUHJveHldIEVycm9yOicsIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICAvLyBTZXQgc29ja2V0IHRpbWVvdXQgb24gdGhlIG91dGdvaW5nIHJlcXVlc3QgdG8gMTAgbWludXRlc1xuICAgICAgICAgICAgcHJveHlSZXEuc29ja2V0Py5zZXRUaW1lb3V0KDYwMDAwMCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZpdGUgUHJveHldIFByb3h5aW5nOicsIHJlcS5tZXRob2QsIHJlcS51cmwsICdcdTIxOTInLCBwcm94eVJlcS5wYXRoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZpdGUgUHJveHldIFJlc3BvbnNlOicsIHByb3h5UmVzLnN0YXR1c0NvZGUsICdmcm9tJywgcmVxLnVybCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgJy9nZW5lcmF0ZS1wZGYnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMicsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICAnL2hlYWx0aCc6IHtcbiAgICAgICAgdGFyZ2V0OiBIVFRQU19FTkFCTEVEID8gYGh0dHBzOi8vbG9jYWxob3N0OiR7SFRUUFNfUE9SVH1gIDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBmczoge1xuICAgICAgc3RyaWN0OiB0cnVlLFxuICAgICAgYWxsb3c6IFsnLicsICcuLicsICcuLi9ub2RlX21vZHVsZXMnXVxuICAgIH0sXG4gICAgLy8gRW5zdXJlIFNQQSByb3V0aW5nIHdvcmtzIC0gYWxsIG5vbi1maWxlIHJlcXVlc3RzIHNob3VsZCBzZXJ2ZSBpbmRleC5odG1sXG4gICAgbWlkZGxld2FyZU1vZGU6IGZhbHNlXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICAgICcvdGlueW1jZSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9ub2RlX21vZHVsZXMvdGlueW1jZScpLFxuICAgICAgJ0Byb290JzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJyksXG4gICAgICAvLyBGaXggZm9yIGh0bWwtcGFyc2Utc3RyaW5naWZ5IEVTTSBpc3N1ZSBpbiBWaXRlIDcgLSB1c2UgVU1EIHZlcnNpb25cbiAgICAgICdodG1sLXBhcnNlLXN0cmluZ2lmeSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9ub2RlX21vZHVsZXMvaHRtbC1wYXJzZS1zdHJpbmdpZnkvZGlzdC9odG1sLXBhcnNlLXN0cmluZ2lmeS51bWQuanMnKSxcbiAgICB9LFxuICAgICAgfSxcbiAgICAgIG9wdGltaXplRGVwczoge1xuICAgIC8vIEZvcmNlIHByZS1idW5kbGluZyBvZiBwcm9ibGVtYXRpYyBFU00gcGFja2FnZXMgZm9yIFZpdGUgN1xuICAgIGZvcmNlOiB0cnVlLFxuICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICAvLyBGaXggZm9yIFJlYWN0IGV4cG9ydHMgbm90IGJlaW5nIHJlY29nbml6ZWRcbiAgICAgIG1haW5GaWVsZHM6IFsnbW9kdWxlJywgJ21haW4nXSxcbiAgICAgICAgICB9LFxuICAgIC8vIEV4Y2x1ZGUgLmVudiBmaWxlcyBmcm9tIG9wdGltaXphdGlvblxuICAgIGV4Y2x1ZGU6IFsnLmVudicsICcuZW52LmxvY2FsJywgJy5lbnYuZGV2ZWxvcG1lbnQnLCAnLmVudi5wcm9kdWN0aW9uJ10sXG4gICAgaW5jbHVkZTogW1xuICAgICAgJ3JlYWN0JyxcbiAgICAgICdyZWFjdC1kb20nLFxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxuICAgICAgJ3JlYWN0LWkxOG5leHQnLFxuICAgICAgJ2kxOG5leHQnLFxuICAgICAgJ2kxOG5leHQtYnJvd3Nlci1sYW5ndWFnZWRldGVjdG9yJyxcbiAgICAgICdodG1sLXBhcnNlLXN0cmluZ2lmeScsXG4gICAgICAndGlueW1jZS90aW55bWNlJyxcbiAgICAgICd0aW55bWNlL2ljb25zL2RlZmF1bHQnLFxuICAgICAgJ3RpbnltY2UvdGhlbWVzL3NpbHZlcicsXG4gICAgICAndGlueW1jZS9tb2RlbHMvZG9tL21vZGVsJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvYWR2bGlzdCcsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2F1dG9saW5rJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvbGlzdHMnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9saW5rJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvaW1hZ2UnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9jaGFybWFwJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvcHJldmlldycsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2FuY2hvcicsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL3NlYXJjaHJlcGxhY2UnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy92aXN1YWxibG9ja3MnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9jb2RlJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvZnVsbHNjcmVlbicsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2luc2VydGRhdGV0aW1lJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvbWVkaWEnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy90YWJsZScsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2hlbHAnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy93b3JkY291bnQnXG4gICAgXVxuICB9LFxuICBidWlsZDoge1xuICAgIC8vIE91dHB1dCBkaXJlY3RvcnkgKGluc2lkZSBjbGllbnQvKVxuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIC8vIFVzZSBlc2J1aWxkIGZvciBtaW5pZmljYXRpb24gKGZhc3RlciBhbmQgbW9yZSBzdGFibGUgdGhhbiB0ZXJzZXIpXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgLy8gRW5hYmxlIHNvdXJjZSBtYXBzIGZvciBkZWJ1Z2dpbmdcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgLy8gQ2h1bmsgc2l6ZSB3YXJuaW5nIGxpbWl0IChpbiBrQilcbiAgICAvLyBJbmNyZWFzZWQgdG8gMTUwMCB0byBzdXBwcmVzcyB3YXJuaW5ncyBmb3IgbmVjZXNzYXJ5IGxhcmdlIGxpYnMgKFRpbnlNQ0UsIG1hcGxpYnJlLCBUaHJlZS5qcylcbiAgICAvLyBUaGVzZSBsaWJzIGFyZSBhbHJlYWR5IGxhenktbG9hZGVkLCBzbyB0aGV5IGRvbid0IGFmZmVjdCBpbml0aWFsIHBhZ2UgbG9hZFxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTUwMCxcbiAgICAvLyBUYXJnZXQgbW9kZXJuIGJyb3dzZXJzIGZvciBzbWFsbGVyIG91dHB1dFxuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgLy8gRGlzYWJsZSBtb2R1bGVQcmVsb2FkIHBvbHlmaWxsIHRvIGF2b2lkIHVudXNlZCBwcmVsb2FkIHdhcm5pbmdzIGluIHByb2R1Y3Rpb25cbiAgICBtb2R1bGVQcmVsb2FkOiB7XG4gICAgICBwb2x5ZmlsbDogZmFsc2VcbiAgICB9LFxuICAgIGNvbW1vbmpzT3B0aW9uczoge1xuICAgICAgaW5jbHVkZTogWy90aW55bWNlLywgL25vZGVfbW9kdWxlcy9dLFxuICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXG4gICAgICAvLyBGaXggZm9yIHZvaWQtZWxlbWVudHMgYW5kIGh0bWwtcGFyc2Utc3RyaW5naWZ5IGluIFZpdGUgN1xuICAgICAgZXNtRXh0ZXJuYWxzOiB0cnVlLFxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgcGx1Z2luczogW1xuICAgICAgICBjb21tb25qcyh7XG4gICAgICAgICAgaW5jbHVkZTogL25vZGVfbW9kdWxlcy8sXG4gICAgICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICAvLyBNYW51YWwgY2h1bmsgc3BsaXR0aW5nIGZvciBiZXR0ZXIgY2FjaGluZ1xuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgICAvLyBSZWFjdCBjb3JlXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0LWRvbScpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXInKSB8fCBpZC5pbmNsdWRlcygnL3JlYWN0LycpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXJlYWN0JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFVJIGxpYnJhcmllc1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdmcmFtZXItbW90aW9uJykgfHwgaWQuaW5jbHVkZXMoJ0BoZWFkbGVzc3VpJykgfHwgaWQuaW5jbHVkZXMoJ0BoZXJvaWNvbnMnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci11aSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDaGFydHNcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVjaGFydHMnKSB8fCBpZC5pbmNsdWRlcygnZDMtJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItY2hhcnRzJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE1hcCBsaWJyYXJpZXNcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbWFwbGlicmUnKSB8fCBpZC5pbmNsdWRlcygncmVhY3QtbWFwLWdsJykgfHwgaWQuaW5jbHVkZXMoJ21hcGJveCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLW1hcCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBQREYgbGlicmFyaWVzXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3BkZmpzLWRpc3QnKSB8fCBpZC5pbmNsdWRlcygnaHRtbDJwZGYnKSB8fCBpZC5pbmNsdWRlcygnanNwZGYnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1wZGYnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVGlueU1DRVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCd0aW55bWNlJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItdGlueW1jZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBpMThuXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2kxOG5leHQnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1pMThuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRocmVlLmpzIChXZWJHTClcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygndGhyZWUnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci10aHJlZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAvLyBPcHRpbWl6ZSBjaHVuayBmaWxlIG5hbWVzXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW2V4dF0vW25hbWVdLVtoYXNoXS5bZXh0XScsXG4gICAgICB9LFxuICAgICAgb253YXJuKHdhcm5pbmcsIHdhcm4pIHtcbiAgICAgICAgLy8gU3VwcHJlc3Mgd2FybmluZ3MgYWJvdXQgdml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHNcbiAgICAgICAgaWYgKHdhcm5pbmcubWVzc2FnZT8uaW5jbHVkZXMoJ3ZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzJykpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgIH0sXG4gICAgICAvLyBUcmVlLXNoYWtpbmcgb3B0aW1pemF0aW9uXG4gICAgICB0cmVlc2hha2U6IHtcbiAgICAgICAgbW9kdWxlU2lkZUVmZmVjdHM6IHRydWUsXG4gICAgICAgIHByb3BlcnR5UmVhZFNpZGVFZmZlY3RzOiBmYWxzZSxcbiAgICAgICAgdHJ5Q2F0Y2hEZW9wdGltaXphdGlvbjogZmFsc2UsXG4gICAgICB9LFxuICAgIH1cbiAgfVxufTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwVixTQUFTLGNBQWMsZUFBZTtBQUNoWSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sUUFBUTtBQUNmLE9BQU8sY0FBYztBQUNyQixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFVBQVU7QUFQakIsSUFBTSxtQ0FBbUM7QUFVekMsSUFBTSxtQkFBbUIsT0FBTztBQUFBLEVBQzlCLE1BQU07QUFBQSxFQUNOLGdCQUFnQixRQUFRO0FBRXRCLFlBQVEsSUFBSSwwREFBbUQ7QUFDL0QsWUFBUSxJQUFJLG9DQUErQjtBQUczQyxXQUFPLFlBQVksR0FBRyxhQUFhLE1BQU07QUFDdkMsWUFBTSxhQUFhLE9BQU87QUFFMUIsaUJBQVcsbUJBQW1CLEtBQUssS0FBSztBQUV4QyxpQkFBVyxpQkFBaUIsS0FBSyxLQUFLO0FBRXRDLGlCQUFXLGlCQUFpQixJQUFJLEtBQUs7QUFDckMsY0FBUSxJQUFJLHdFQUF3RTtBQUNwRixjQUFRLElBQUkscURB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
