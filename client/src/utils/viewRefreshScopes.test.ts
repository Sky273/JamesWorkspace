import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMarkAllViewScopesDirty = vi.fn();
const mockMarkViewScopesDirty = vi.fn();

vi.mock('./viewRefresh', () => ({
  markAllViewScopesDirty: () => mockMarkAllViewScopesDirty(),
  markViewScopesDirty: (scopes: string[]) => mockMarkViewScopesDirty(scopes),
}));

describe('viewRefreshScopes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the expected scopes for client mutations', async () => {
    const { markClientsViewDirty } = await import('./viewRefreshScopes');

    markClientsViewDirty();

    expect(mockMarkViewScopesDirty).toHaveBeenCalledWith(['clients', 'deals', 'missions']);
  });

  it('marks all scopes for firm mutations', async () => {
    const { markFirmViewsDirty } = await import('./viewRefreshScopes');

    markFirmViewsDirty();

    expect(mockMarkAllViewScopesDirty).toHaveBeenCalledTimes(1);
  });

  it('marks the expected scopes for resume/deal relations', async () => {
    const { markResumeDealRelationsDirty } = await import('./viewRefreshScopes');

    markResumeDealRelationsDirty();

    expect(mockMarkViewScopesDirty).toHaveBeenCalledWith(['deals', 'resumes']);
  });

  it('marks administration alongside admin workspace domains', async () => {
    const {
      markUsersViewDirty,
      markTemplatesViewDirty,
      markTagsViewDirty,
      markEmailTemplatesViewDirty,
    } = await import('./viewRefreshScopes');

    markUsersViewDirty();
    markTemplatesViewDirty();
    markTagsViewDirty();
    markEmailTemplatesViewDirty();

    expect(mockMarkViewScopesDirty).toHaveBeenCalledWith(['users', 'administration']);
    expect(mockMarkViewScopesDirty).toHaveBeenCalledWith(['templates', 'administration']);
    expect(mockMarkViewScopesDirty).toHaveBeenCalledWith(['tags', 'administration']);
    expect(mockMarkViewScopesDirty).toHaveBeenCalledWith(['emailTemplates', 'administration']);
  });
});
