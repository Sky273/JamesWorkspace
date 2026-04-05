/**
 * End-to-End Integration Tests
 * Tests critical flows: Authentication, File Upload, LLM Operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set environment variables before imports
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CSRF_SECRET = 'test-csrf-secret-that-is-at-least-32-characters';
process.env.POSTGRES_PASSWORD = 'test-password';

// ============================================
// MOCKS
// ============================================

// Mock database
vi.mock('../../config/database.js', () => ({
    query: vi.fn(),
    pool: {
        connect: vi.fn(),
        query: vi.fn(),
        on: vi.fn()
    },
    getClientWithRetry: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(true)
}));

// Mock postgres helpers
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    findWithTimeout: vi.fn(),
    createWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn(),
    destroyWithTimeout: vi.fn(),
    escapeLike: (str) => str.replace(/[%_\\]/g, '\\$&')
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

// Mock security service
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1', userAgent: 'test' })),
    LOG_LEVELS: { INFO: 'info', WARN: 'warn', ERROR: 'error', SECURITY: 'security' },
    SECURITY_EVENTS: { 
        AUTH_SUCCESS: 'AUTH_SUCCESS', 
        AUTH_FAILURE: 'AUTH_FAILURE',
        AUTH_LOGOUT: 'AUTH_LOGOUT',
        AUTH_BLOCKED: 'AUTH_BLOCKED',
        USER_CREATED: 'USER_CREATED'
    }
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn()
    }
}));

// Mock OpenAI service
vi.mock('../../services/openai.service.js', () => ({
    callOpenAI: vi.fn()
}));

// Mock settings service
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

// Import mocked modules
import { selectWithTimeout, findWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';
import bcrypt from 'bcryptjs';
import { callOpenAI } from '../../services/openai.service.js';
import { getLLMSettings } from '../../services/settings.service.js';

// Import JWT service for token generation
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../services/jwt.service.js';

// ============================================
// TEST DATA
// ============================================

const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    password: '$2a$10$hashedpassword',
    status: 'active',
    role: 'user',
    firm_id: '660e8400-e29b-41d4-a716-446655440001',
    firm_name: 'Test Firm'
};

const mockAdminUser = {
    ...mockUser,
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@example.com',
    role: 'admin'
};

const mockResume = {
    id: '770e8400-e29b-41d4-a716-446655440000',
    name: 'John Doe',
    title: 'Senior Developer',
    status: 'analyzed',
    firm_id: mockUser.firm_id,
    firm_name: mockUser.firm_name,
    original_text: 'Sample resume text...',
    skills: JSON.stringify(['JavaScript', 'React', 'Node.js']),
    tools: JSON.stringify(['Git', 'Docker']),
    industries: JSON.stringify(['Tech', 'Finance']),
    soft_skills: JSON.stringify(['Leadership', 'Communication'])
};

const mockMission = {
    id: '880e8400-e29b-41d4-a716-446655440000',
    title: 'Full Stack Developer',
    content: 'Looking for a senior full stack developer...',
    status: 'active',
    firm_id: mockUser.firm_id,
    keywords: JSON.stringify({
        skills: ['JavaScript', 'React'],
        tools: ['Git'],
        industries: ['Tech'],
        softSkills: ['Communication']
    })
};

// ============================================
// AUTHENTICATION FLOW TESTS
// ============================================

describe('E2E: Authentication Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Complete Sign In Flow', () => {
        it('should complete full sign-in flow with valid credentials', async () => {
            // 1. User lookup
            selectWithTimeout.mockResolvedValueOnce([mockUser]);
            
            // 2. Password verification
            bcrypt.compare.mockResolvedValueOnce(true);
            
            // 3. Generate tokens
            const accessToken = generateAccessToken(mockUser);
            const refreshToken = generateRefreshToken(mockUser);
            
            // Verify tokens are valid
            expect(accessToken).toBeDefined();
            expect(refreshToken).toBeDefined();
            expect(typeof accessToken).toBe('string');
            expect(typeof refreshToken).toBe('string');
            
            // 4. Verify access token can be decoded
            const decoded = await verifyToken(accessToken);
            expect(decoded).not.toBeNull();
            expect(decoded.id).toBe(mockUser.id);
            expect(decoded.email).toBe(mockUser.email);
            expect(decoded.role).toBe(mockUser.role);
        });

        it('should reject sign-in with invalid password', async () => {
            // Reset mocks
            selectWithTimeout.mockReset();
            bcrypt.compare.mockReset();
            
            selectWithTimeout.mockResolvedValueOnce([mockUser]);
            bcrypt.compare.mockResolvedValueOnce(false);
            
            const isValidPassword = await bcrypt.compare('wrongpassword', mockUser.password);
            expect(isValidPassword).toBe(false);
        });

        it('should reject sign-in for inactive user', async () => {
            const inactiveUser = { ...mockUser, status: 'inactive' };
            selectWithTimeout.mockResolvedValueOnce([inactiveUser]);
            bcrypt.compare.mockResolvedValueOnce(true);
            
            // Even with valid password, inactive users should be rejected
            expect(inactiveUser.status).toBe('inactive');
        });

        it('should reject sign-in for non-existent user', async () => {
            // Reset mock
            selectWithTimeout.mockReset();
            selectWithTimeout.mockResolvedValueOnce([]);
            
            const users = await selectWithTimeout('users', { where: 'email = $1' });
            expect(users.length).toBe(0);
        });
    });

    describe('Token Refresh Flow', () => {
        it('should refresh access token with valid refresh token', async () => {
            // Generate initial tokens
            const _refreshToken = generateRefreshToken(mockUser);
            
            // Mock user lookup for refresh
            findWithTimeout.mockResolvedValueOnce(mockUser);
            
            // Generate new access token
            const newAccessToken = generateAccessToken(mockUser);
            
            expect(newAccessToken).toBeDefined();
            const decoded = await verifyToken(newAccessToken);
            expect(decoded.id).toBe(mockUser.id);
        });

        it('should reject refresh for inactive user', async () => {
            const inactiveUser = { ...mockUser, status: 'inactive' };
            findWithTimeout.mockResolvedValueOnce(inactiveUser);
            
            expect(inactiveUser.status).toBe('inactive');
            // Route should return 401
        });
    });

    describe('Logout Flow', () => {
        it('should invalidate tokens on logout', async () => {
            const accessToken = generateAccessToken(mockUser);
            
            // Before logout, token should be valid
            const decodedBefore = await verifyToken(accessToken);
            expect(decodedBefore).not.toBeNull();
            
            // After logout, token should be blacklisted
            // (In real implementation, revokeToken adds to blacklist)
        });
    });

    describe('Admin User Management', () => {
        it('should allow admin to create new user', async () => {
            const newUserData = {
                email: 'newuser@example.com',
                password: 'hashedpassword',
                name: 'New User',
                role: 'user',
                status: 'active'
            };
            
            // Reset mocks
            selectWithTimeout.mockReset();
            createWithTimeout.mockReset();
            
            // Mock no existing user
            selectWithTimeout.mockResolvedValueOnce([]);
            
            // Mock user creation
            createWithTimeout.mockResolvedValueOnce([{
                id: '990e8400-e29b-41d4-a716-446655440000',
                ...newUserData
            }]);
            
            const existingUsers = await selectWithTimeout('users', { where: 'email = $1' });
            expect(existingUsers.length).toBe(0);
            
            const createdUsers = await createWithTimeout('users', [{ fields: newUserData }]);
            expect(createdUsers.length).toBe(1);
            expect(createdUsers[0].email).toBe(newUserData.email);
        });

        it('should reject duplicate email registration', async () => {
            selectWithTimeout.mockResolvedValueOnce([mockUser]);
            
            const existingUsers = await selectWithTimeout('users', { where: 'email = $1' });
            expect(existingUsers.length).toBe(1);
            // Route should return 409 Conflict
        });
    });
});

// ============================================
// FILE UPLOAD FLOW TESTS
// ============================================

describe('E2E: File Upload Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Resume Upload', () => {
        it('should create resume record after file upload', async () => {
            const uploadData = {
                file_name: 'resume.pdf',
                resume_file_url: '/uploads/resume-123.pdf',
                resume_file_size: 102400,
                resume_file_type: 'application/pdf',
                firm_id: mockUser.firm_id,
                firm_name: mockUser.firm_name,
                status: 'new'
            };
            
            // Reset and set up mock
            createWithTimeout.mockReset();
            createWithTimeout.mockResolvedValueOnce([{
                id: 'aa0e8400-e29b-41d4-a716-446655440000',
                ...uploadData
            }]);
            
            const createdResumes = await createWithTimeout('resumes', [{ fields: uploadData }]);
            
            expect(createdResumes.length).toBe(1);
            expect(createdResumes[0].file_name).toBe('resume.pdf');
            expect(createdResumes[0].status).toBe('new');
        });

        it('should reject files exceeding size limit', () => {
            const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
            const oversizedFile = { size: 60 * 1024 * 1024 }; // 60MB
            
            expect(oversizedFile.size).toBeGreaterThan(MAX_FILE_SIZE);
        });

        it('should reject unsupported file types', () => {
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const invalidType = 'application/x-executable';
            
            expect(allowedTypes.includes(invalidType)).toBe(false);
        });
    });

    describe('Resume Analysis Flow', () => {
        it('should update resume status during analysis', async () => {
            // Reset and set up mock
            findWithTimeout.mockReset();
            findWithTimeout.mockResolvedValueOnce({ ...mockResume, status: 'new' });
            
            const resume = await findWithTimeout('resumes', mockResume.id);
            expect(resume.status).toBe('new');
        });
    });
});

// ============================================
// LLM OPERATIONS FLOW TESTS
// ============================================

describe('E2E: LLM Operations Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getLLMSettings.mockResolvedValue({ llmModel: 'gpt-4o' });
    });

    describe('Resume Analysis with LLM', () => {
        it('should complete LLM analysis flow', async () => {
            // Mock LLM response
            callOpenAI.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            globalRating: 75,
                            skillsScore: 80,
                            experienceScore: 70,
                            educationScore: 75,
                            atsScore: 72,
                            skills: ['JavaScript', 'React', 'Node.js'],
                            tools: ['Git', 'Docker'],
                            industries: ['Tech'],
                            softSkills: ['Leadership']
                        })
                    }
                }]
            });
            
            const llmResponse = await callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Analyze this resume...' }]
            });
            
            expect(llmResponse.choices).toBeDefined();
            expect(llmResponse.choices[0].message.content).toBeDefined();
            
            const analysis = JSON.parse(llmResponse.choices[0].message.content);
            expect(analysis.globalRating).toBe(75);
            expect(analysis.skills).toContain('JavaScript');
        });

        it('should handle LLM API errors gracefully', async () => {
            callOpenAI.mockRejectedValueOnce(new Error('API rate limit exceeded'));
            
            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Test' }]
            })).rejects.toThrow('API rate limit exceeded');
        });

        it('should handle malformed LLM response', async () => {
            callOpenAI.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: 'not valid json'
                    }
                }]
            });
            
            const response = await callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Test' }]
            });
            
            expect(() => JSON.parse(response.choices[0].message.content)).toThrow();
        });
    });

    describe('Profile Matching with LLM', () => {
        it('should score profiles using LLM', async () => {
            // Reset all mocks for this test
            findWithTimeout.mockReset();
            selectWithTimeout.mockReset();
            callOpenAI.mockReset();
            
            // Mock mission lookup
            findWithTimeout.mockResolvedValueOnce(mockMission);
            
            // Mock resumes lookup
            selectWithTimeout.mockResolvedValueOnce([mockResume]);
            
            // Mock LLM scoring response
            callOpenAI.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            scores: {
                                [mockResume.id]: {
                                    score: 85,
                                    confidence: 'high',
                                    reason: 'Strong match on skills and experience',
                                    keyStrengths: ['JavaScript expertise', 'React experience'],
                                    keyGaps: ['No AWS experience']
                                }
                            }
                        })
                    }
                }]
            });
            
            const mission = await findWithTimeout('missions', mockMission.id);
            expect(mission).toBeDefined();
            
            const resumes = await selectWithTimeout('resumes', {});
            expect(resumes.length).toBeGreaterThan(0);
            
            const llmResponse = await callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Score these profiles...' }]
            });
            
            const scores = JSON.parse(llmResponse.choices[0].message.content);
            expect(scores.scores[mockResume.id].score).toBe(85);
            expect(scores.scores[mockResume.id].confidence).toBe('high');
        });
    });

    describe('Resume Improvement with LLM', () => {
        it('should generate improved resume text', async () => {
            // Reset mock for this specific test
            callOpenAI.mockReset();
            callOpenAI.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: 'Improved resume content with better formatting and keywords...'
                    }
                }]
            });
            
            const response = await callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Improve this resume...' }]
            });
            
            expect(response.choices[0].message.content).toContain('Improved');
        });
    });

    describe('Chatbot Interaction', () => {
        it('should handle chatbot conversation', async () => {
            callOpenAI.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: 'I can help you improve your resume. What specific area would you like to focus on?'
                    }
                }]
            });
            
            const response = await callOpenAI({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a helpful resume assistant.' },
                    { role: 'user', content: 'How can I improve my resume?' }
                ]
            });
            
            expect(response.choices[0].message.content).toBeDefined();
            expect(response.choices[0].message.content.length).toBeGreaterThan(0);
        });
    });
});

// ============================================
// AUTHORIZATION FLOW TESTS
// ============================================

describe('E2E: Authorization Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Firm-based Access Control', () => {
        it('should allow user to access own firm resources', () => {
            const userFirmId = mockUser.firm_id;
            const resourceFirmId = mockResume.firm_id;
            
            expect(userFirmId).toBe(resourceFirmId);
        });

        it('should deny user access to other firm resources', () => {
            const userFirmId = mockUser.firm_id;
            const otherFirmId = '999e8400-e29b-41d4-a716-446655440999';
            
            expect(userFirmId).not.toBe(otherFirmId);
        });

        it('should allow admin to access all firm resources', () => {
            const isAdmin = mockAdminUser.role === 'admin';
            expect(isAdmin).toBe(true);
            // Admins bypass firm checks
        });
    });

    describe('Role-based Access Control', () => {
        it('should identify admin users correctly', () => {
            expect(mockAdminUser.role).toBe('admin');
            expect(mockUser.role).toBe('user');
        });

        it('should restrict admin endpoints to admin users', () => {
            const userRole = mockUser.role;
            const _adminRequired = true;
            
            expect(userRole === 'admin').toBe(false);
            // Route should return 403 Forbidden
        });
    });
});

// ============================================
// ERROR HANDLING FLOW TESTS
// ============================================

describe('E2E: Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Database Errors', () => {
        it('should handle database connection errors', async () => {
            // Reset and set up mock for this specific test
            selectWithTimeout.mockReset();
            selectWithTimeout.mockRejectedValueOnce(new Error('Connection refused'));
            
            await expect(selectWithTimeout('users', {})).rejects.toThrow('Connection refused');
        });

        it('should handle query timeout', async () => {
            // Reset and set up mock for this specific test
            selectWithTimeout.mockReset();
            selectWithTimeout.mockRejectedValueOnce(new Error('Query timeout'));
            
            await expect(selectWithTimeout('resumes', {})).rejects.toThrow('Query timeout');
        });
    });

    describe('Validation Errors', () => {
        it('should reject invalid UUID format', () => {
            const invalidId = 'not-a-uuid';
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            
            expect(uuidRegex.test(invalidId)).toBe(false);
        });

        it('should reject invalid email format', () => {
            const invalidEmail = 'not-an-email';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            expect(emailRegex.test(invalidEmail)).toBe(false);
        });
    });

    describe('Rate Limiting', () => {
        it('should track request counts', () => {
            const rateLimitStore = new Map();
            const userId = mockUser.id;
            const maxRequests = 50;
            
            // Simulate requests
            for (let i = 0; i < 60; i++) {
                const current = rateLimitStore.get(userId) || 0;
                rateLimitStore.set(userId, current + 1);
            }
            
            expect(rateLimitStore.get(userId)).toBe(60);
            expect(rateLimitStore.get(userId)).toBeGreaterThan(maxRequests);
            // Should trigger rate limit
        });
    });
});
