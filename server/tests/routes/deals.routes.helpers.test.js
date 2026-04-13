import { describe, expect, it } from 'vitest';
import { normalizeDealPayload } from '../../routes/deals.routes.helpers.js';

describe('deals.routes.helpers', () => {
    describe('normalizeDealPayload', () => {
        it('keeps only provided alias fields on partial updates', () => {
            const result = normalizeDealPayload({ title: 'Updated title' });

            expect(result).toEqual({ title: 'Updated title' });
            expect(Object.prototype.hasOwnProperty.call(result, 'status')).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(result, 'priority')).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(result, 'client_id')).toBe(false);
        });

        it('maps camelCase relation and date fields to snake_case equivalents', () => {
            const result = normalizeDealPayload({
                clientId: 'client-1',
                contactId: 'contact-1',
                expectedStartDate: '2026-04-12',
                expectedEndDate: '2026-04-20',
                budgetMin: 1000,
                budgetMax: 2000
            });

            expect(result).toMatchObject({
                clientId: 'client-1',
                contactId: 'contact-1',
                expectedStartDate: '2026-04-12',
                expectedEndDate: '2026-04-20',
                budgetMin: 1000,
                budgetMax: 2000,
                client_id: 'client-1',
                contact_id: 'contact-1',
                expected_start_date: '2026-04-12',
                expected_end_date: '2026-04-20',
                budget_min: 1000,
                budget_max: 2000
            });
        });
    });
});
