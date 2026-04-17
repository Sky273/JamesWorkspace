import { useCallback, useEffect, useRef } from 'react';

import {
  consumeDirtyViewScopesForConsumer,
  recordViewRefreshCycle,
  subscribeToViewRefreshForConsumer,
  type ViewRefreshScope,
} from '../utils/viewRefresh';

interface UseScopedViewRefreshOptions {
  consumerId: string;
  scopes: ViewRefreshScope[];
  onRefresh: (scopes: ViewRefreshScope[]) => void | Promise<void>;
  enabled?: boolean;
}

export function useScopedViewRefresh({
  consumerId,
  scopes,
  onRefresh,
  enabled = true,
}: UseScopedViewRefreshOptions): void {
  const scopeKey = scopes.join('|');
  const stableScopesRef = useRef(scopes);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    stableScopesRef.current = scopes;
  }, [scopeKey, scopes]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const runRefresh = useCallback((matchedScopes: ViewRefreshScope[]) => {
    const startedAt = performance.now();

    try {
      const result = onRefreshRef.current(matchedScopes);
      void Promise.resolve(result).then(
        () => recordViewRefreshCycle(matchedScopes, performance.now() - startedAt, false),
        () => recordViewRefreshCycle(matchedScopes, performance.now() - startedAt, true),
      );
    } catch (error) {
      recordViewRefreshCycle(matchedScopes, performance.now() - startedAt, true);
      throw error;
    }
  }, []);

  useEffect(() => {
    const stableScopes = stableScopesRef.current;
    if (!enabled || stableScopes.length === 0) {
      return;
    }

    if (!consumeDirtyViewScopesForConsumer(consumerId, stableScopes)) {
      return;
    }

    runRefresh(stableScopes);
  }, [consumerId, enabled, runRefresh, scopeKey]);

  useEffect(() => {
    const stableScopes = stableScopesRef.current;
    if (!enabled || stableScopes.length === 0) {
      return;
    }

    return subscribeToViewRefreshForConsumer(consumerId, stableScopes, runRefresh);
  }, [consumerId, enabled, runRefresh, scopeKey]);
}
