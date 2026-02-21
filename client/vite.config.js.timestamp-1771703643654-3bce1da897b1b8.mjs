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
      hmr: false,
      // Disable HMR for external domain access
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
        "@root": path.resolve(__vite_injected_original_dirname, "..")
      }
    },
    optimizeDeps: {
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
      chunkSizeWarningLimit: 500,
      // Target modern browsers for smaller output
      target: "es2020",
      // Disable modulePreload polyfill to avoid unused preload warnings in production
      modulePreload: {
        polyfill: false
      },
      commonjsOptions: {
        include: [/tinymce/, /node_modules/],
        transformMixedEsModules: true
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
          moduleSideEffects: "no-external",
          propertyReadSideEffects: false
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYWlsXFxcXENhc2NhZGVQcm9qZWN0c1xcXFxSZXN1bWVDb252ZXJ0ZXJcXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYWlsXFxcXENhc2NhZGVQcm9qZWN0c1xcXFxSZXN1bWVDb252ZXJ0ZXJcXFxcY2xpZW50XFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9tYWlsL0Nhc2NhZGVQcm9qZWN0cy9SZXN1bWVDb252ZXJ0ZXIvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGNvbW1vbmpzIGZyb20gJ0Byb2xsdXAvcGx1Z2luLWNvbW1vbmpzJztcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XG5pbXBvcnQgY29tcHJlc3Npb24gZnJvbSAndml0ZS1wbHVnaW4tY29tcHJlc3Npb24nO1xuaW1wb3J0IHpsaWIgZnJvbSAnemxpYic7XG5cbi8vIFBsdWdpbiB0byBjb25maWd1cmUgSFRUUCBzZXJ2ZXIgdGltZW91dHMsIGNvbXByZXNzaW9uLCBhbmQgZGlhZ25vc2UgNDAwIGVycm9yc1xuY29uc3QgaHR0cENvbmZpZ1BsdWdpbiA9ICgpID0+ICh7XG4gIG5hbWU6ICdodHRwLWNvbmZpZycsXG4gIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAvLyBMb2cgY2FjaGUgY2xlYW51cCBvbiBzdGFydHVwXG4gICAgY29uc29sZS5sb2coJ1xcblx1RDgzRVx1RERGOSBWaXRlIGNhY2hlIGNsZWFuZWQgb24gc3RhcnR1cCAoLS1mb3JjZSBmbGFnKScpO1xuICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgRGVwZW5kZW5jaWVzIHJlLW9wdGltaXplZFxcbicpO1xuICAgIFxuICAgIC8vIENvbmZpZ3VyZSB0aGUgdW5kZXJseWluZyBIVFRQIHNlcnZlciBvbmNlIGl0J3MgY3JlYXRlZFxuICAgIHNlcnZlci5odHRwU2VydmVyPy5vbignbGlzdGVuaW5nJywgKCkgPT4ge1xuICAgICAgY29uc3QgaHR0cFNlcnZlciA9IHNlcnZlci5odHRwU2VydmVyO1xuICAgICAgLy8gSW5jcmVhc2Uga2VlcC1hbGl2ZSB0aW1lb3V0IHRvIDMwIG1pbnV0ZXMgKGRlZmF1bHQgaXMgNSBzZWNvbmRzIGluIE5vZGUuanMpXG4gICAgICBodHRwU2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSAzMCAqIDYwICogMTAwMDsgLy8gMzAgbWludXRlc1xuICAgICAgLy8gSGVhZGVycyB0aW1lb3V0IHNob3VsZCBiZSBzbGlnaHRseSBoaWdoZXJcbiAgICAgIGh0dHBTZXJ2ZXIuaGVhZGVyc1RpbWVvdXQgPSAzMSAqIDYwICogMTAwMDsgLy8gMzEgbWludXRlc1xuICAgICAgLy8gUmVxdWVzdCB0aW1lb3V0XG4gICAgICBodHRwU2VydmVyLnJlcXVlc3RUaW1lb3V0ID0gNSAqIDYwICogMTAwMDsgLy8gNSBtaW51dGVzIGZvciByZXF1ZXN0IHByb2Nlc3NpbmdcbiAgICAgIGNvbnNvbGUubG9nKCdbVml0ZV0gSFRUUCBzZXJ2ZXIgdGltZW91dHMgY29uZmlndXJlZDoga2VlcEFsaXZlPTMwbWluLCBoZWFkZXJzPTMxbWluJyk7XG4gICAgICBjb25zb2xlLmxvZygnW1ZpdGVdIENvbXByZXNzaW9uIG1pZGRsZXdhcmUgZW5hYmxlZCAoZ3ppcC9icm90bGkpJyk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ29tcHJlc3Npb24gbWlkZGxld2FyZSBmb3IgZGV2IHNlcnZlciAoc2FtZSBiZWhhdmlvciBhcyBwcm9kdWN0aW9uKVxuICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICBjb25zdCBhY2NlcHRFbmNvZGluZyA9IHJlcS5oZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXSB8fCAnJztcbiAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XG4gICAgICBcbiAgICAgIC8vIFNraXAgU1BBIHJvdXRlcyAocGF0aHMgd2l0aG91dCBmaWxlIGV4dGVuc2lvbnMgdGhhdCBhcmUgbm90IEFQSSBjYWxscylcbiAgICAgIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGJ5IFZpdGUncyBTUEEgZmFsbGJhY2ssIG5vdCBhcyBzdGF0aWMgZmlsZXNcbiAgICAgIGNvbnN0IGlzU3BhUm91dGUgPSAhdXJsLmluY2x1ZGVzKCcuJykgJiYgIXVybC5zdGFydHNXaXRoKCcvYXBpLycpICYmICF1cmwuc3RhcnRzV2l0aCgnL0AnKSAmJiAhdXJsLnN0YXJ0c1dpdGgoJy9ub2RlX21vZHVsZXMvJyk7XG4gICAgICBpZiAoaXNTcGFSb3V0ZSAmJiB1cmwgIT09ICcvJykge1xuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBPbmx5IGNvbXByZXNzIHRleHQtYmFzZWQgYXNzZXRzXG4gICAgICBjb25zdCBjb21wcmVzc2libGVFeHRlbnNpb25zID0gL1xcLihqc3xtanN8Y3NzfGh0bWx8anNvbnxzdmd8dHh0fHhtbCkoXFw/LiopPyQvaTtcbiAgICAgIGNvbnN0IHNob3VsZENvbXByZXNzID0gY29tcHJlc3NpYmxlRXh0ZW5zaW9ucy50ZXN0KHVybCk7XG4gICAgICBcbiAgICAgIGlmIChzaG91bGRDb21wcmVzcyAmJiAoYWNjZXB0RW5jb2RpbmcuaW5jbHVkZXMoJ2JyJykgfHwgYWNjZXB0RW5jb2RpbmcuaW5jbHVkZXMoJ2d6aXAnKSkpIHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxXcml0ZSA9IHJlcy53cml0ZS5iaW5kKHJlcyk7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRW5kID0gcmVzLmVuZC5iaW5kKHJlcyk7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICBcbiAgICAgICAgcmVzLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYWxsYmFjaykge1xuICAgICAgICAgIGlmIChjaHVuaykgY2h1bmtzLnB1c2goQnVmZmVyLmlzQnVmZmVyKGNodW5rKSA/IGNodW5rIDogQnVmZmVyLmZyb20oY2h1bmspKTtcbiAgICAgICAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGVuY29kaW5nO1xuICAgICAgICAgICAgZW5jb2RpbmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIHJlcy5lbmQgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgaWYgKGNodW5rKSBjaHVua3MucHVzaChCdWZmZXIuaXNCdWZmZXIoY2h1bmspID8gY2h1bmsgOiBCdWZmZXIuZnJvbShjaHVuaykpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGJvZHkgPSBCdWZmZXIuY29uY2F0KGNodW5rcyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gT25seSBjb21wcmVzcyBpZiBib2R5IGlzIGxhcmdlciB0aGFuIDFLQlxuICAgICAgICAgIGlmIChib2R5Lmxlbmd0aCA+IDEwMjQpIHtcbiAgICAgICAgICAgIGNvbnN0IHVzZUJyb3RsaSA9IGFjY2VwdEVuY29kaW5nLmluY2x1ZGVzKCdicicpO1xuICAgICAgICAgICAgY29uc3QgY29tcHJlc3NNZXRob2QgPSB1c2VCcm90bGkgPyB6bGliLmJyb3RsaUNvbXByZXNzU3luYyA6IHpsaWIuZ3ppcFN5bmM7XG4gICAgICAgICAgICBjb25zdCBlbmNvZGluZyA9IHVzZUJyb3RsaSA/ICdicicgOiAnZ3ppcCc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGNvbXByZXNzZWQgPSBjb21wcmVzc01ldGhvZChib2R5KTtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1FbmNvZGluZycsIGVuY29kaW5nKTtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignVmFyeScsICdBY2NlcHQtRW5jb2RpbmcnKTtcbiAgICAgICAgICAgICAgcmVzLnJlbW92ZUhlYWRlcignQ29udGVudC1MZW5ndGgnKTtcbiAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsRW5kLmNhbGwocmVzLCBjb21wcmVzc2VkLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIHVuY29tcHJlc3NlZCBvbiBlcnJvclxuICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxFbmQuY2FsbChyZXMsIGJvZHksIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIG9yaWdpbmFsRW5kLmNhbGwocmVzLCBib2R5LCBjYWxsYmFjayk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIG5leHQoKTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBMb2cgYWxsIHJlcXVlc3RzIGF0IHRoZSBlYXJsaWVzdCBwb3NzaWJsZSBwb2ludFxuICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW1ZpdGVdICR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpfSAke3JlcS5tZXRob2R9ICR7cmVxLnVybH1gKTtcbiAgICAgIFxuICAgICAgLy8gSW50ZXJjZXB0IHJlc3BvbnNlIHRvIGxvZyBlcnJvcnNcbiAgICAgIGNvbnN0IG9yaWdpbmFsRW5kID0gcmVzLmVuZC5iaW5kKHJlcyk7XG4gICAgICByZXMuZW5kID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgICBpZiAocmVzLnN0YXR1c0NvZGUgPj0gNDAwKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgW1ZpdGVdIEVycm9yICR7cmVzLnN0YXR1c0NvZGV9IG9uICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcmlnaW5hbEVuZCguLi5hcmdzKTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIG5leHQoKTtcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIEhUVFBTIGNvbmZpZ3VyYXRpb24gaGVscGVyXG5jb25zdCBnZXRIdHRwc0NvbmZpZyA9IChodHRwc0VuYWJsZWQpID0+IHtcbiAgaWYgKCFodHRwc0VuYWJsZWQpIHJldHVybiBmYWxzZTtcbiAgXG4gIGNvbnN0IGNlcnRzUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLicsICdjZXJ0aWZpY2F0ZXMnKTtcbiAgY29uc3Qga2V5UGF0aCA9IHBhdGguam9pbihjZXJ0c1BhdGgsICdwcml2YXRlLmtleScpO1xuICBjb25zdCBjZXJ0UGF0aCA9IHBhdGguam9pbihjZXJ0c1BhdGgsICdjZXJ0aWZpY2F0ZS5jcnQnKTtcbiAgXG4gIGlmICghZnMuZXhpc3RzU3luYyhrZXlQYXRoKSB8fCAhZnMuZXhpc3RzU3luYyhjZXJ0UGF0aCkpIHtcbiAgICBjb25zb2xlLndhcm4oJ1x1MjZBMFx1RkUwRiAgSFRUUFMgZW5hYmxlZCBidXQgY2VydGlmaWNhdGVzIG5vdCBmb3VuZC4gRmFsbGluZyBiYWNrIHRvIEhUVFAuJyk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIGtleTogZnMucmVhZEZpbGVTeW5jKGtleVBhdGgpLFxuICAgIGNlcnQ6IGZzLnJlYWRGaWxlU3luYyhjZXJ0UGF0aCksXG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIExvYWQgZW52IGZyb20gY2xpZW50IGRpcmVjdG9yeSAoVklURV8gcHJlZml4ZWQgdmFyaWFibGVzKVxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIF9fZGlybmFtZSwgJycpO1xuICBjb25zdCBIVFRQU19FTkFCTEVEID0gZW52LlZJVEVfSFRUUFNfRU5BQkxFRCA9PT0gJ3RydWUnO1xuICBjb25zdCBIVFRQU19QT1JUID0gZW52LlZJVEVfSFRUUFNfUE9SVCB8fCAnMzQ0Myc7XG4gIFxuICBjb25zb2xlLmxvZyhgXHVEODNEXHVERDEwIEhUVFBTX0VOQUJMRUQ6ICR7SFRUUFNfRU5BQkxFRH0gKGVudiB2YWx1ZTogXCIke2Vudi5WSVRFX0hUVFBTX0VOQUJMRUR9XCIpYCk7XG4gIFxuICByZXR1cm4ge1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBub2RlUG9seWZpbGxzKHtcbiAgICAgIGdsb2JhbHM6IHtcbiAgICAgICAgQnVmZmVyOiB0cnVlLFxuICAgICAgICBnbG9iYWw6IHRydWUsXG4gICAgICAgIHByb2Nlc3M6IHRydWUsXG4gICAgICB9LFxuICAgICAgcHJvdG9jb2xJbXBvcnRzOiB0cnVlLFxuICAgIH0pLFxuICAgIGh0dHBDb25maWdQbHVnaW4oKSxcbiAgICAvLyBHemlwIGNvbXByZXNzaW9uIGZvciBwcm9kdWN0aW9uIGJ1aWxkc1xuICAgIGNvbXByZXNzaW9uKHtcbiAgICAgIGFsZ29yaXRobTogJ2d6aXAnLFxuICAgICAgZXh0OiAnLmd6JyxcbiAgICAgIHRocmVzaG9sZDogMTAyNCwgLy8gT25seSBjb21wcmVzcyBmaWxlcyA+IDFLQlxuICAgICAgZGVsZXRlT3JpZ2luRmlsZTogZmFsc2UsXG4gICAgICBmaWx0ZXI6IC9cXC4oanN8bWpzfGpzb258Y3NzfGh0bWx8c3ZnfHR4dHx4bWx8d2FzbSkkL2ksXG4gICAgfSksXG4gICAgLy8gQnJvdGxpIGNvbXByZXNzaW9uIChiZXR0ZXIgY29tcHJlc3Npb24gcmF0aW8pXG4gICAgY29tcHJlc3Npb24oe1xuICAgICAgYWxnb3JpdGhtOiAnYnJvdGxpQ29tcHJlc3MnLFxuICAgICAgZXh0OiAnLmJyJyxcbiAgICAgIHRocmVzaG9sZDogMTAyNCxcbiAgICAgIGRlbGV0ZU9yaWdpbkZpbGU6IGZhbHNlLFxuICAgICAgZmlsdGVyOiAvXFwuKGpzfG1qc3xqc29ufGNzc3xodG1sfHN2Z3x0eHR8eG1sfHdhc20pJC9pLFxuICAgIH0pLFxuICBdLFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgcG9ydDogSFRUUFNfRU5BQkxFRCA/IDQ0MyA6IDUxNzMsXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICBodHRwczogZ2V0SHR0cHNDb25maWcoSFRUUFNfRU5BQkxFRCksXG4gICAgYWxsb3dlZEhvc3RzOiBbJ3d3dy5yZXN1bWVjb252ZXJ0ZXIubmV0JywgJ3Jlc3VtZWNvbnZlcnRlci5uZXQnLCAnbG9jYWxob3N0J10sXG4gICAgaG1yOiBmYWxzZSwgLy8gRGlzYWJsZSBITVIgZm9yIGV4dGVybmFsIGRvbWFpbiBhY2Nlc3NcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogSFRUUFNfRU5BQkxFRCA/IGBodHRwczovL2xvY2FsaG9zdDoke0hUVFBTX1BPUlR9YCA6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIHdzOiB0cnVlLFxuICAgICAgICB0aW1lb3V0OiA2MDAwMDAsIC8vIDEwIG1pbnV0ZXMgdGltZW91dCBmb3IgcHJveHlcbiAgICAgICAgcHJveHlUaW1lb3V0OiA2MDAwMDAsIC8vIDEwIG1pbnV0ZXMgdGltZW91dCBmb3IgcHJveHkgY29ubmVjdGlvblxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aCxcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAvLyBTZXQgcHJveHkgdGltZW91dCB0byAxMCBtaW51dGVzXG4gICAgICAgICAgcHJveHkub3B0aW9ucy50aW1lb3V0ID0gNjAwMDAwO1xuICAgICAgICAgIHByb3h5Lm9wdGlvbnMucHJveHlUaW1lb3V0ID0gNjAwMDAwO1xuICAgICAgICAgIFxuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbVml0ZSBQcm94eV0gRXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIC8vIFNldCBzb2NrZXQgdGltZW91dCBvbiB0aGUgb3V0Z29pbmcgcmVxdWVzdCB0byAxMCBtaW51dGVzXG4gICAgICAgICAgICBwcm94eVJlcS5zb2NrZXQ/LnNldFRpbWVvdXQoNjAwMDAwKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVml0ZSBQcm94eV0gUHJveHlpbmc6JywgcmVxLm1ldGhvZCwgcmVxLnVybCwgJ1x1MjE5MicsIHByb3h5UmVxLnBhdGgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcycsIChwcm94eVJlcywgcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVml0ZSBQcm94eV0gUmVzcG9uc2U6JywgcHJveHlSZXMuc3RhdHVzQ29kZSwgJ2Zyb20nLCByZXEudXJsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAnL2dlbmVyYXRlLXBkZic6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAyJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgICcvaGVhbHRoJzoge1xuICAgICAgICB0YXJnZXQ6IEhUVFBTX0VOQUJMRUQgPyBgaHR0cHM6Ly9sb2NhbGhvc3Q6JHtIVFRQU19QT1JUfWAgOiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGZzOiB7XG4gICAgICBzdHJpY3Q6IHRydWUsXG4gICAgICBhbGxvdzogWycuJywgJy4uJywgJy4uL25vZGVfbW9kdWxlcyddXG4gICAgfSxcbiAgICAvLyBFbnN1cmUgU1BBIHJvdXRpbmcgd29ya3MgLSBhbGwgbm9uLWZpbGUgcmVxdWVzdHMgc2hvdWxkIHNlcnZlIGluZGV4Lmh0bWxcbiAgICBtaWRkbGV3YXJlTW9kZTogZmFsc2VcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgJy90aW55bWNlJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uL25vZGVfbW9kdWxlcy90aW55bWNlJyksXG4gICAgICAnQHJvb3QnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4nKSxcbiAgICB9XG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICAvLyBGaXggZm9yIFJlYWN0IGV4cG9ydHMgbm90IGJlaW5nIHJlY29nbml6ZWRcbiAgICAgIG1haW5GaWVsZHM6IFsnbW9kdWxlJywgJ21haW4nXSxcbiAgICB9LFxuICAgIC8vIEV4Y2x1ZGUgLmVudiBmaWxlcyBmcm9tIG9wdGltaXphdGlvblxuICAgIGV4Y2x1ZGU6IFsnLmVudicsICcuZW52LmxvY2FsJywgJy5lbnYuZGV2ZWxvcG1lbnQnLCAnLmVudi5wcm9kdWN0aW9uJ10sXG4gICAgaW5jbHVkZTogW1xuICAgICAgJ3JlYWN0JyxcbiAgICAgICdyZWFjdC1kb20nLFxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxuICAgICAgJ3RpbnltY2UvdGlueW1jZScsXG4gICAgICAndGlueW1jZS9pY29ucy9kZWZhdWx0JyxcbiAgICAgICd0aW55bWNlL3RoZW1lcy9zaWx2ZXInLFxuICAgICAgJ3RpbnltY2UvbW9kZWxzL2RvbS9tb2RlbCcsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2Fkdmxpc3QnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9hdXRvbGluaycsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2xpc3RzJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvbGluaycsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2ltYWdlJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvY2hhcm1hcCcsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL3ByZXZpZXcnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9hbmNob3InLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9zZWFyY2hyZXBsYWNlJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvdmlzdWFsYmxvY2tzJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvY29kZScsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2Z1bGxzY3JlZW4nLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9pbnNlcnRkYXRldGltZScsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL21lZGlhJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvdGFibGUnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9oZWxwJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvd29yZGNvdW50J1xuICAgIF1cbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBPdXRwdXQgZGlyZWN0b3J5IChpbnNpZGUgY2xpZW50LylcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICAvLyBVc2UgZXNidWlsZCBmb3IgbWluaWZpY2F0aW9uIChmYXN0ZXIgYW5kIG1vcmUgc3RhYmxlIHRoYW4gdGVyc2VyKVxuICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICAgIC8vIEVuYWJsZSBzb3VyY2UgbWFwcyBmb3IgZGVidWdnaW5nXG4gICAgc291cmNlbWFwOiB0cnVlLFxuICAgIC8vIENodW5rIHNpemUgd2FybmluZyBsaW1pdCAoaW4ga0IpXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA1MDAsXG4gICAgLy8gVGFyZ2V0IG1vZGVybiBicm93c2VycyBmb3Igc21hbGxlciBvdXRwdXRcbiAgICB0YXJnZXQ6ICdlczIwMjAnLFxuICAgIC8vIERpc2FibGUgbW9kdWxlUHJlbG9hZCBwb2x5ZmlsbCB0byBhdm9pZCB1bnVzZWQgcHJlbG9hZCB3YXJuaW5ncyBpbiBwcm9kdWN0aW9uXG4gICAgbW9kdWxlUHJlbG9hZDoge1xuICAgICAgcG9seWZpbGw6IGZhbHNlXG4gICAgfSxcbiAgICBjb21tb25qc09wdGlvbnM6IHtcbiAgICAgIGluY2x1ZGU6IFsvdGlueW1jZS8sIC9ub2RlX21vZHVsZXMvXSxcbiAgICAgIHRyYW5zZm9ybU1peGVkRXNNb2R1bGVzOiB0cnVlLFxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgcGx1Z2luczogW1xuICAgICAgICBjb21tb25qcyh7XG4gICAgICAgICAgaW5jbHVkZTogL25vZGVfbW9kdWxlcy8sXG4gICAgICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICAvLyBNYW51YWwgY2h1bmsgc3BsaXR0aW5nIGZvciBiZXR0ZXIgY2FjaGluZ1xuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgICAvLyBSZWFjdCBjb3JlXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0LWRvbScpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXInKSB8fCBpZC5pbmNsdWRlcygnL3JlYWN0LycpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXJlYWN0JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFVJIGxpYnJhcmllc1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdmcmFtZXItbW90aW9uJykgfHwgaWQuaW5jbHVkZXMoJ0BoZWFkbGVzc3VpJykgfHwgaWQuaW5jbHVkZXMoJ0BoZXJvaWNvbnMnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci11aSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBDaGFydHNcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVjaGFydHMnKSB8fCBpZC5pbmNsdWRlcygnZDMtJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItY2hhcnRzJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE1hcCBsaWJyYXJpZXNcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbWFwbGlicmUnKSB8fCBpZC5pbmNsdWRlcygncmVhY3QtbWFwLWdsJykgfHwgaWQuaW5jbHVkZXMoJ21hcGJveCcpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLW1hcCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBQREYgbGlicmFyaWVzXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3BkZmpzLWRpc3QnKSB8fCBpZC5pbmNsdWRlcygnaHRtbDJwZGYnKSB8fCBpZC5pbmNsdWRlcygnanNwZGYnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1wZGYnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVGlueU1DRVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCd0aW55bWNlJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItdGlueW1jZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBpMThuXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2kxOG5leHQnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1pMThuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRocmVlLmpzIChXZWJHTClcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygndGhyZWUnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci10aHJlZSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAvLyBPcHRpbWl6ZSBjaHVuayBmaWxlIG5hbWVzXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW2V4dF0vW25hbWVdLVtoYXNoXS5bZXh0XScsXG4gICAgICB9LFxuICAgICAgb253YXJuKHdhcm5pbmcsIHdhcm4pIHtcbiAgICAgICAgLy8gU3VwcHJlc3Mgd2FybmluZ3MgYWJvdXQgdml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHNcbiAgICAgICAgaWYgKHdhcm5pbmcubWVzc2FnZT8uaW5jbHVkZXMoJ3ZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzJykpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgIH0sXG4gICAgICAvLyBUcmVlLXNoYWtpbmcgb3B0aW1pemF0aW9uXG4gICAgICB0cmVlc2hha2U6IHtcbiAgICAgICAgbW9kdWxlU2lkZUVmZmVjdHM6ICduby1leHRlcm5hbCcsXG4gICAgICAgIHByb3BlcnR5UmVhZFNpZGVFZmZlY3RzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfVxuICB9XG59O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTBWLFNBQVMsY0FBYyxlQUFlO0FBQ2hZLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxjQUFjO0FBQ3JCLFNBQVMscUJBQXFCO0FBQzlCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQVBqQixJQUFNLG1DQUFtQztBQVV6QyxJQUFNLG1CQUFtQixPQUFPO0FBQUEsRUFDOUIsTUFBTTtBQUFBLEVBQ04sZ0JBQWdCLFFBQVE7QUFFdEIsWUFBUSxJQUFJLDBEQUFtRDtBQUMvRCxZQUFRLElBQUksb0NBQStCO0FBRzNDLFdBQU8sWUFBWSxHQUFHLGFBQWEsTUFBTTtBQUN2QyxZQUFNLGFBQWEsT0FBTztBQUUxQixpQkFBVyxtQkFBbUIsS0FBSyxLQUFLO0FBRXhDLGlCQUFXLGlCQUFpQixLQUFLLEtBQUs7QUFFdEMsaUJBQVcsaUJBQWlCLElBQUksS0FBSztBQUNyQyxjQUFRLElBQUksd0VBQXdFO0FBQ3BGLGNBQVEsSUFBSSxxREFBcUQ7QUFBQSxJQUNuRSxDQUFDO0FBR0QsV0FBTyxZQUFZLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6QyxZQUFNLGlCQUFpQixJQUFJLFFBQVEsaUJBQWlCLEtBQUs7QUFDekQsWUFBTSxNQUFNLElBQUksT0FBTztBQUl2QixZQUFNLGFBQWEsQ0FBQyxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxXQUFXLE9BQU8sS0FBSyxDQUFDLElBQUksV0FBVyxJQUFJLEtBQUssQ0FBQyxJQUFJLFdBQVcsZ0JBQWdCO0FBQzlILFVBQUksY0FBYyxRQUFRLEtBQUs7QUFDN0IsZUFBTyxLQUFLO0FBQUEsTUFDZDtBQUdBLFlBQU0seUJBQXlC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
