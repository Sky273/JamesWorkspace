import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetClient = vi.fn();
const mockQuery = vi.fn();
const mockGetStripeClient = vi.fn();
const mockGetStripeCreditPack = vi.fn();
const mockGetStripeCreditPacks = vi.fn();
const mockIsStripeCheckoutEnabled = vi.fn();
const mockResolveStripeAppBaseUrl = vi.fn();
const mockAddFirmCreditsTransaction = vi.fn();
const mockInvalidateFirmsCaches = vi.fn();
const mockInvalidateClientsCaches = vi.fn();
const mockInvalidateDealsCaches = vi.fn();
const mockInvalidateMissionsCaches = vi.fn();

vi.mock('../../config/database.js', () => ({
    getClient: (...args) => mockGetClient(...args),
    query: (...args) => mockQuery(...args)
}));

vi.mock('../../config/stripe.js', () => ({
    getStripeClient: (...args) => mockGetStripeClient(...args),
    getStripeCreditPack: (...args) => mockGetStripeCreditPack(...args),
    getStripeCreditPacks: (...args) => mockGetStripeCreditPacks(...args),
    isStripeCheckoutEnabled: (...args) => mockIsStripeCheckoutEnabled(...args),
    resolveStripeAppBaseUrl: (...args) => mockResolveStripeAppBaseUrl(...args),
    STRIPE_CURRENCY: 'eur',
    STRIPE_WEBHOOK_SECRET: 'whsec_test'
}));

vi.mock('../../services/aiCredits.service.js', () => ({
    addFirmCreditsTransaction: (...args) => mockAddFirmCreditsTransaction(...args)
}));

vi.mock('../../services/cache.service.js', () => ({
    invalidateFirmsCaches: (...args) => mockInvalidateFirmsCaches(...args),
    invalidateClientsCaches: (...args) => mockInvalidateClientsCaches(...args),
    invalidateDealsCaches: (...args) => mockInvalidateDealsCaches(...args),
    invalidateMissionsCaches: (...args) => mockInvalidateMissionsCaches(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    createStripeCheckoutSession,
    fulfillStripeCheckoutSession,
    listStripeCreditPacks
} from '../../services/stripeBilling.service.js';

describe('stripeBilling.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsStripeCheckoutEnabled.mockReturnValue(true);
        mockGetStripeCreditPacks.mockReturnValue([{ id: 'starter', credits: 250, priceCents: 2900, currency: 'eur' }]);
        mockGetStripeCreditPack.mockReturnValue({
            id: 'starter',
            name: 'Starter',
            credits: 250,
            priceCents: 2900,
            description: 'Pack',
            currency: 'eur'
        });
        mockResolveStripeAppBaseUrl.mockReturnValue('http://localhost:5173');
        mockAddFirmCreditsTransaction.mockResolvedValue({ firm: { id: 'firm-1', credits: 1250 } });
        mockInvalidateFirmsCaches.mockResolvedValue(undefined);
        mockInvalidateClientsCaches.mockResolvedValue(undefined);
        mockInvalidateDealsCaches.mockResolvedValue(undefined);
        mockInvalidateMissionsCaches.mockResolvedValue(undefined);
    });

    it('lists configured credit packs', () => {
        const result = listStripeCreditPacks();

        expect(result.enabled).toBe(true);
        expect(result.packs).toHaveLength(1);
    });

    it('creates a checkout session and persists the purchase', async () => {
        const client = {
            query: vi.fn()
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ rows: [{ id: 'purchase-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce(undefined),
            release: vi.fn()
        };
        mockGetClient.mockResolvedValue(client);
        mockGetStripeClient.mockReturnValue({
            checkout: {
                sessions: {
                    create: vi.fn().mockResolvedValue({
                        id: 'cs_test_123',
                        url: 'https://checkout.stripe.test/session'
                    })
                }
            }
        });

        const result = await createStripeCheckoutSession({
            user: {
                id: 'user-1',
                email: 'local-admin@example.com',
                firmId: 'firm-1'
            },
            packId: 'starter',
            origin: 'http://localhost:5173'
        });

        expect(result.url).toContain('stripe.test');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firm_credit_purchases'), expect.any(Array));
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE firm_credit_purchases'), ['cs_test_123', 'https://checkout.stripe.test/session', 'purchase-1']);
    });

    it('fulfills a paid checkout session exactly once', async () => {
        const client = {
            query: vi.fn()
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'purchase-1',
                        status: 'pending',
                        firm_id: 'firm-1',
                        user_id: 'user-1',
                        credits: 250,
                        amount_cents: 2900,
                        currency: 'eur',
                        metadata: { source: 'stripe.checkout' }
                    }]
                })
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'purchase-1',
                        status: 'completed'
                    }]
                })
                .mockResolvedValueOnce(undefined),
            release: vi.fn()
        };
        mockGetClient.mockResolvedValue(client);

        const result = await fulfillStripeCheckoutSession({
            id: 'cs_test_123',
            payment_status: 'paid',
            payment_intent: 'pi_123',
            customer_details: { email: 'local-admin@example.com' },
            metadata: { purchaseId: 'purchase-1' }
        });

        expect(mockAddFirmCreditsTransaction).toHaveBeenCalledWith(expect.objectContaining({
            firmId: 'firm-1',
            amount: 250,
            userId: 'user-1',
            actionType: 'firm.credit_purchase',
            client
        }));
        expect(result.status).toBe('completed');
    });
});
