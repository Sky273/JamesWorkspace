/**
 * Tests for Email Templates Service
 * Tests CRUD, MJML compilation, keyword substitution, and rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock mjml-core lazy loading
vi.mock('mjml-core', () => ({
    default: {
        default: vi.fn((mjml) => ({
            html: `<html><head></head><body>${mjml}</body></html>`,
            errors: []
        }))
    },
    registerComponent: vi.fn()
}));

vi.mock('mjml-preset-core', () => ({
    default: { components: [] }
}));

import { query } from '../../config/database.js';
import {
    TEMPLATE_KEYWORDS,
    getTemplates,
    getTemplate,
    getDefaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    substituteKeywords,
    renderTemplate,
    getUserFirmId,
    getFirmIdByName,
    destroyMjml
} from '../../services/emailTemplates.service.js';

describe('Email Templates Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // CONSTANTS
    // ============================================

    describe('TEMPLATE_KEYWORDS', () => {
        it('should define keyword categories', () => {
            expect(TEMPLATE_KEYWORDS.client).toContain('name');
            expect(TEMPLATE_KEYWORDS.contact).toContain('firstName');
            expect(TEMPLATE_KEYWORDS.resume).toContain('title');
            expect(TEMPLATE_KEYWORDS.firm).toContain('logo');
            expect(TEMPLATE_KEYWORDS.user).toContain('email');
            expect(TEMPLATE_KEYWORDS.date).toContain('today');
        });
    });

    // ============================================
    // GET TEMPLATES
    // ============================================

    describe('getTemplates', () => {
        it('should return firm templates only for non-admin', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Template 1' }] });

            const result = await getTemplates('f1', false);

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('firm_id = $1');
            expect(query.mock.calls[0][0]).not.toContain('firm_id IS NULL');
        });

        it('should include system templates for admin', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1' }, { id: 't2', is_system: true }] });

            const result = await getTemplates('f1', true);

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][0]).toContain('firm_id IS NULL');
        });

        it('should return all active templates for admin without firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1' }, { id: 't2' }] });

            const result = await getTemplates(null, true);

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][0]).toContain('WHERE status = \'active\'');
            expect(query.mock.calls[0][1]).toEqual([]);
        });
    });

    describe('getTemplate', () => {
        it('should return template by ID', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'My Template', mjml_content: '<mjml>' }] });

            const result = await getTemplate('t1');

            expect(result.name).toBe('My Template');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getTemplate('missing')).toBeNull();
        });
    });

    describe('getDefaultTemplate', () => {
        it('should return firm default template if exists', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', is_default: true }] });

            const result = await getDefaultTemplate('f1');

            expect(result.is_default).toBe(true);
            expect(query).toHaveBeenCalledTimes(1); // no fallback query
        });

        it('should fall back to system default if no firm default', async () => {
            query
                .mockResolvedValueOnce({ rows: [] }) // no firm default
                .mockResolvedValueOnce({ rows: [{ id: 'sys1', is_system: true, is_default: true }] }); // system default

            const result = await getDefaultTemplate('f1');

            expect(result.is_system).toBe(true);
            expect(query).toHaveBeenCalledTimes(2);
        });

        it('should return null if no defaults exist', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            expect(await getDefaultTemplate('f1')).toBeNull();
        });
    });

    // ============================================
    // CREATE
    // ============================================

    describe('createTemplate', () => {
        it('should create template with compiled MJML', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'New' }] }); // insert

            const result = await createTemplate('f1', {
                name: 'New', description: 'Desc',
                subjectTemplate: 'Subject {{client.name}}',
                mjmlContent: '<mjml><mj-body></mj-body></mjml>'
            }, 'u1');

            expect(result.name).toBe('New');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO email_templates');
        });

        it('should unset other defaults when creating as default', async () => {
            query
                .mockResolvedValueOnce({ rows: [] }) // unset defaults
                .mockResolvedValueOnce({ rows: [{ id: 't1' }] }); // insert

            await createTemplate('f1', {
                name: 'Default', subjectTemplate: 'S', mjmlContent: '<mjml></mjml>',
                isDefault: true
            }, 'u1');

            expect(query).toHaveBeenCalledTimes(2);
            expect(query.mock.calls[0][0]).toContain('is_default = false');
        });
    });

    // ============================================
    // UPDATE
    // ============================================

    describe('updateTemplate', () => {
        it('should update non-system template', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 't1', is_system: false, firm_id: 'f1' }] }) // getTemplate
                .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Updated' }] }); // update

            const result = await updateTemplate('t1', {
                name: 'Updated', subjectTemplate: 'S', mjmlContent: '<mjml></mjml>'
            });

            expect(result.name).toBe('Updated');
        });

        it('should throw if template not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(updateTemplate('missing', { name: 'X' })).rejects.toThrow('Template not found');
        });

        it('should throw if system template', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', is_system: true }] });
            await expect(updateTemplate('t1', { name: 'X' })).rejects.toThrow('Cannot modify system template');
        });

        it('should unset other defaults when setting as default', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 't1', is_system: false, firm_id: 'f1' }] }) // getTemplate
                .mockResolvedValueOnce({ rows: [] }) // unset defaults
                .mockResolvedValueOnce({ rows: [{ id: 't1' }] }); // update

            await updateTemplate('t1', {
                name: 'T', subjectTemplate: 'S', mjmlContent: '<mjml></mjml>', isDefault: true
            });

            expect(query.mock.calls[1][0]).toContain('is_default = false');
        });
    });

    // ============================================
    // DELETE
    // ============================================

    describe('deleteTemplate', () => {
        it('should delete non-system template', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 't1', is_system: false }] })
                .mockResolvedValueOnce({ rows: [] });

            expect(await deleteTemplate('t1')).toBe(true);
        });

        it('should throw if template not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(deleteTemplate('missing')).rejects.toThrow('Template not found');
        });

        it('should throw if system template and not admin', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', is_system: true }] });
            await expect(deleteTemplate('t1')).rejects.toThrow('Cannot delete system template');
        });

        it('should allow admin to delete system template', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 't1', is_system: true }] })
                .mockResolvedValueOnce({ rows: [] });

            expect(await deleteTemplate('t1', { isAdmin: true })).toBe(true);
        });
    });

    // ============================================
    // DUPLICATE
    // ============================================

    describe('duplicateTemplate', () => {
        it('should duplicate template with "(copie)" suffix', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Original', mjml_content: '<mjml>', html_content: '<html>' }] })
                .mockResolvedValueOnce({ rows: [{ id: 't2', name: 'Original (copie)' }] });

            const result = await duplicateTemplate('t1', 'f1', 'u1');

            expect(result.name).toBe('Original (copie)');
            expect(query.mock.calls[1][1][1]).toBe('Original (copie)');
        });

        it('should throw if original not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(duplicateTemplate('missing', 'f1', 'u1')).rejects.toThrow('Template not found');
        });
    });

    // ============================================
    // KEYWORD SUBSTITUTION
    // ============================================

    describe('substituteKeywords', () => {
        it('should replace all keywords', () => {
            const result = substituteKeywords(
                'Hello {{contact.name}} from {{firm.name}}',
                {
                    contact: { name: 'John Doe' },
                    firm: { name: 'Acme' }
                }
            );

            expect(result).toBe('Hello John Doe from Acme');
        });

        it('should extract firstName from full name', () => {
            const result = substituteKeywords(
                'Bonjour {{contact.firstName}}',
                { contact: { name: 'Jean Pierre Dupont' } }
            );

            expect(result).toBe('Bonjour Jean');
        });

        it('should handle missing context with empty strings', () => {
            const result = substituteKeywords(
                '{{client.name}} {{contact.name}}',
                {}
            );

            expect(result).toBe(' ');
        });

        it('should format client type', () => {
            const clientResult = substituteKeywords('{{client.type}}', { client: { type: 'client' } });
            expect(clientResult).toBe('Client');

            const prospectResult = substituteKeywords('{{client.type}}', { client: { type: 'prospect' } });
            expect(prospectResult).toBe('Prospect');
        });

        it('should substitute date keywords', () => {
            const result = substituteKeywords('{{date.today}} {{date.todayLong}}', {});

            // Should contain date-like strings
            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // DD/MM/YYYY
            expect(result).toMatch(/\d+ \w+ \d{4}/); // D month YYYY
        });

        it('should make relative logo URLs absolute', () => {
            process.env.FRONTEND_URL = 'http://localhost:5173';
            const result = substituteKeywords('{{firm.logo}}', { firm: { logo: '/logos/acme.png' } });
            expect(result).toBe('http://localhost:5173/logos/acme.png');
        });

        it('should keep absolute logo URLs as-is', () => {
            const result = substituteKeywords('{{firm.logo}}', { firm: { logo: 'https://cdn.example.com/logo.png' } });
            expect(result).toBe('https://cdn.example.com/logo.png');
        });
    });

    // ============================================
    // RENDER
    // ============================================

    describe('renderTemplate', () => {
        it('should render template with context', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 't1', subject_template: 'CV de {{resume.name}}',
                    html_content: '<p>{{contact.name}}</p>', mjml_content: '<mjml>'
                }]
            });

            const result = await renderTemplate('t1', {
                resume: { name: 'Marie' },
                contact: { name: 'Jean' }
            });

            expect(result.subject).toBe('CV de Marie');
            expect(result.html).toContain('Jean');
        });

        it('should compile MJML if no html_content', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 't1', subject_template: 'S',
                    html_content: null, mjml_content: '<mjml><mj-body></mj-body></mjml>'
                }]
            });

            const result = await renderTemplate('t1', {});

            expect(result.html).toBeDefined();
        });

        it('should throw if template not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(renderTemplate('missing', {})).rejects.toThrow('Template not found');
        });
    });

    // ============================================
    // ACCESS HELPERS
    // ============================================

    describe('getUserFirmId', () => {
        it('should return firm_id for user', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await getUserFirmId('u1')).toBe('f1');
        });

        it('should return null if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getUserFirmId('missing')).toBeNull();
        });
    });

    describe('getFirmIdByName', () => {
        it('should return firm id by name', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1' }] });
            expect(await getFirmIdByName('Acme')).toBe('f1');
        });

        it('should return null if firm not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getFirmIdByName('Unknown')).toBeNull();
        });
    });

    // ============================================
    // CLEANUP
    // ============================================

    describe('destroyMjml', () => {
        it('should not throw', () => {
            expect(() => destroyMjml()).not.toThrow();
        });
    });
});
