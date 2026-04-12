import { useEffect } from 'react';

import {
  consumeDirtyViewScopesForConsumer,
  subscribeToViewRefreshForConsumer,
  type ViewRefreshScope,
} from '../utils/viewRefresh';

interface UseScopedViewRefreshOptions {
  consumerId: string;
  scopes: ViewRefreshScope[];
  onRefresh: (scopes: ViewRefreshScope[]) => void;
  enabled?: boolean;
}

export function useScopedViewRefresh({
  consumerId,
  scopes,
  onRefresh,
  enabled = true,
}: UseScopedViewRefreshOptions): void {
  const scopeKey = scopes.join('|');

  useEffect(() => {
    if (!enabled || scopes.length === 0) {
      return;
    }

    if (!consumeDirtyViewScopesForConsumer(consumerId, scopes)) {
      return;
    }

    onRefresh(scopes);
  }, [consumerId, enabled, onRefresh, scopeKey]);

  useEffect(() => {
    if (!enabled || scopes.length === 0) {
      return;
    }

    return subscribeToViewRefreshForConsumer(consumerId, scopes, onRefresh);
  }, [consumerId, enabled, onRefresh, scopeKey]);
}
