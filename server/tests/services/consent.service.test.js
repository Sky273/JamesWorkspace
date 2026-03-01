/**
 * Tests for Consent Service (GDPR)
 * Tests consent initialization, token validation, and consent lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/mail/gdprMailService.js', () => ({
    gdprMailService: {
        sendEmail: vi.fn().mockResolvedValue({ success: true })
    }
}));

// Set environment variable
process.env.FRONTEND_URL = 'http://localhost:5173';

// Import after mocks
import { query } from '../../config/database.js';
import consentService from '../../services/consent.service.js';

describe('Consent Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initializeConsent', () => {
        it('should throw error if resumeId is missing', async () => {
            await expect(consentService.initializeConsent({
                profileType: 'external',
                candidateName: 'John Doe'
            })).rejects.toThrow('Resume ID is required');
        });

        it('should throw error if profileType is invalid', async () => {
            await expect(consentService.initializeConsent({
                resumeId: 'test-resume-id',
                profileType: 'invalid',
                candidateName: 'John Doe'
            })).rejects.toThrow('Profile type must be');
        });

        it('should throw error if candidateName is missing', async () => {
            await expect(consentService.initializeConsent({
                resumeId: 'test-resume-id',
                profileType: 'external'
            })).rejects.toThrow('Candidate name is required');
        });

        it('should throw error if email missing for external profile', async () => {
            await expect(consentService.initializeConsent({
                resumeId: 'test-resume-id',
                profileType: 'external',
                candidateName: 'John Doe'
            })).rejects.toThrow('Candidate email is required');
        });

        it('should initialize consent for employee without token', async () => {
            const mockResume = {
                id: 'test-resume-id',
                profile_type: 'employee',
                candidate_name: 'John Doe',
                consent_status: 'not_required',
                consent_token: null
            };

            query.mockResolvedValueOnce({ rows: [mockResume] });

            const result = await consentService.initializeConsent({
                resumeId: 'test-resume-id',
                profileType: 'employee',
                candidateName: 'John Doe'
            });

            expect(result.consent_status).toBe('not_required');
            expect(result.consent_token).toBeNull();
        });

        it('should initialize consent for external with token', async () => {
            const mockResume = {
                id: 'test-resume-id',
                profile_type: 'external',
                candidate_name: 'John Doe',
                candidate_email: 'john@example.com',
                consent_status: 'pending_consent',
                consent_token: 'abc123'
            };

            query.mockResolvedValueOnce({ rows: [mockResume] });

            const result = await consentService.initializeConsent({
                resumeId: 'test-resume-id',
                profileType: 'external',
                candidateName: 'John Doe',
                candidateEmail: 'john@example.com'
            });

            expect(result.consent_status).toBe('pending_consent');
            
            // Verify query was called with token
            const callArgs = query.mock.calls[0][1];
            expect(callArgs[4]).toBeTruthy(); // consent_token should be set
            expect(callArgs[4].length).toBe(64); // 32 bytes = 64 hex chars
        });

        it('should throw error if resume not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await expect(consentService.initializeConsent({
                resumeId: 'nonexistent',
                profileType: 'employee',
                candidateName: 'John Doe'
            })).rejects.toThrow('Resume not found');
        });
    });

    describe('validateConsentToken', () => {
        it('should return null for invalid token format', async () => {
            const result = await consentService.validateConsentToken('short');
            expect(result).toBeNull();
        });

        it('should return null for null token', async () => {
            const result = await consentService.validateConsentToken(null);
            expect(result).toBeNull();
        });

        it('should return null if token not found in database', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] }); // Diagnostic query

            const token = 'a'.repeat(64);
            const result = await consentService.validateConsentToken(token);
            
            expect(result).toBeNull();
        });

        it('should return resume with expired flag if token expired', async () => {
            const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'pending_consent',
                    consent_token_expires_at: expiredDate
                }]
            });

            const token = 'a'.repeat(64);
            const result = await consentService.validateConsentToken(token);
            
            expect(result.expired).toBe(true);
        });

        it('should return resume with alreadyProcessed flag if not pending', async () => {
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'active',
                    consent_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }]
            });

            const token = 'a'.repeat(64);
            const result = await consentService.validateConsentToken(token);
            
            expect(result.alreadyProcessed).toBe(true);
        });

        it('should return valid resume for valid token', async () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'pending_consent',
                    consent_token_expires_at: futureDate,
                    candidate_name: 'John Doe'
                }]
            });

            const token = 'a'.repeat(64);
            const result = await consentService.validateConsentToken(token);
            
            expect(result.id).toBe('test-resume');
            expect(result.expired).toBeUndefined();
            expect(result.alreadyProcessed).toBeUndefined();
        });
    });

    describe('recordConsentResponse', () => {
        it('should throw error for invalid token', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] }); // Diagnostic query

            const token = 'a'.repeat(64);
            await expect(consentService.recordConsentResponse(token, true))
                .rejects.toThrow('Invalid or expired');
        });

        it('should throw error for expired token', async () => {
            const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'pending_consent',
                    consent_token_expires_at: expiredDate
                }]
            });

            const token = 'a'.repeat(64);
            await expect(consentService.recordConsentResponse(token, true))
                .rejects.toThrow('expired');
        });

        it('should record accepted consent with retention date', async () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            // validateConsentToken query
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'pending_consent',
                    consent_token_expires_at: futureDate
                }]
            });
            
            // recordConsentResponse update query
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'active',
                    retention_until: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000)
                }]
            });

            const token = 'a'.repeat(64);
            const result = await consentService.recordConsentResponse(token, true);
            
            expect(result.consent_status).toBe('active');
            expect(result.retention_until).toBeTruthy();
        });

        it('should record refused consent without retention date', async () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'pending_consent',
                    consent_token_expires_at: futureDate
                }]
            });
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    consent_status: 'refused',
                    retention_until: null
                }]
            });

            const token = 'a'.repeat(64);
            const result = await consentService.recordConsentResponse(token, false);
            
            expect(result.consent_status).toBe('refused');
            expect(result.retention_until).toBeNull();
        });
    });

    describe('getConsentStatus', () => {
        it('should throw error if resume not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await expect(consentService.getConsentStatus('nonexistent'))
                .rejects.toThrow('Resume not found');
        });

        it('should return consent status', async () => {
            query.mockResolvedValueOnce({ 
                rows: [{
                    id: 'test-resume',
                    profile_type: 'external',
                    consent_status: 'active',
                    retention_until: new Date()
                }]
            });

            const result = await consentService.getConsentStatus('test-resume');
            
            expect(result.consent_status).toBe('active');
            expect(result.profile_type).toBe('external');
        });
    });

    describe('checkExpiredConsents', () => {
        it('should mark expired pending consents', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: '1' }, { id: '2' }] }); // Expired pending
            query.mockResolvedValueOnce({ rows: [{ id: '3' }] }); // Expired retention

            const result = await consentService.checkExpiredConsents();
            
            expect(result).toBe(3);
        });

        it('should return 0 if no expired consents', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] });

            const result = await consentService.checkExpiredConsents();
            
            expect(result).toBe(0);
        });
    });

    describe('purgeResume', () => {
        it('should delete resume and related data', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // Delete versions
            query.mockResolvedValueOnce({ rows: [] }); // Delete adaptations
            query.mockResolvedValueOnce({ rows: [] }); // Delete submissions
            query.mockResolvedValueOnce({ rows: [{ id: 'test-resume' }] }); // Delete resume

            const result = await consentService.purgeResume('test-resume');
            
            expect(result).toBe(true);
            expect(query).toHaveBeenCalledTimes(4);
        });

        it('should return false if resume not found', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // Delete versions
            query.mockResolvedValueOnce({ rows: [] }); // Delete adaptations
            query.mockResolvedValueOnce({ rows: [] }); // Delete submissions
            query.mockResolvedValueOnce({ rows: [] }); // Delete resume (not found)

            const result = await consentService.purgeResume('nonexistent');
            
            expect(result).toBe(false);
        });
    });

    describe('purgeExpiredResumes', () => {
        it('should purge all expired/refused resumes', async () => {
            // Find resumes to purge
            query.mockResolvedValueOnce({ rows: [{ id: '1' }, { id: '2' }] });
            
            // For each resume: 4 delete queries
            for (let i = 0; i < 2; i++) {
                query.mockResolvedValueOnce({ rows: [] }); // versions
                query.mockResolvedValueOnce({ rows: [] }); // adaptations
                query.mockResolvedValueOnce({ rows: [] }); // submissions
                query.mockResolvedValueOnce({ rows: [{ id: String(i + 1) }] }); // resume
            }

            const result = await consentService.purgeExpiredResumes();
            
            expect(result).toBe(2);
        });
    });
});
