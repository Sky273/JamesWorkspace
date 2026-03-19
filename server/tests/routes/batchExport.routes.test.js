/**
 * Tests for Batch Export routes
 * POST /
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock JSZip
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn();
vi.mock('jszip', () => ({
    default: class MockJSZip {
        constructor() {
            this.files = {};
        }
        file(name, data) {
            this.files[name] = data;
            mockFile(name, data);
        }
        generateAsync(opts) { return mockGenerateAsync(opts); }
    }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', role: 'user' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import batchExportRoutes from '../../routes/batchExport.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/batch-export', batchExportRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Batch Export Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('POST /', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .send({ resumeIds: ['r-1'], templateId: 't-1' });
            expect(res.status).toBe(401);
        });

        it('should return 400 if no resumeIds', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ templateId: 't-1' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Resume IDs');
        });

        it('should return 400 if resumeIds is empty array', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [], templateId: 't-1' });
            expect(res.status).toBe(400);
        });

        it('should return 400 if no templateId', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: ['r-1'] });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Template ID');
        });

        it('should return 503 if PDF server is not reachable', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: ['r-1'], templateId: 't-1' });

            expect(res.status).toBe(503);
            expect(res.body.error).toContain('PDF server');
        });

        it('should return 404 if template not found', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health check
            mockQuery.mockResolvedValueOnce({ rows: [] }); // template query

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: ['r-1'], templateId: 't-1' });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Template not found');
        });

        it('should generate ZIP with PDFs', async () => {
            // Health check
            mockFetch.mockResolvedValueOnce({ ok: true });
            // Template query
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 't-1', template_content: '<div>-content-</div>', header_content: '', footer_content: '', stylesheet: '', footer_height: 25 }]
            });
            // Resume query
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'r-1', name: 'John Doe', title: 'Dev', improved_text: 'CV content' }]
            });
            // PDF generation
            mockFetch.mockResolvedValueOnce({
                ok: true,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
            });
            // ZIP generation
            mockGenerateAsync.mockResolvedValueOnce(Buffer.from('fake-zip'));

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: ['r-1'], templateId: 't-1' });

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/zip');
        });

        it('should return 500 if no files generated', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 't-1', template_content: '<div></div>' }]
            });
            // Resume not found
            mockQuery.mockResolvedValueOnce({ rows: [] });
            // ZIP has no files - mockFile is never called, so files is empty

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: ['r-1'], templateId: 't-1' });

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('No files');
        });

        it('should handle PDF generation failure gracefully', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 't-1', template_content: '<div>-content-</div>' }]
            });
            // Resume found
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'r-1', name: 'John', title: 'Dev', improved_text: 'text' }]
            });
            // PDF generation fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: () => Promise.resolve('PDF error')
            });

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: ['r-1'], templateId: 't-1' });

            // No files generated -> 500
            expect(res.status).toBe(500);
        });
    });
});
