import { beforeEach, describe, expect, it } from 'vitest';

import {
  VIEW_REFRESH_EVENT_NAME,
  VIEW_REFRESH_STORAGE_KEY,
  consumeDirtyViewScopesForConsumer,
  markViewScopesDirty,
  subscribeToViewRefreshForConsumer,
} from './viewRefresh';

describe('viewRefresh', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('tracks dirty scopes independently per consumer', () => {
    markViewScopesDirty(['firms']);

    expect(consumeDirtyViewScopesForConsumer('screen-a', ['firms'])).toBe(true);
    expect(consumeDirtyViewScopesForConsumer('screen-b', ['firms'])).toBe(true);
    expect(consumeDirtyViewScopesForConsumer('screen-a', ['firms'])).toBe(false);
  });

  it('acknowledges runtime events without losing the dirty signal for other consumers', () => {
    const receivedScopes: string[][] = [];
    const unsubscribe = subscribeToViewRefreshForConsumer('screen-a', ['users'], (scopes) => {
      receivedScopes.push(scopes);
    });

    markViewScopesDirty(['users']);

    expect(receivedScopes).toEqual([['users']]);
    expect(consumeDirtyViewScopesForConsumer('screen-a', ['users'])).toBe(false);
    expect(consumeDirtyViewScopesForConsumer('screen-b', ['users'])).toBe(true);

    unsubscribe();
  });

  it('keeps the dirty scope versions in session storage', () => {
    markViewScopesDirty(['templates']);

    expect(window.sessionStorage.getItem(VIEW_REFRESH_STORAGE_KEY)).toContain('templates');
    expect(VIEW_REFRESH_EVENT_NAME).toBe('app:view-refresh');
  });

  it('propagates derived scopes without losing the original dirty scope', () => {
    markViewScopesDirty(['users']);

    expect(consumeDirtyViewScopesForConsumer('users-screen', ['users'])).toBe(true);
    expect(consumeDirtyViewScopesForConsumer('gdpr-screen', ['gdprAudit'])).toBe(true);
    expect(consumeDirtyViewScopesForConsumer('users-screen', ['users'])).toBe(false);
    expect(consumeDirtyViewScopesForConsumer('gdpr-screen', ['gdprAudit'])).toBe(false);
  });
});
