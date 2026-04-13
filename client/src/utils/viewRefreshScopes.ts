import {
  markAllViewScopesDirty,
  markViewScopesDirty,
  type ViewRefreshScope,
} from './viewRefresh';

function markScopes(scopes: ViewRefreshScope[]): void {
  markViewScopesDirty(scopes);
}

export function markUsersViewDirty(): void {
  markScopes(['users', 'administration']);
}

export function markFirmViewsDirty(): void {
  markAllViewScopesDirty();
}

export function markClientsViewDirty(): void {
  markScopes(['clients', 'deals', 'missions']);
}

export function markDealsViewDirty(): void {
  markScopes(['deals', 'missions', 'resumes', 'adaptations']);
}

export function markMissionsViewDirty(): void {
  markScopes(['missions', 'resumes', 'adaptations']);
}

export function markResumesViewDirty(): void {
  markScopes(['resumes']);
}

export function markResumeDealRelationsDirty(): void {
  markScopes(['deals', 'resumes']);
}

export function markAdaptationsViewDirty(): void {
  markScopes(['adaptations', 'resumes', 'missions']);
}

export function markTemplatesViewDirty(): void {
  markScopes(['templates', 'administration']);
}

export function markEmailTemplatesViewDirty(): void {
  markScopes(['emailTemplates', 'administration']);
}

export function markJobsViewDirty(): void {
  markScopes(['jobs']);
}

export function markTagsViewDirty(): void {
  markScopes(['tags', 'administration']);
}
