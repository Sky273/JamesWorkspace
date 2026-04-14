import { getClient, query } from '../config/database.js';
import {
    getStripeClient,
    getStripeCreditPack,
    getStripeCreditPacks,
    isStripeCheckoutEnabled,
    resolveStripeAppBaseUrl,
    STRIPE_CURRENCY,
    STRIPE_WEBHOOK_SECRET
} from '../config/stripe.js';
import { addFirmCreditsTransaction } from './aiCredits.service.js';
import {
    invalidateClientsCaches,
    invalidateDealsCaches,
    invalidateFirmsCaches,
    invalidateMissionsCaches
} from './cache.service.js';
import { safeLog } from '../utils/logger.backend.js';

function buildConfigurationError(message) {
    const error = new Error(message);
    error.statusCode = 503;
    return error;
}

function buildValidationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function buildAuthorizationError(message) {
    const error = new Error(message);
    error.statusCode = 403;
    return error;
}

function normalizeMetadata(metadata = {}) {
    return metadata && typeof metadata === 'object' ? metadata : {};
}

export function listStripeCreditPacks() {
    return {
        enabled: isStripeCheckoutEnabled(),
        currency: STRIPE_CURRENCY,
        packs: getStripeCreditPacks()
    };
}

export async function createStripeCheckoutSession({
    user,
    packId,
    origin
}) {
    if (!isStripeCheckoutEnabled()) {
        throw buildConfigurationError('Stripe checkout is not configured');
    }

    if (!user?.id || !user?.firmId) {
        throw buildAuthorizationError('Local admin firm association is required');
    }

    const pack = getStripeCreditPack(packId);
    if (!pack) {
        throw buildValidationError('Unknown credit pack');
    }

    const baseUrl = resolveStripeAppBaseUrl({ headers: { origin } });
    if (!baseUrl) {
        throw buildConfigurationError('Application base URL is not configured for Stripe redirects');
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const purchaseResult = await client.query(
            `INSERT INTO firm_credit_purchases (
                firm_id,
                user_id,
                pack_id,
                credits,
                amount_cents,
                currency,
                status,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7::jsonb)
            RETURNING *`,
            [
                user.firmId,
                user.id,
                pack.id,
                pack.credits,
                pack.priceCents,
                pack.currency,
                JSON.stringify({
                    source: 'stripe.checkout',
                    packName: pack.name
                })
            ]
        );

        const purchase = purchaseResult.rows[0];

        const stripe = getStripeClient();
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            success_url: `${baseUrl}/admin?tab=firmCredits&stripe=success`,
            cancel_url: `${baseUrl}/admin?tab=firmCredits&stripe=cancel`,
            client_reference_id: purchase.id,
            customer_email: user.email || undefined,
            locale: 'fr',
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: pack.currency,
                    unit_amount: pack.priceCents,
                    product_data: {
                        name: `${pack.name} credits`,
                        description: `${pack.credits} credits IA pour votre cabinet`
                    }
                }
            }],
            metadata: {
                purchaseId: purchase.id,
                firmId: user.firmId,
                userId: user.id,
                packId: pack.id,
                credits: String(pack.credits)
            },
            payment_intent_data: {
                metadata: {
                    purchaseId: purchase.id,
                    firmId: user.firmId,
                    userId: user.id,
                    packId: pack.id,
                    credits: String(pack.credits)
                }
            }
        });

        await client.query(
            `UPDATE firm_credit_purchases
             SET stripe_checkout_session_id = $1,
                 checkout_url = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [session.id, session.url || null, purchase.id]
        );

        await client.query('COMMIT');

        return {
            id: purchase.id,
            url: session.url
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function markPurchaseStatusBySessionId(sessionId, status) {
    if (!sessionId) {
        return null;
    }

    const result = await query(
        `UPDATE firm_credit_purchases
         SET status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE stripe_checkout_session_id = $2
         RETURNING *`,
        [status, sessionId]
    );

    return result.rows[0] || null;
}

export async function fulfillStripeCheckoutSession(session) {
    const purchaseId = session?.metadata?.purchaseId || session?.client_reference_id || null;
    if (!purchaseId) {
        safeLog('warn', 'Stripe checkout session missing purchase identifier', {
            sessionId: session?.id || null
        });
        return null;
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const purchaseResult = await client.query(
            'SELECT * FROM firm_credit_purchases WHERE id = $1 FOR UPDATE',
            [purchaseId]
        );

        if (purchaseResult.rows.length === 0) {
            await client.query('ROLLBACK');
            safeLog('warn', 'Stripe purchase not found during fulfillment', {
                purchaseId,
                sessionId: session?.id || null
            });
            return null;
        }

        const purchase = purchaseResult.rows[0];
        if (purchase.status === 'completed') {
            await client.query('COMMIT');
            return purchase;
        }

        if (session.payment_status !== 'paid') {
            await client.query('COMMIT');
            return purchase;
        }

        await addFirmCreditsTransaction({
            firmId: purchase.firm_id,
            amount: Number(purchase.credits),
            userId: purchase.user_id,
            actionType: 'firm.credit_purchase',
            client,
            metadata: {
                purchaseId: purchase.id,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent || null,
                amountCents: purchase.amount_cents,
                currency: purchase.currency,
                ...normalizeMetadata(purchase.metadata)
            }
        });

        const updateResult = await client.query(
            `UPDATE firm_credit_purchases
             SET status = 'completed',
                 stripe_checkout_session_id = COALESCE($1, stripe_checkout_session_id),
                 stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
                 stripe_customer_email = COALESCE($3, stripe_customer_email),
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [
                session.id || null,
                session.payment_intent || null,
                session.customer_details?.email || session.customer_email || null,
                purchase.id
            ]
        );

        await client.query('COMMIT');
        await Promise.all([
            invalidateFirmsCaches(),
            invalidateClientsCaches(),
            invalidateDealsCaches(),
            invalidateMissionsCaches()
        ]);
        return updateResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function handleStripeWebhook(rawBody, signature) {
    if (!isStripeCheckoutEnabled()) {
        throw buildConfigurationError('Stripe webhook is not configured');
    }

    if (!signature) {
        throw buildValidationError('Stripe signature is required');
    }

    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
        case 'checkout.session.completed':
            await fulfillStripeCheckoutSession(event.data.object);
            break;
        case 'checkout.session.expired':
            await markPurchaseStatusBySessionId(event.data.object?.id, 'expired');
            break;
        case 'checkout.session.async_payment_failed':
            await markPurchaseStatusBySessionId(event.data.object?.id, 'failed');
            break;
        default:
            break;
    }

    return event;
}
