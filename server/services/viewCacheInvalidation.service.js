import { invalidateGroupedAdaptationsCache } from './adaptations.service.js';
import { invalidateGroupedMissionsCache } from './missions.service.js';
import { invalidateResumeViewCaches } from './resumeStats.service.js';

export async function invalidateDashboardAndGroupedViews(firmId = null) {
    await Promise.all([
        invalidateResumeViewCaches(firmId),
        invalidateGroupedMissionsCache(firmId),
        invalidateGroupedAdaptationsCache(firmId)
    ]);
}
