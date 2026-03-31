import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configureStaticFiles } from '../../config/staticFiles.js';

function createFixtureDir() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-converter-static-'));
    const serverDir = path.join(root, 'server');
    const distDir = path.join(root, 'client', 'dist');
    fs.mkdirSync(serverDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body>app</body></html>');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("app");');
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

    it('sets nosniff and no-store on spa fallback responses', async () => {
        const { root, serverDir } = createFixtureDir();
        fixtures.push(root);

        const app = express();
        configureStaticFiles(app, serverDir);

        const res = await request(app).get('/dashboard');

        expect(res.status).toBe(200);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
        expect(res.text).toContain('<!doctype html>');
    });
});
