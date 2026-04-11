import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { configureStaticFiles } from '../../config/staticFiles.js';

function createFixtureDir() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-converter-static-'));
    const serverDir = path.join(root, 'server');
    const distDir = path.join(root, 'client', 'dist');
    const assetsDir = path.join(distDir, 'assets', 'js');
    fs.mkdirSync(serverDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body>app</body></html>');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("app");');
    fs.writeFileSync(path.join(distDir, 'app.js.br'), zlib.brotliCompressSync(Buffer.from('console.log("app");')));
    fs.writeFileSync(path.join(assetsDir, 'index-12345678.js'), 'console.log("hashed");');
    fs.writeFileSync(path.join(assetsDir, 'index-12345678.js.br'), zlib.brotliCompressSync(Buffer.from('console.log("hashed");')));
    fs.writeFileSync(path.join(distDir, 'vendor-i18n-AbC_1234.js'), 'console.log("vite-like hash");');
    fs.writeFileSync(path.join(distDir, 'vendor-i18n-AbC_1234.js.br'), zlib.brotliCompressSync(Buffer.from('console.log("vite-like hash");')));
    fs.mkdirSync(path.join(distDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(distDir, 'nested', 'feature.js.gz'), zlib.gzipSync(Buffer.from('console.log("feature");')));
    return { root, serverDir };
}

function removeFixtureDir(root) {
    fs.rmSync(root, { recursive: true, force: true });
}

describe('configureStaticFiles', () => {
    const fixtures = [];

    afterEach(() => {
        while (fixtures.length > 0) {
            removeFixtureDir(fixtures.pop());
        }
    });

    it('sets nosniff on static asset responses', async () => {
        const { root, serverDir } = createFixtureDir();
        fixtures.push(root);

        const app = express();
        configureStaticFiles(app, serverDir);

        const res = await request(app).get('/app.js');

        expect(res.status).toBe(200);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('sets immutable caching headers for hashed assets, including precompressed variants', async () => {
        const { root, serverDir } = createFixtureDir();
        fixtures.push(root);

        const app = express();
        configureStaticFiles(app, serverDir);

        const plainRes = await request(app).get('/assets/js/index-12345678.js');
        const compressedRes = await request(app)
            .get('/assets/js/index-12345678.js')
            .set('Accept-Encoding', 'br, gzip');

        expect(plainRes.status).toBe(200);
        expect(plainRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');

        expect(compressedRes.status).toBe(200);
        expect(compressedRes.headers['content-encoding']).toBe('br');
        expect(compressedRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    });

    it('treats vite-style alphanumeric hashed chunks outside /assets as immutable', async () => {
        const { root, serverDir } = createFixtureDir();
        fixtures.push(root);

        const app = express();
        configureStaticFiles(app, serverDir);

        const plainRes = await request(app).get('/vendor-i18n-AbC_1234.js');
        const compressedRes = await request(app)
            .get('/vendor-i18n-AbC_1234.js')
            .set('Accept-Encoding', 'br, gzip');

        expect(plainRes.status).toBe(200);
        expect(plainRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');

        expect(compressedRes.status).toBe(200);
        expect(compressedRes.headers['content-encoding']).toBe('br');
        expect(compressedRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    });

    it('serves precompressed assets from an initialized index without per-request filesystem checks', async () => {
        const { root, serverDir } = createFixtureDir();
        fixtures.push(root);

        const readdirSpy = vi.spyOn(fs, 'readdirSync');
        const existsSpy = vi.spyOn(fs, 'existsSync');

        const app = express();
        configureStaticFiles(app, serverDir);
        const readdirCallsAfterSetup = readdirSpy.mock.calls.length;

        const brotliRes = await request(app)
            .get('/app.js')
            .set('Accept-Encoding', 'br, gzip');

        const gzipRes = await request(app)
            .get('/nested/feature.js')
            .set('Accept-Encoding', 'gzip');

        expect(brotliRes.status).toBe(200);
        expect(brotliRes.headers['content-encoding']).toBe('br');
        expect(brotliRes.headers['x-content-type-options']).toBe('nosniff');
        expect(brotliRes.headers['vary']).toBe('Accept-Encoding');
        expect(brotliRes.text).toBe('console.log("app");');

        expect(gzipRes.status).toBe(200);
        expect(gzipRes.headers['content-encoding']).toBe('gzip');
        expect(gzipRes.headers['x-content-type-options']).toBe('nosniff');
        expect(gzipRes.headers['vary']).toBe('Accept-Encoding');
        expect(gzipRes.text).toBe('console.log("feature");');

        expect(readdirSpy.mock.calls.length).toBe(readdirCallsAfterSetup);
        expect(existsSpy).not.toHaveBeenCalled();
    });

    it('sets nosniff and revalidation headers on spa fallback responses', async () => {
        const { root, serverDir } = createFixtureDir();
        fixtures.push(root);

        const app = express();
        configureStaticFiles(app, serverDir);

        const res = await request(app).get('/dashboard');

        expect(res.status).toBe(200);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('no-cache, max-age=0, must-revalidate');
        expect(res.text).toContain('<!doctype html>');
    });

});
