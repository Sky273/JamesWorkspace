/**
 * Tests for Resume Upload routes
 * POST /extract-doc, POST /extract-pdf, POST /upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { multerCallOptions } = vi.hoisted(() => ({ multerCallOptions: [] }));

const mockInsertResume = vi.fn();
const mockUpdateResumeFileUrl = vi.fn();
const mockUpdateConsentStatus = vi.fn();
vi.mock('../../services/resumes.service.js', () => ({
    insertResume: (...args) => mockInsertResume(...args),
    updateResumeFileUrl: (...args) => mockUpdateResumeFileUrl(...args),
    updateConsentStatus: (...args) => mockUpdateConsentStatus(...args)
}));

vi.mock('../../config/constants.js', () => ({
    UPLOAD_DIR: '/tmp/uploads',
    MAX_FILE_SIZE: 50 * 1024 * 1024
}));

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

const mockGetUserFirmId = vi.fn();
const mockIsValidUUID = vi.fn();
const mockGetFirmById = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args),
    isValidUUID: (...args) => mockIsValidUUID(...args),
    getFirmById: (...args) => mockGetFirmById(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const mockUploadLimiter = vi.fn((req, _res, next) => next());
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    uploadLimiter: (...args) => mockUploadLimiter(...args)
}));

vi.mock('multer', () => {
    class MulterError extends Error {
        constructor(code, field) {
            super(code);
            this.code = code;
            this.field = field;
            this.name = 'MulterError';
        }
    }

    const multerMock = vi.fn((options = {}) => {
        multerCallOptions.push(options);
        return {
            single: () => (req, _res, next) => {
                if (req.headers['x-test-oversized'] === 'true') {
                    next(new MulterError('LIMIT_FILE_SIZE', 'file'));
                    return;
                }

                if (req.headers['x-test-invalid-filetype'] === 'true' && typeof options.fileFilter === 'function') {
                    options.fileFilter(req, {
                        originalname: 'resume.exe',
                        mimetype: 'application/x-msdownload'
                    }, (error) => next(error || undefined));
                    return;
                }

                if (req.headers['x-test-no-file'] === 'true') {
                    req.file = null;
                } else {
                    req.file = {
                        path: '/tmp/uploads/test-file',
                        originalname: req.headers['x-test-filename'] || 'resume.pdf',
                        size: 1024,
                        mimetype: req.headers['x-test-mimetype'] || 'application/pdf'
                    };
                }

                if (req.headers['x-test-body']) {
                    try { req.body = JSON.parse(req.headers['x-test-body']); } catch {}
                }
                next();
            }
        };
    });

    multerMock.memoryStorage = () => ({});
    multerMock.MulterError = MulterError;
    return { default: multerMock };
});

vi.mock('../../services/consent.service.js', () => ({
    sendConsentRequest: vi.fn().mockResolvedValue()
}));

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

    it('configures multer with a 50MB file size limit', () => {
        expect(multerCallOptions).toHaveLength(3);
        expect(multerCallOptions.every((options) => options.limits?.fileSize === 50 * 1024 * 1024)).toBe(true);
        expect(multerCallOptions.every((options) => options.limits?.files === 1)).toBe(true);
    });

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

        it('should reject invalid file types before extraction', async () => {
            const res = await request(app)
                .post('/api/resumes/extract-pdf')
                .set({ ...AUTH, 'x-test-invalid-filetype': 'true' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid file type');
        });
    });

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

        it('should reject oversized files with 413', async () => {
            const res = await request(app)
                .post('/api/resumes/upload')
                .set({ ...AUTH, 'x-test-oversized': 'true' });

            expect(res.status).toBe(413);
            expect(res.body.error).toContain('50MB');
        });

        it('should reject unsupported file types', async () => {
            const res = await request(app)
                .post('/api/resumes/upload')
                .set({ ...AUTH, 'x-test-invalid-filetype': 'true' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid file type');
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
            expect(mockInsertResume).toHaveBeenCalledWith(expect.objectContaining({
                fileBuffer,
                fileSize: 1024
            }));
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




