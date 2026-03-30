import zlib from 'zlib';

const COMPRESSIBLE_EXTENSIONS = /\.(js|mjs|css|html|json|svg|txt|xml)(\?.*)?$/i;
const FAVICON_PATHS = new Set(['/favicon.svg', '/favicon.ico']);

function isSpaRoute(url) {
  return !url.includes('.') && !url.startsWith('/api/') && !url.startsWith('/@') && !url.startsWith('/node_modules/');
}

export function httpConfigPlugin() {
  return {
    name: 'http-config',
    configureServer(server) {
      console.log('\nVite cache cleaned on startup (--force flag)');
      console.log('Dependencies re-optimized\n');

      server.httpServer?.on('listening', () => {
        const httpServer = server.httpServer;
        httpServer.keepAliveTimeout = 30 * 60 * 1000;
        httpServer.headersTimeout = 31 * 60 * 1000;
        httpServer.requestTimeout = 5 * 60 * 1000;
        console.log('[Vite] HTTP server timeouts configured: keepAlive=30min, headers=31min');
        console.log('[Vite] Compression middleware enabled (gzip/brotli)');
      });

      server.middlewares.use((req, res, next) => {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const url = req.url || '';

        if ((isSpaRoute(url) && url !== '/') || !COMPRESSIBLE_EXTENSIONS.test(url) || (!acceptEncoding.includes('br') && !acceptEncoding.includes('gzip'))) {
          return next();
        }

        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);
        const chunks = [];

        res.write = function write(chunk, encoding, callback) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          if (callback) callback();
          return true;
        };

        res.end = function end(chunk, encoding, callback) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

          const body = Buffer.concat(chunks);
          if (body.length <= 1024) {
            return originalEnd.call(res, body, callback);
          }

          const useBrotli = acceptEncoding.includes('br');
          const compressMethod = useBrotli ? zlib.brotliCompressSync : zlib.gzipSync;
          const contentEncoding = useBrotli ? 'br' : 'gzip';

          try {
            const compressed = compressMethod(body);
            res.setHeader('Content-Encoding', contentEncoding);
            res.setHeader('Vary', 'Accept-Encoding');
            res.removeHeader('Content-Length');
            return originalEnd.call(res, compressed, callback);
          } catch {
            return originalEnd.call(res, body, callback);
          }
        };

        return next();
      });

      server.middlewares.use((req, res, next) => {
        if (req.url === '/favicon.ico') {
          res.writeHead(302, { Location: '/favicon.svg' });
          res.end();
          return;
        }
        next();
      });

      server.middlewares.use((req, res, next) => {
        if (FAVICON_PATHS.has(req.url || '')) {
          return next();
        }

        console.log(`[Vite] ${new Date().toISOString()} ${req.method} ${req.url}`);
        const originalEnd = res.end.bind(res);
        res.end = function end(...args) {
          if (res.statusCode >= 400) {
            console.error(`[Vite] Error ${res.statusCode} on ${req.method} ${req.url}`);
          }
          return originalEnd(...args);
        };

        next();
      });
    },
  };
}
