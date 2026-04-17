import { invalidateDashboardAndGroupedViews } from './viewCacheInvalidation.service.js';
import {
    invalidateClientsCaches,
    invalidateDealsCaches,
    invalidateResumesCaches
} from './cache.service.js';

export async function invalidateResumeMutationViews(resumeId, firmId = null) {
    await Promise.all([
        invalidateDashboardAndGroupedViews(firmId),
        invalidateResumesCaches(`detail:${resumeId}`),
        invalidateClientsCaches(),
        invalidateDealsCaches()
    ]);
}

export async function invalidateResumeCollectionViews(firmId = null) {
    await Promise.all([
        invalidateDashboardAndGroupedViews(firmId),
        invalidateResumesCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches()
    ]);
}

export async function invalidateResumeMutationViewsForRows(rows = []) {
    const firmIds = [...new Set(rows.map((row) => row?.firm_id).filter(Boolean))];
    await Promise.all(firmIds.flatMap((firmId) => [
        invalidateDashboardAndGroupedViews(firmId),
        invalidateResumesCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches()
    ]));
}
