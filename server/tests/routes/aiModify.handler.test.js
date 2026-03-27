/**
 * Tests for resumes/aiModify.handler.js
 * AI Modify handler: content validation, selection vs full mode, JSON parsing, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

const mockCallBusinessChatCompletion = vi.fn();
vi.mock('../../services/llmProvider.service.js', () => ({
    callBusinessChatCompletion: (...args) => mockCallBusinessChatCompletion(...args)
}));

const mockGetLLMSettings = vi.fn();
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: (...args) => mockGetLLMSettings(...args)
}));

vi.mock('../../services/security.service.js', () => ({
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1' }))
}));

import { aiModifyHandler } from '../../routes/resumes/aiModify.handler.js';

function mockReqRes(body = {}) {
    const req = { body };
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
    };
    return { req, res };
}

describe('aiModifyHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockGetLLMSettings.mockResolvedValue({ llmModel: 'gpt-4o' });
    });

    it('should return 400 if content is missing', async () => {
        const { req, res } = mockReqRes({ instructions: 'fix' });

        await aiModifyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('required') }));
    });

    it('should return 400 if instructions are missing', async () => {
        const { req, res } = mockReqRes({ content: '<p>CV</p>' });

        await aiModifyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 if no LLM model configured', async () => {
        mockGetLLMSettings.mockResolvedValue({ llmModel: null });
        const { req, res } = mockReqRes({ content: '<p>CV</p>', instructions: 'fix typos' });

        await aiModifyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('not configured') }));
    });

    it('should handle full content modification', async () => {
        mockCallBusinessChatCompletion.mockResolvedValueOnce({
            choices: [{ message: { content: '{"modifiedContent":"<p>Fixed CV</p>","message":"Fixed typos"}' } }]
        });

        const { req, res } = mockReqRes({ content: '<p>CV with typo</p>', instructions: 'fix typos' });

        await aiModifyHandler(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            modifiedContent: '<p>Fixed CV</p>',
            message: 'Fixed typos'
        }));
    });

    it('should handle selection-based modification', async () => {
        mockCallBusinessChatCompletion.mockResolvedValueOnce({
            choices: [{ message: { content: '{"modifiedSelection":"<span>Better text</span>","message":"Improved selection"}' } }]
        });

        const { req, res } = mockReqRes({
            content: '<div><span>Old text</span></div>',
            instructions: 'improve',
            selectedText: '<span>Old text</span>'
        });

        await aiModifyHandler(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            modifiedSelection: '<span>Better text</span>',
            message: 'Improved selection'
        }));
    });

    it('should handle non-JSON LLM response (fallback)', async () => {
        mockCallBusinessChatCompletion.mockResolvedValueOnce({
            choices: [{ message: { content: '<p>Raw HTML response</p>' } }]
        });

        const { req, res } = mockReqRes({ content: '<p>CV</p>', instructions: 'rewrite' });

        await aiModifyHandler(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            modifiedContent: '<p>Raw HTML response</p>'
        }));
    });

    it('should strip markdown code blocks from LLM response', async () => {
        mockCallBusinessChatCompletion.mockResolvedValueOnce({
            choices: [{ message: { content: '```json\n{"modifiedContent":"<p>OK</p>","message":"Done"}\n```' } }]
        });

        const { req, res } = mockReqRes({ content: '<p>CV</p>', instructions: 'fix' });

        await aiModifyHandler(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            modifiedContent: '<p>OK</p>'
        }));
    });

    it('should handle LLM error with status code', async () => {
        mockCallBusinessChatCompletion.mockRejectedValueOnce(Object.assign(new Error('Rate limited'), {
            response: { status: 429, data: { error: 'Too many requests' } }
        }));

        const { req, res } = mockReqRes({ content: '<p>CV</p>', instructions: 'fix' });

        await aiModifyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(429);
    });
});
