import { describe, expect, it } from 'vitest';
import { normalizeClientPayload, normalizeContactPayload } from '../../routes/clients.routes.helpers.js';
import { normalizeDealPayload } from '../../routes/deals.routes.helpers.js';
import { normalizeMissionPayload } from '../../routes/missions.routes.helpers.js';

describe('request text normalization helpers', () => {
    it('repairs mojibake in CRM payload free-text fields', () => {
        expect(normalizeClientPayload({
            name: 'Soci\u00c3\u00a9t\u00c3\u00a9 QA',
            industry: 'Conseil num\u00c3\u00a9rique',
            notes: 'Cr\u00c3\u00a9\u00c3\u00a9e depuis API'
        })).toEqual(expect.objectContaining({
            name: 'Société QA',
            industry: 'Conseil numérique',
            notes: 'Créée depuis API'
        }));

        expect(normalizeContactPayload({
            name: 'Jos\u00c3\u00a9 Martin',
            role: 'Responsable qualit\u00c3\u00a9'
        })).toEqual(expect.objectContaining({
            name: 'José Martin',
            role: 'Responsable qualité'
        }));
    });

    it('repairs mojibake in deal and mission free-text fields', () => {
        expect(normalizeDealPayload({
            title: 'Affaire cr\u00c3\u00a9\u00c3\u00a9e',
            description: 'Description modifi\u00c3\u00a9e',
            notes: 'Notes apr\u00c3\u00a8s traitement',
            tags: ['qualit\u00c3\u00a9']
        })).toEqual(expect.objectContaining({
            title: 'Affaire créée',
            description: 'Description modifiée',
            notes: 'Notes après traitement',
            tags: ['qualité']
        }));

        expect(normalizeMissionPayload({
            title: 'Mission cr\u00c3\u00a9\u00c3\u00a9e',
            content: '<p>Contenu modifi\u00c3\u00a9</p>',
            requiredSkills: ['S\u00c3\u00a9curit\u00c3\u00a9']
        })).toEqual(expect.objectContaining({
            title: 'Mission créée',
            content: '<p>Contenu modifié</p>',
            requiredSkills: ['Sécurité']
        }));
    });
});
