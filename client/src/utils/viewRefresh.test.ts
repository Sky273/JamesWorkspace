import { beforeEach, describe, expect, it } from 'vitest';

import {
  VIEW_REFRESH_EVENT_NAME,
  VIEW_REFRESH_STORAGE_KEY,
  consumeDirtyViewScopesForConsumer,
  getViewRefreshSnapshot,
  markViewScopesDirty,
  recordViewRefreshCycle,
  resetViewRefreshDebugStateForTests,
  subscribeToViewRefreshForConsumer,
} from './viewRefresh';

describe('viewRefresh', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetViewRefreshDebugStateForTests();
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

  it('keeps an observable debug snapshot of marks, deliveries and consumptions', () => {
    const unsubscribe = subscribeToViewRefreshForConsumer('screen-a', ['users'], () => {});

    markViewScopesDirty(['users']);
    expect(consumeDirtyViewScopesForConsumer('screen-b', ['users'])).toBe(true);

    const snapshot = getViewRefreshSnapshot();

    expect(snapshot.counters.marks).toBe(1);
    expect(snapshot.counters.deliveries).toBe(1);
    expect(snapshot.counters.consumes).toBe(1);
    expect(snapshot.scopeCounters.marks.users).toBe(1);
    expect(snapshot.scopeCounters.deliveries.users).toBe(1);
    expect(snapshot.scopeCounters.consumes.users).toBe(1);
    expect(snapshot.scopeCounters.marks.gdprAudit).toBe(1);
    expect(snapshot.recentEvents.map((event) => event.type)).toEqual(['consume', 'deliver', 'mark']);
    expect(snapshot.dirtyScopes.users).toBe(1);

    unsubscribe();
  });

  it('tracks refresh cycle performance globally and per scope', () => {
    recordViewRefreshCycle(['users', 'firms'], 120, false);
    recordViewRefreshCycle(['users'], 80, true);

    const snapshot = getViewRefreshSnapshot();

    expect(snapshot.refreshCycles.total).toBe(2);
    expect(snapshot.refreshCycles.failures).toBe(1);
    expect(snapshot.refreshCycles.maxDurationMs).toBe(120);
    expect(snapshot.refreshCycles.lastDurationMs).toBe(80);
    expect(snapshot.refreshCycles.averageDurationMs).toBe(100);
    expect(snapshot.refreshCycles.byScope.users?.total).toBe(2);
    expect(snapshot.refreshCycles.byScope.users?.failures).toBe(1);
    expect(snapshot.refreshCycles.byScope.firms?.total).toBe(1);
  });
});
