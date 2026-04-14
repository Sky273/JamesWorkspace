import Stripe from 'stripe';

import { ALLOWED_ORIGINS } from './constants.js';
import { normalizeOrigin } from '../utils/originUtils.js';

export const STRIPE_API_VERSION = '2026-02-25.clover';
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'eur').toLowerCase();

const DEFAULT_CREDIT_PACKS = [
    { id: 'starter', name: 'Starter', credits: 250, priceCents: 2900, description: 'Pour les besoins ponctuels du cabinet.' },
    { id: 'growth', name: 'Growth', credits: 750, priceCents: 7900, description: 'Le meilleur rapport volume / prix.' },
    { id: 'scale', name: 'Scale', credits: 2000, priceCents: 19900, description: 'Pour les usages soutenus et les equipes actives.' }
];

let stripeClient = null;

function parseCreditPacks(rawValue) {
    if (!rawValue) {
        return DEFAULT_CREDIT_PACKS;
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return DEFAULT_CREDIT_PACKS;
        }

        const normalized = parsed
            .map((pack) => ({
                id: String(pack?.id || '').trim(),
                name: String(pack?.name || '').trim(),
                credits: Number.parseInt(String(pack?.credits || ''), 10),
                priceCents: Number.parseInt(String(pack?.priceCents || pack?.price_cents || ''), 10),
                description: String(pack?.description || '').trim()
            }))
            .filter((pack) => pack.id && pack.name && Number.isInteger(pack.credits) && pack.credits > 0 && Number.isInteger(pack.priceCents) && pack.priceCents > 0);

        return normalized.length > 0 ? normalized : DEFAULT_CREDIT_PACKS;
    } catch {
        return DEFAULT_CREDIT_PACKS;
    }
}

export const STRIPE_CREDIT_PACKS = parseCreditPacks(process.env.STRIPE_CREDIT_PACKS_JSON);

export function isStripeCheckoutEnabled() {
    return Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
}

export function getStripeClient() {
    if (!STRIPE_SECRET_KEY) {
        throw new Error('Stripe secret key is not configured');
    }

    if (!stripeClient) {
        stripeClient = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: STRIPE_API_VERSION
        });
    }

    return stripeClient;
}

export function getStripeCreditPacks() {
    return STRIPE_CREDIT_PACKS.map((pack) => ({
        ...pack,
        currency: STRIPE_CURRENCY
    }));
}

export function getStripeCreditPack(packId) {
    return getStripeCreditPacks().find((pack) => pack.id === packId) || null;
}

export function resolveStripeAppBaseUrl(req) {
    const configuredBaseUrl = process.env.PUBLIC_APP_URL
        || process.env.APP_URL
        || process.env.FRONTEND_URL
        || process.env.PUBLIC_BASE_URL
        || process.env.VITE_APP_URL
        || '';

    const configuredOrigin = normalizeOrigin(configuredBaseUrl);
    if (configuredOrigin) {
        return configuredOrigin;
    }

    const requestOrigin = normalizeOrigin(req?.headers?.origin);
    if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
        return requestOrigin;
    }

    return '';
}
