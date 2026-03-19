/**
 * Tests for Resume Upload routes
 * POST /extract-doc, POST /extract-pdf, POST /upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock resumes service
const mockInsertResume = vi.fn();
const mockUpdateResumeFileUrl = vi.fn();
const mockUpdateConsentStatus = vi.fn();
vi.mock('../../services/resumes.service.js', () => ({
    insertResume: (...args) => mockInsertResume(...args),
    updateResumeFileUrl: (...args) => mockUpdateResumeFileUrl(...args),
    updateConsentStatus: (...args) => mockUpdateConsentStatus(...args)
}));

// Mock constants
vi.mock('../../config/constants.js', () => ({
    UPLOAD_DIR: '/tmp/uploads'
}));

// Mock fs/promises
const mockReadFile = vi.fn();
const mockUnlink = vi.fn();
vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args) => mockReadFile(...args),
        unlink: (...args) => mockUnlink(...args)
    },
    readFile: (...args) => mockReadFile(...args),
    unlink: (...args) => mockUnlink(...args)
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
const mockIsValidUUID = vi.fn();
const mockGetFirmById = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args),
    isValidUUID: (...args) => mockIsValidUUID(...args),
    getFirmById: (...args) => mockGetFirmById(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock multer - also populate req.body from x-test-body header for multipart simulation
vi.mock('multer', () => {
    const multerMock = () => ({
        single: () => (req, res, next) => {
            if (req.headers['x-test-no-file'] === 'true') {
                req.file = null;
            } else {
                req.file = {
                    path: '/tmp/uploads/test-file',
                    originalname: 'resume.pdf',
                    size: 1024,
                    mimetype: 'application/pdf'
                };
            }
            // Simulate multer populating req.body from form fields
            if (req.headers['x-test-body']) {
                try { req.body = JSON.parse(req.headers['x-test-body']); } catch {}
            }
            next();
        }
    });
    multerMock.memoryStorage = () => ({});
    return { default: multerMock };
});

// Mock consent service (dynamic import in route)
vi.mock('../../services/consent.service.js', () => ({
    sendConsentRequest: vi.fn().mockResolvedValue()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                role: req.headers['x-test-role'] || 'user',
                firm: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import uploadRoutes from '../../routes/resumes/upload.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/resumes', uploadRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Resume Upload Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockUnlink.mockResolvedValue(undefined);
        mockGetUserFirmId.mockResolvedValue('firm-1');
        mockGetFirmById.mockResolvedValue({ id: 'firm-1', name: 'Test Firm' });
        mockIsValidUUID.mockReturnValue(true);
    });

    // ==========================================
    // POST /extract-doc
    // ==========================================
    describe('POST /extract-doc', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/resumes/extract-doc');
            expect(res.status).toBe(401);
        });

        it('should return 400 if no file uploaded', async () => {
            const res = await request(app)
                .post('/api/resumes/extract-doc')
                .set({ ...AUTH, 'x-test-no-file': 'true' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file');
        });
    });

    // ==========================================
    // POST /extract-pdf
    // ==========================================
    describe('POST /extract-pdf', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/resumes/extract-pdf');
            expect(res.status).toBe(401);
        });

        it('should return 400 if no file uploaded', async () => {
            const res = await request(app)
                .post('/api/resumes/extract-pdf')
                .set({ ...AUTH, 'x-test-no-file': 'true' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file');
        });
    });

    // ==========================================
    // POST /upload
    // ==========================================
    describe('POST /upload', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/resumes/upload');
            expect(res.status).toBe(401);
        });

        it('should return 400 if no file uploaded', async () => {
            const res = await request(app)
                .post('/api/resumes/upload')
                .set({ ...AUTH, 'x-test-no-file': 'true' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file');
        });

        it('should upload resume successfully', async () => {
            const fileBuffer = Buffer.from('fake pdf content');
            mockReadFile.mockResolvedValue(fileBuffer);
            
            mockInsertResume.mockResolvedValueOnce({
                id: 'r-1',
                name: 'resume.pdf',
                title: '',
                file_name: 'resume.pdf',
                resume_file_size: 1024,
                resume_file_type: 'application/pdf',
                resume_file_url: '/api/resumes/null/download',
                firm_name: 'Test Firm',
                profile_type: 'external',
                candidate_name: null,
                candidate_email: null,
                consent_status: 'pending_consent'
            });
            mockUpdateResumeFileUrl.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/resumes/upload')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('r-1');
            expect(res.body.Status).toBe('Active');
        });

        it('should handle employee profile type', async () => {
            const fileBuffer = Buffer.from('content');
            mockReadFile.mockResolvedValue(fileBuffer);
            mockInsertResume.mockResolvedValueOnce({
                id: 'r-2',
                name: 'test',
                title: 'Dev',
                file_name: 'test.pdf',
                resume_file_size: 512,
                resume_file_type: 'application/pdf',
                resume_file_url: '/api/resumes/null/download',
                firm_name: 'Test Firm',
                profile_type: 'employee',
                candidate_name: 'John',
                candidate_email: null,
                consent_status: 'not_required'
            });
            mockUpdateResumeFileUrl.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/resumes/upload')
                .set(AUTH)
                .send({ profile_type: 'employee', name: 'test' });

            expect(res.status).toBe(201);
            expect(res.body.consent_status).toBe('not_required');
        });

        it('should return 500 on DB error', async () => {
            mockReadFile.mockResolvedValue(Buffer.from('content'));
            mockInsertResume.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/resumes/upload')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Failed to upload');
        });
    });
});
