import { useEffect } from 'react';

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

  const runRefresh = (matchedScopes: ViewRefreshScope[]) => {
    const startedAt = performance.now();

    try {
      const result = onRefresh(matchedScopes);
      void Promise.resolve(result).then(
        () => recordViewRefreshCycle(matchedScopes, performance.now() - startedAt, false),
        () => recordViewRefreshCycle(matchedScopes, performance.now() - startedAt, true),
      );
    } catch (error) {
      recordViewRefreshCycle(matchedScopes, performance.now() - startedAt, true);
      throw error;
    }
  };

  useEffect(() => {
    if (!enabled || scopes.length === 0) {
      return;
    }

    if (!consumeDirtyViewScopesForConsumer(consumerId, scopes)) {
      return;
    }

    runRefresh(scopes);
  }, [consumerId, enabled, onRefresh, scopeKey]);

  useEffect(() => {
    if (!enabled || scopes.length === 0) {
      return;
    }

    return subscribeToViewRefreshForConsumer(consumerId, scopes, runRefresh);
  }, [consumerId, enabled, onRefresh, scopeKey]);
}
