import { invalidateGroupedAdaptationsCache } from './adaptations.service.js';
import { invalidateGroupedMissionsCache } from './missions.service.js';
import { invalidateGroupedResumeViewsCache, invalidateResumeViewCaches } from './resumeStats.service.js';

export async function invalidateGroupedDealViews(firmId = null) {
    await Promise.all([
        invalidateGroupedResumeViewsCache(firmId),
        invalidateGroupedMissionsCache(firmId),
        invalidateGroupedAdaptationsCache(firmId)
    ]);
}

export async function invalidateDashboardAndGroupedViews(firmId = null) {
    await Promise.all([
        invalidateResumeViewCaches(firmId),
        invalidateGroupedMissionsCache(firmId),
        invalidateGroupedAdaptationsCache(firmId)
    ]);
}
