import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAuthOptionsWithCsrf = vi.fn();
const mockFetchWithCsrfRetry = vi.fn();
const mockGetResponseErrorMessage = vi.fn();

vi.mock('./apiInterceptor', () => ({
    fetchWithAuth: vi.fn(),
    createAuthOptions: vi.fn(),
    createAuthOptionsWithCsrf: (...args: unknown[]) => mockCreateAuthOptionsWithCsrf(...args),
    authPost: vi.fn(),
    authPut: vi.fn(),
    authDelete: vi.fn(),
    fetchWithCsrfRetry: (...args: unknown[]) => mockFetchWithCsrfRetry(...args),
    getResponseErrorMessage: (...args: unknown[]) => mockGetResponseErrorMessage(...args)
}));

vi.mock('./logger.frontend', () => ({
    default: {
        error: vi.fn()
    }
}));

describe('templateService.extractFromCV', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateAuthOptionsWithCsrf.mockResolvedValue({
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: new FormData()
        });
    });

    it('parses a valid JSON extraction response', async () => {
        const { templateService } = await import('./templateService');
        const responsePayload = {
            success: true,
            model: 'gpt-test',
            template: {
                name: 'Template',
                description: '',
                headerContent: '',
                templateContent: '<main></main>',
                footerContent: '',
                stylesheet: '',
                footerHeight: 25,
                tags: []
            }
        };

        mockFetchWithCsrfRetry.mockResolvedValue(
            new Response(JSON.stringify(responsePayload), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );

        const result = await templateService.extractFromCV(
            new File(['pdf'], 'template.pdf', { type: 'application/pdf' })
        );

        expect(result).toEqual(responsePayload);
        expect(mockCreateAuthOptionsWithCsrf).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                headers: { Accept: 'application/json' }
            })
        );
    });

    it('surfaces a clear error when the server returns HTML instead of JSON', async () => {
        const { templateService } = await import('./templateService');
        mockGetResponseErrorMessage.mockResolvedValue('Le serveur a retourne une page d\'erreur (500 Internal Server Error).');
        mockFetchWithCsrfRetry.mockResolvedValue(
            new Response('<!DOCTYPE html><html><body>error</body></html>', {
                status: 500,
                headers: { 'Content-Type': 'text/html' }
            })
        );

        await expect(
            templateService.extractFromCV(new File(['pdf'], 'template.pdf', { type: 'application/pdf' }))
        ).rejects.toThrow('Le serveur a retourne une page d\'erreur (500 Internal Server Error).');
    });

    it('surfaces a clear error when a successful response is not JSON', async () => {
        const { templateService } = await import('./templateService');
        mockGetResponseErrorMessage.mockResolvedValue('Le serveur a retourne une page d\'erreur (200 OK).');
        mockFetchWithCsrfRetry.mockResolvedValue(
            new Response('<!DOCTYPE html><html><body>ok-but-html</body></html>', {
                status: 200,
                headers: { 'Content-Type': 'text/html' }
            })
        );

        await expect(
            templateService.extractFromCV(new File(['pdf'], 'template.pdf', { type: 'application/pdf' }))
        ).rejects.toThrow('Le serveur a retourne une page d\'erreur (200 OK).');
    });
});
