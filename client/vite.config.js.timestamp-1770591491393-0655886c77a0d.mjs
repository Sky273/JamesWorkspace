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
        strict: false,
        allow: [".."]
      }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYWlsXFxcXENhc2NhZGVQcm9qZWN0c1xcXFxSZXN1bWVDb252ZXJ0ZXJcXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYWlsXFxcXENhc2NhZGVQcm9qZWN0c1xcXFxSZXN1bWVDb252ZXJ0ZXJcXFxcY2xpZW50XFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9tYWlsL0Nhc2NhZGVQcm9qZWN0cy9SZXN1bWVDb252ZXJ0ZXIvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGNvbW1vbmpzIGZyb20gJ0Byb2xsdXAvcGx1Z2luLWNvbW1vbmpzJztcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XG5pbXBvcnQgY29tcHJlc3Npb24gZnJvbSAndml0ZS1wbHVnaW4tY29tcHJlc3Npb24nO1xuaW1wb3J0IHpsaWIgZnJvbSAnemxpYic7XG5cbi8vIFBsdWdpbiB0byBjb25maWd1cmUgSFRUUCBzZXJ2ZXIgdGltZW91dHMsIGNvbXByZXNzaW9uLCBhbmQgZGlhZ25vc2UgNDAwIGVycm9yc1xuY29uc3QgaHR0cENvbmZpZ1BsdWdpbiA9ICgpID0+ICh7XG4gIG5hbWU6ICdodHRwLWNvbmZpZycsXG4gIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAvLyBMb2cgY2FjaGUgY2xlYW51cCBvbiBzdGFydHVwXG4gICAgY29uc29sZS5sb2coJ1xcblx1RDgzRVx1RERGOSBWaXRlIGNhY2hlIGNsZWFuZWQgb24gc3RhcnR1cCAoLS1mb3JjZSBmbGFnKScpO1xuICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgRGVwZW5kZW5jaWVzIHJlLW9wdGltaXplZFxcbicpO1xuICAgIFxuICAgIC8vIENvbmZpZ3VyZSB0aGUgdW5kZXJseWluZyBIVFRQIHNlcnZlciBvbmNlIGl0J3MgY3JlYXRlZFxuICAgIHNlcnZlci5odHRwU2VydmVyPy5vbignbGlzdGVuaW5nJywgKCkgPT4ge1xuICAgICAgY29uc3QgaHR0cFNlcnZlciA9IHNlcnZlci5odHRwU2VydmVyO1xuICAgICAgLy8gSW5jcmVhc2Uga2VlcC1hbGl2ZSB0aW1lb3V0IHRvIDMwIG1pbnV0ZXMgKGRlZmF1bHQgaXMgNSBzZWNvbmRzIGluIE5vZGUuanMpXG4gICAgICBodHRwU2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSAzMCAqIDYwICogMTAwMDsgLy8gMzAgbWludXRlc1xuICAgICAgLy8gSGVhZGVycyB0aW1lb3V0IHNob3VsZCBiZSBzbGlnaHRseSBoaWdoZXJcbiAgICAgIGh0dHBTZXJ2ZXIuaGVhZGVyc1RpbWVvdXQgPSAzMSAqIDYwICogMTAwMDsgLy8gMzEgbWludXRlc1xuICAgICAgLy8gUmVxdWVzdCB0aW1lb3V0XG4gICAgICBodHRwU2VydmVyLnJlcXVlc3RUaW1lb3V0ID0gNSAqIDYwICogMTAwMDsgLy8gNSBtaW51dGVzIGZvciByZXF1ZXN0IHByb2Nlc3NpbmdcbiAgICAgIGNvbnNvbGUubG9nKCdbVml0ZV0gSFRUUCBzZXJ2ZXIgdGltZW91dHMgY29uZmlndXJlZDoga2VlcEFsaXZlPTMwbWluLCBoZWFkZXJzPTMxbWluJyk7XG4gICAgICBjb25zb2xlLmxvZygnW1ZpdGVdIENvbXByZXNzaW9uIG1pZGRsZXdhcmUgZW5hYmxlZCAoZ3ppcC9icm90bGkpJyk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ29tcHJlc3Npb24gbWlkZGxld2FyZSBmb3IgZGV2IHNlcnZlciAoc2FtZSBiZWhhdmlvciBhcyBwcm9kdWN0aW9uKVxuICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICBjb25zdCBhY2NlcHRFbmNvZGluZyA9IHJlcS5oZWFkZXJzWydhY2NlcHQtZW5jb2RpbmcnXSB8fCAnJztcbiAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XG4gICAgICBcbiAgICAgIC8vIE9ubHkgY29tcHJlc3MgdGV4dC1iYXNlZCBhc3NldHNcbiAgICAgIGNvbnN0IGNvbXByZXNzaWJsZUV4dGVuc2lvbnMgPSAvXFwuKGpzfG1qc3xjc3N8aHRtbHxqc29ufHN2Z3x0eHR8eG1sKShcXD8uKik/JC9pO1xuICAgICAgY29uc3Qgc2hvdWxkQ29tcHJlc3MgPSBjb21wcmVzc2libGVFeHRlbnNpb25zLnRlc3QodXJsKTtcbiAgICAgIFxuICAgICAgaWYgKHNob3VsZENvbXByZXNzICYmIChhY2NlcHRFbmNvZGluZy5pbmNsdWRlcygnYnInKSB8fCBhY2NlcHRFbmNvZGluZy5pbmNsdWRlcygnZ3ppcCcpKSkge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFdyaXRlID0gcmVzLndyaXRlLmJpbmQocmVzKTtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxFbmQgPSByZXMuZW5kLmJpbmQocmVzKTtcbiAgICAgICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgICAgIFxuICAgICAgICByZXMud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgaWYgKGNodW5rKSBjaHVua3MucHVzaChCdWZmZXIuaXNCdWZmZXIoY2h1bmspID8gY2h1bmsgOiBCdWZmZXIuZnJvbShjaHVuaykpO1xuICAgICAgICAgIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gZW5jb2Rpbmc7XG4gICAgICAgICAgICBlbmNvZGluZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgcmVzLmVuZCA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2FsbGJhY2spIHtcbiAgICAgICAgICBpZiAoY2h1bmspIGNodW5rcy5wdXNoKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykgPyBjaHVuayA6IEJ1ZmZlci5mcm9tKGNodW5rKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgYm9keSA9IEJ1ZmZlci5jb25jYXQoY2h1bmtzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBPbmx5IGNvbXByZXNzIGlmIGJvZHkgaXMgbGFyZ2VyIHRoYW4gMUtCXG4gICAgICAgICAgaWYgKGJvZHkubGVuZ3RoID4gMTAyNCkge1xuICAgICAgICAgICAgY29uc3QgdXNlQnJvdGxpID0gYWNjZXB0RW5jb2RpbmcuaW5jbHVkZXMoJ2JyJyk7XG4gICAgICAgICAgICBjb25zdCBjb21wcmVzc01ldGhvZCA9IHVzZUJyb3RsaSA/IHpsaWIuYnJvdGxpQ29tcHJlc3NTeW5jIDogemxpYi5nemlwU3luYztcbiAgICAgICAgICAgIGNvbnN0IGVuY29kaW5nID0gdXNlQnJvdGxpID8gJ2JyJyA6ICdnemlwJztcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgY29tcHJlc3NlZCA9IGNvbXByZXNzTWV0aG9kKGJvZHkpO1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LUVuY29kaW5nJywgZW5jb2RpbmcpO1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdWYXJ5JywgJ0FjY2VwdC1FbmNvZGluZycpO1xuICAgICAgICAgICAgICByZXMucmVtb3ZlSGVhZGVyKCdDb250ZW50LUxlbmd0aCcpO1xuICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxFbmQuY2FsbChyZXMsIGNvbXByZXNzZWQsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gdW5jb21wcmVzc2VkIG9uIGVycm9yXG4gICAgICAgICAgICAgIHJldHVybiBvcmlnaW5hbEVuZC5jYWxsKHJlcywgYm9keSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gb3JpZ2luYWxFbmQuY2FsbChyZXMsIGJvZHksIGNhbGxiYWNrKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgbmV4dCgpO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIExvZyBhbGwgcmVxdWVzdHMgYXQgdGhlIGVhcmxpZXN0IHBvc3NpYmxlIHBvaW50XG4gICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbVml0ZV0gJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9ICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfWApO1xuICAgICAgXG4gICAgICAvLyBJbnRlcmNlcHQgcmVzcG9uc2UgdG8gbG9nIGVycm9yc1xuICAgICAgY29uc3Qgb3JpZ2luYWxFbmQgPSByZXMuZW5kLmJpbmQocmVzKTtcbiAgICAgIHJlcy5lbmQgPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICAgIGlmIChyZXMuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBbVml0ZV0gRXJyb3IgJHtyZXMuc3RhdHVzQ29kZX0gb24gJHtyZXEubWV0aG9kfSAke3JlcS51cmx9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsRW5kKC4uLmFyZ3MpO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgbmV4dCgpO1xuICAgIH0pO1xuICB9XG59KTtcblxuLy8gSFRUUFMgY29uZmlndXJhdGlvbiBoZWxwZXJcbmNvbnN0IGdldEh0dHBzQ29uZmlnID0gKGh0dHBzRW5hYmxlZCkgPT4ge1xuICBpZiAoIWh0dHBzRW5hYmxlZCkgcmV0dXJuIGZhbHNlO1xuICBcbiAgY29uc3QgY2VydHNQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJywgJ2NlcnRpZmljYXRlcycpO1xuICBjb25zdCBrZXlQYXRoID0gcGF0aC5qb2luKGNlcnRzUGF0aCwgJ3ByaXZhdGUua2V5Jyk7XG4gIGNvbnN0IGNlcnRQYXRoID0gcGF0aC5qb2luKGNlcnRzUGF0aCwgJ2NlcnRpZmljYXRlLmNydCcpO1xuICBcbiAgaWYgKCFmcy5leGlzdHNTeW5jKGtleVBhdGgpIHx8ICFmcy5leGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgIGNvbnNvbGUud2FybignXHUyNkEwXHVGRTBGICBIVFRQUyBlbmFibGVkIGJ1dCBjZXJ0aWZpY2F0ZXMgbm90IGZvdW5kLiBGYWxsaW5nIGJhY2sgdG8gSFRUUC4nKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAga2V5OiBmcy5yZWFkRmlsZVN5bmMoa2V5UGF0aCksXG4gICAgY2VydDogZnMucmVhZEZpbGVTeW5jKGNlcnRQYXRoKSxcbiAgfTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgLy8gTG9hZCBlbnYgZnJvbSBjbGllbnQgZGlyZWN0b3J5IChWSVRFXyBwcmVmaXhlZCB2YXJpYWJsZXMpXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgX19kaXJuYW1lLCAnJyk7XG4gIGNvbnN0IEhUVFBTX0VOQUJMRUQgPSBlbnYuVklURV9IVFRQU19FTkFCTEVEID09PSAndHJ1ZSc7XG4gIGNvbnN0IEhUVFBTX1BPUlQgPSBlbnYuVklURV9IVFRQU19QT1JUIHx8ICczNDQzJztcbiAgXG4gIGNvbnNvbGUubG9nKGBcdUQ4M0RcdUREMTAgSFRUUFNfRU5BQkxFRDogJHtIVFRQU19FTkFCTEVEfSAoZW52IHZhbHVlOiBcIiR7ZW52LlZJVEVfSFRUUFNfRU5BQkxFRH1cIilgKTtcbiAgXG4gIHJldHVybiB7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIG5vZGVQb2x5ZmlsbHMoe1xuICAgICAgZ2xvYmFsczoge1xuICAgICAgICBCdWZmZXI6IHRydWUsXG4gICAgICAgIGdsb2JhbDogdHJ1ZSxcbiAgICAgICAgcHJvY2VzczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBwcm90b2NvbEltcG9ydHM6IHRydWUsXG4gICAgfSksXG4gICAgaHR0cENvbmZpZ1BsdWdpbigpLFxuICAgIC8vIEd6aXAgY29tcHJlc3Npb24gZm9yIHByb2R1Y3Rpb24gYnVpbGRzXG4gICAgY29tcHJlc3Npb24oe1xuICAgICAgYWxnb3JpdGhtOiAnZ3ppcCcsXG4gICAgICBleHQ6ICcuZ3onLFxuICAgICAgdGhyZXNob2xkOiAxMDI0LCAvLyBPbmx5IGNvbXByZXNzIGZpbGVzID4gMUtCXG4gICAgICBkZWxldGVPcmlnaW5GaWxlOiBmYWxzZSxcbiAgICAgIGZpbHRlcjogL1xcLihqc3xtanN8anNvbnxjc3N8aHRtbHxzdmd8dHh0fHhtbHx3YXNtKSQvaSxcbiAgICB9KSxcbiAgICAvLyBCcm90bGkgY29tcHJlc3Npb24gKGJldHRlciBjb21wcmVzc2lvbiByYXRpbylcbiAgICBjb21wcmVzc2lvbih7XG4gICAgICBhbGdvcml0aG06ICdicm90bGlDb21wcmVzcycsXG4gICAgICBleHQ6ICcuYnInLFxuICAgICAgdGhyZXNob2xkOiAxMDI0LFxuICAgICAgZGVsZXRlT3JpZ2luRmlsZTogZmFsc2UsXG4gICAgICBmaWx0ZXI6IC9cXC4oanN8bWpzfGpzb258Y3NzfGh0bWx8c3ZnfHR4dHx4bWx8d2FzbSkkL2ksXG4gICAgfSksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBwb3J0OiBIVFRQU19FTkFCTEVEID8gNDQzIDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGh0dHBzOiBnZXRIdHRwc0NvbmZpZyhIVFRQU19FTkFCTEVEKSxcbiAgICBhbGxvd2VkSG9zdHM6IFsnd3d3LnJlc3VtZWNvbnZlcnRlci5uZXQnLCAncmVzdW1lY29udmVydGVyLm5ldCcsICdsb2NhbGhvc3QnXSxcbiAgICBobXI6IGZhbHNlLCAvLyBEaXNhYmxlIEhNUiBmb3IgZXh0ZXJuYWwgZG9tYWluIGFjY2Vzc1xuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiBIVFRQU19FTkFCTEVEID8gYGh0dHBzOi8vbG9jYWxob3N0OiR7SFRUUFNfUE9SVH1gIDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgd3M6IHRydWUsXG4gICAgICAgIHRpbWVvdXQ6IDYwMDAwMCwgLy8gMTAgbWludXRlcyB0aW1lb3V0IGZvciBwcm94eVxuICAgICAgICBwcm94eVRpbWVvdXQ6IDYwMDAwMCwgLy8gMTAgbWludXRlcyB0aW1lb3V0IGZvciBwcm94eSBjb25uZWN0aW9uXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLFxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgb3B0aW9ucykgPT4ge1xuICAgICAgICAgIC8vIFNldCBwcm94eSB0aW1lb3V0IHRvIDEwIG1pbnV0ZXNcbiAgICAgICAgICBwcm94eS5vcHRpb25zLnRpbWVvdXQgPSA2MDAwMDA7XG4gICAgICAgICAgcHJveHkub3B0aW9ucy5wcm94eVRpbWVvdXQgPSA2MDAwMDA7XG4gICAgICAgICAgXG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVyciwgcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWaXRlIFByb3h5XSBFcnJvcjonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgLy8gU2V0IHNvY2tldCB0aW1lb3V0IG9uIHRoZSBvdXRnb2luZyByZXF1ZXN0IHRvIDEwIG1pbnV0ZXNcbiAgICAgICAgICAgIHByb3h5UmVxLnNvY2tldD8uc2V0VGltZW91dCg2MDAwMDApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWaXRlIFByb3h5XSBQcm94eWluZzonLCByZXEubWV0aG9kLCByZXEudXJsLCAnXHUyMTkyJywgcHJveHlSZXEucGF0aCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWaXRlIFByb3h5XSBSZXNwb25zZTonLCBwcm94eVJlcy5zdGF0dXNDb2RlLCAnZnJvbScsIHJlcS51cmwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgICcvZ2VuZXJhdGUtcGRmJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDInLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgJy9oZWFsdGgnOiB7XG4gICAgICAgIHRhcmdldDogSFRUUFNfRU5BQkxFRCA/IGBodHRwczovL2xvY2FsaG9zdDoke0hUVFBTX1BPUlR9YCA6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gICAgZnM6IHtcbiAgICAgIHN0cmljdDogZmFsc2UsXG4gICAgICBhbGxvdzogWycuLiddXG4gICAgfVxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAnL3RpbnltY2UnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vbm9kZV9tb2R1bGVzL3RpbnltY2UnKSxcbiAgICAgICdAcm9vdCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLicpLFxuICAgIH1cbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgIC8vIEZpeCBmb3IgUmVhY3QgZXhwb3J0cyBub3QgYmVpbmcgcmVjb2duaXplZFxuICAgICAgbWFpbkZpZWxkczogWydtb2R1bGUnLCAnbWFpbiddLFxuICAgIH0sXG4gICAgLy8gRXhjbHVkZSAuZW52IGZpbGVzIGZyb20gb3B0aW1pemF0aW9uXG4gICAgZXhjbHVkZTogWycuZW52JywgJy5lbnYubG9jYWwnLCAnLmVudi5kZXZlbG9wbWVudCcsICcuZW52LnByb2R1Y3Rpb24nXSxcbiAgICBpbmNsdWRlOiBbXG4gICAgICAncmVhY3QnLFxuICAgICAgJ3JlYWN0LWRvbScsXG4gICAgICAncmVhY3Qtcm91dGVyLWRvbScsXG4gICAgICAndGlueW1jZS90aW55bWNlJyxcbiAgICAgICd0aW55bWNlL2ljb25zL2RlZmF1bHQnLFxuICAgICAgJ3RpbnltY2UvdGhlbWVzL3NpbHZlcicsXG4gICAgICAndGlueW1jZS9tb2RlbHMvZG9tL21vZGVsJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvYWR2bGlzdCcsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2F1dG9saW5rJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvbGlzdHMnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9saW5rJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvaW1hZ2UnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9jaGFybWFwJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvcHJldmlldycsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2FuY2hvcicsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL3NlYXJjaHJlcGxhY2UnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy92aXN1YWxibG9ja3MnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy9jb2RlJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvZnVsbHNjcmVlbicsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2luc2VydGRhdGV0aW1lJyxcbiAgICAgICd0aW55bWNlL3BsdWdpbnMvbWVkaWEnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy90YWJsZScsXG4gICAgICAndGlueW1jZS9wbHVnaW5zL2hlbHAnLFxuICAgICAgJ3RpbnltY2UvcGx1Z2lucy93b3JkY291bnQnXG4gICAgXVxuICB9LFxuICBidWlsZDoge1xuICAgIC8vIE91dHB1dCBkaXJlY3RvcnkgKGluc2lkZSBjbGllbnQvKVxuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIC8vIFVzZSBlc2J1aWxkIGZvciBtaW5pZmljYXRpb24gKGZhc3RlciBhbmQgbW9yZSBzdGFibGUgdGhhbiB0ZXJzZXIpXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgLy8gRW5hYmxlIHNvdXJjZSBtYXBzIGZvciBkZWJ1Z2dpbmdcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgLy8gQ2h1bmsgc2l6ZSB3YXJuaW5nIGxpbWl0IChpbiBrQilcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMCxcbiAgICAvLyBUYXJnZXQgbW9kZXJuIGJyb3dzZXJzIGZvciBzbWFsbGVyIG91dHB1dFxuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgY29tbW9uanNPcHRpb25zOiB7XG4gICAgICBpbmNsdWRlOiBbL3RpbnltY2UvLCAvbm9kZV9tb2R1bGVzL10sXG4gICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZSxcbiAgICB9LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgY29tbW9uanMoe1xuICAgICAgICAgIGluY2x1ZGU6IC9ub2RlX21vZHVsZXMvLFxuICAgICAgICAgIHRyYW5zZm9ybU1peGVkRXNNb2R1bGVzOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gTWFudWFsIGNodW5rIHNwbGl0dGluZyBmb3IgYmV0dGVyIGNhY2hpbmdcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgICAgICAgLy8gUmVhY3QgY29yZVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWFjdC1kb20nKSB8fCBpZC5pbmNsdWRlcygncmVhY3Qtcm91dGVyJykgfHwgaWQuaW5jbHVkZXMoJy9yZWFjdC8nKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1yZWFjdCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBVSSBsaWJyYXJpZXNcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZnJhbWVyLW1vdGlvbicpIHx8IGlkLmluY2x1ZGVzKCdAaGVhZGxlc3N1aScpIHx8IGlkLmluY2x1ZGVzKCdAaGVyb2ljb25zJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItdWknO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQ2hhcnRzXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlY2hhcnRzJykgfHwgaWQuaW5jbHVkZXMoJ2QzLScpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWNoYXJ0cyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBNYXAgbGlicmFyaWVzXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ21hcGxpYnJlJykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LW1hcC1nbCcpIHx8IGlkLmluY2x1ZGVzKCdtYXBib3gnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1tYXAnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUERGIGxpYnJhcmllc1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdwZGZqcy1kaXN0JykgfHwgaWQuaW5jbHVkZXMoJ2h0bWwycGRmJykgfHwgaWQuaW5jbHVkZXMoJ2pzcGRmJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcGRmJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRpbnlNQ0VcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygndGlueW1jZScpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXRpbnltY2UnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaTE4blxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdpMThuZXh0JykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItaTE4bic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBUaHJlZS5qcyAoV2ViR0wpXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3RocmVlJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItdGhyZWUnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLy8gT3B0aW1pemUgY2h1bmsgZmlsZSBuYW1lc1xuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvanMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tleHRdL1tuYW1lXS1baGFzaF0uW2V4dF0nLFxuICAgICAgfSxcbiAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgIC8vIFN1cHByZXNzIHdhcm5pbmdzIGFib3V0IHZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzXG4gICAgICAgIGlmICh3YXJuaW5nLm1lc3NhZ2U/LmluY2x1ZGVzKCd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscycpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdhcm4od2FybmluZyk7XG4gICAgICB9LFxuICAgICAgLy8gVHJlZS1zaGFraW5nIG9wdGltaXphdGlvblxuICAgICAgdHJlZXNoYWtlOiB7XG4gICAgICAgIG1vZHVsZVNpZGVFZmZlY3RzOiAnbm8tZXh0ZXJuYWwnLFxuICAgICAgICBwcm9wZXJ0eVJlYWRTaWRlRWZmZWN0czogZmFsc2UsXG4gICAgICB9LFxuICAgIH1cbiAgfVxufTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwVixTQUFTLGNBQWMsZUFBZTtBQUNoWSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sUUFBUTtBQUNmLE9BQU8sY0FBYztBQUNyQixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLFVBQVU7QUFQakIsSUFBTSxtQ0FBbUM7QUFVekMsSUFBTSxtQkFBbUIsT0FBTztBQUFBLEVBQzlCLE1BQU07QUFBQSxFQUNOLGdCQUFnQixRQUFRO0FBRXRCLFlBQVEsSUFBSSwwREFBbUQ7QUFDL0QsWUFBUSxJQUFJLG9DQUErQjtBQUczQyxXQUFPLFlBQVksR0FBRyxhQUFhLE1BQU07QUFDdkMsWUFBTSxhQUFhLE9BQU87QUFFMUIsaUJBQVcsbUJBQW1CLEtBQUssS0FBSztBQUV4QyxpQkFBVyxpQkFBaUIsS0FBSyxLQUFLO0FBRXRDLGlCQUFXLGlCQUFpQixJQUFJLEtBQUs7QUFDckMsY0FBUSxJQUFJLHdFQUF3RTtBQUNwRixjQUFRLElBQUkscURBQXFEO0FBQUEsSUFDbkUsQ0FBQztBQUdELFdBQU8sWUFBWSxJQUFJLENBQUMsS0FBSyxLQUFL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
