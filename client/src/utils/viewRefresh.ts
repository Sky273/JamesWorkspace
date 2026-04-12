import logger from './logger.frontend';

export const VIEW_REFRESH_STORAGE_KEY = 'appDirtyViewScopes';
export const VIEW_REFRESH_EVENT_NAME = 'app:view-refresh';
export const VIEW_REFRESH_CONSUMER_STORAGE_PREFIX = 'appDirtyViewScopesSeen:';

export const VIEW_REFRESH_SCOPES = [
  'users',
  'firms',
  'clients',
  'deals',
  'missions',
  'resumes',
  'adaptations',
  'templates',
  'jobs',
  'gdprAudit',
  'marketFacts',
  'marketTrends',
  'rome',
  'tags',
] as const;

export type ViewRefreshScope = typeof VIEW_REFRESH_SCOPES[number];
type ViewRefreshVersionMap = Partial<Record<ViewRefreshScope, number>>;
type ViewRefreshEventDetail = { scopes: ViewRefreshScope[]; versions: ViewRefreshVersionMap };
const viewRefreshDebugEnabled = import.meta.env.VITE_DEBUG_VIEW_REFRESH === '1';
const VIEW_REFRESH_EVENT_HISTORY_LIMIT = 25;

type ViewRefreshDebugEvent = {
  type: 'mark' | 'consume' | 'deliver';
  consumerId?: string;
  scopes: ViewRefreshScope[];
  at: string;
};

type ViewRefreshDebugSnapshot = {
  dirtyScopes: ViewRefreshVersionMap;
  counters: {
    marks: number;
    consumes: number;
    deliveries: number;
  };
  scopeCounters: {
    marks: ViewRefreshVersionMap;
    consumes: ViewRefreshVersionMap;
    deliveries: ViewRefreshVersionMap;
  };
  recentEvents: ViewRefreshDebugEvent[];
};

const viewRefreshDebugState: ViewRefreshDebugSnapshot = {
  dirtyScopes: {},
  counters: {
    marks: 0,
    consumes: 0,
    deliveries: 0,
  },
  scopeCounters: {
    marks: {},
    consumes: {},
    deliveries: {},
  },
  recentEvents: [],
};

const VIEW_REFRESH_DERIVED_SCOPES: Partial<Record<ViewRefreshScope, ViewRefreshScope[]>> = {
  users: ['gdprAudit'],
  firms: ['gdprAudit'],
  clients: ['gdprAudit'],
  deals: ['gdprAudit'],
  missions: ['gdprAudit'],
  resumes: ['gdprAudit'],
  adaptations: ['gdprAudit'],
  templates: ['gdprAudit'],
  tags: ['gdprAudit'],
};

function readDirtyScopes(): ViewRefreshVersionMap {
  if (typeof window === 'undefined') {
    return {};
  }

  const rawValue = window.sessionStorage.getItem(VIEW_REFRESH_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<ViewRefreshVersionMap>((accumulator, [scope, version]) => {
      if (
        typeof scope === 'string'
        && VIEW_REFRESH_SCOPES.includes(scope as ViewRefreshScope)
        && typeof version === 'number'
        && Number.isFinite(version)
      ) {
        accumulator[scope as ViewRefreshScope] = version;
      }
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

function writeDirtyScopes(scopes: ViewRefreshVersionMap): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (Object.keys(scopes).length === 0) {
    window.sessionStorage.removeItem(VIEW_REFRESH_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(VIEW_REFRESH_STORAGE_KEY, JSON.stringify(scopes));
}

function getConsumerStorageKey(consumerId: string): string {
  return `${VIEW_REFRESH_CONSUMER_STORAGE_PREFIX}${consumerId}`;
}

function readSeenScopes(consumerId: string): ViewRefreshVersionMap {
  if (typeof window === 'undefined') {
    return {};
  }

  const rawValue = window.sessionStorage.getItem(getConsumerStorageKey(consumerId));
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<ViewRefreshVersionMap>((accumulator, [scope, version]) => {
      if (
        typeof scope === 'string'
        && VIEW_REFRESH_SCOPES.includes(scope as ViewRefreshScope)
        && typeof version === 'number'
        && Number.isFinite(version)
      ) {
        accumulator[scope as ViewRefreshScope] = version;
      }
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

function writeSeenScopes(consumerId: string, scopes: ViewRefreshVersionMap): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (Object.keys(scopes).length === 0) {
    window.sessionStorage.removeItem(getConsumerStorageKey(consumerId));
    return;
  }

  window.sessionStorage.setItem(getConsumerStorageKey(consumerId), JSON.stringify(scopes));
}

function debugViewRefresh(message: string, data?: unknown): void {
  if (!viewRefreshDebugEnabled) {
    return;
  }

  logger.debug(`[ViewRefresh] ${message}`, data);
}

function incrementScopeCounters(
  target: ViewRefreshVersionMap,
  scopes: ViewRefreshScope[],
): void {
  scopes.forEach((scope) => {
    target[scope] = (target[scope] || 0) + 1;
  });
}

function recordViewRefreshEvent(
  type: ViewRefreshDebugEvent['type'],
  scopes: ViewRefreshScope[],
  consumerId?: string,
): void {
  viewRefreshDebugState.recentEvents.unshift({
    type,
    scopes,
    consumerId,
    at: new Date().toISOString(),
  });
  viewRefreshDebugState.recentEvents = viewRefreshDebugState.recentEvents.slice(0, VIEW_REFRESH_EVENT_HISTORY_LIMIT);
}

function syncDirtyScopesSnapshot(dirtyScopes: ViewRefreshVersionMap): void {
  viewRefreshDebugState.dirtyScopes = { ...dirtyScopes };
}

function exposeViewRefreshDebugApi(): void {
  if (typeof window === 'undefined' || !viewRefreshDebugEnabled) {
    return;
  }

  const debugWindow = window as Window & {
    __APP_VIEW_REFRESH__?: {
      getSnapshot: typeof getViewRefreshSnapshot;
    };
  };

  debugWindow.__APP_VIEW_REFRESH__ = {
    getSnapshot: getViewRefreshSnapshot,
  };
}

export function getViewRefreshSnapshot(): ViewRefreshDebugSnapshot {
  return {
    dirtyScopes: { ...viewRefreshDebugState.dirtyScopes },
    counters: { ...viewRefreshDebugState.counters },
    scopeCounters: {
      marks: { ...viewRefreshDebugState.scopeCounters.marks },
      consumes: { ...viewRefreshDebugState.scopeCounters.consumes },
      deliveries: { ...viewRefreshDebugState.scopeCounters.deliveries },
    },
    recentEvents: viewRefreshDebugState.recentEvents.map((event) => ({
      ...event,
      scopes: [...event.scopes],
    })),
  };
}

export function resetViewRefreshDebugStateForTests(): void {
  viewRefreshDebugState.dirtyScopes = {};
  viewRefreshDebugState.counters = {
    marks: 0,
    consumes: 0,
    deliveries: 0,
  };
  viewRefreshDebugState.scopeCounters = {
    marks: {},
    consumes: {},
    deliveries: {},
  };
  viewRefreshDebugState.recentEvents = [];
}

export function markViewScopesDirty(scopes: ViewRefreshScope[]): void {
  if (typeof window === 'undefined' || scopes.length === 0) {
    return;
  }

  const expandedScopes = new Set<ViewRefreshScope>();
  const queue = [...scopes];
  while (queue.length > 0) {
    const scope = queue.shift();
    if (!scope || expandedScopes.has(scope)) {
      continue;
    }
    expandedScopes.add(scope);
    (VIEW_REFRESH_DERIVED_SCOPES[scope] || []).forEach((derivedScope) => {
      if (!expandedScopes.has(derivedScope)) {
        queue.push(derivedScope);
      }
    });
  }

  const dirtyScopes = readDirtyScopes();
  const changedVersions: ViewRefreshVersionMap = {};

  expandedScopes.forEach((scope) => {
    const nextVersion = (dirtyScopes[scope] || 0) + 1;
    dirtyScopes[scope] = nextVersion;
    changedVersions[scope] = nextVersion;
  });

  writeDirtyScopes(dirtyScopes);
  viewRefreshDebugState.counters.marks += 1;
  incrementScopeCounters(viewRefreshDebugState.scopeCounters.marks, [...expandedScopes]);
  syncDirtyScopesSnapshot(dirtyScopes);
  recordViewRefreshEvent('mark', [...expandedScopes]);
  debugViewRefresh('Marked dirty scopes', {
    scopes: [...expandedScopes],
    versions: changedVersions,
  });
  window.dispatchEvent(new CustomEvent<ViewRefreshEventDetail>(VIEW_REFRESH_EVENT_NAME, {
    detail: { scopes: [...expandedScopes], versions: changedVersions },
  }));
}

export function markAllViewScopesDirty(): void {
  markViewScopesDirty([...VIEW_REFRESH_SCOPES]);
}

function acknowledgeDirtyScopesForConsumer(
  consumerId: string,
  scopes: ViewRefreshScope[],
  dirtyScopes: ViewRefreshVersionMap = readDirtyScopes(),
): void {
  const seenScopes = readSeenScopes(consumerId);
  let hasChanges = false;

  scopes.forEach((scope) => {
    const dirtyVersion = dirtyScopes[scope];
    if (!dirtyVersion) {
      return;
    }
    if ((seenScopes[scope] || 0) >= dirtyVersion) {
      return;
    }
    seenScopes[scope] = dirtyVersion;
    hasChanges = true;
  });

  if (hasChanges) {
    writeSeenScopes(consumerId, seenScopes);
  }
}

export function consumeDirtyViewScopesForConsumer(
  consumerId: string,
  scopes: ViewRefreshScope[],
): boolean {
  if (typeof window === 'undefined' || !consumerId || scopes.length === 0) {
    return false;
  }

  const dirtyScopes = readDirtyScopes();
  const seenScopes = readSeenScopes(consumerId);
  const hasMatch = scopes.some((scope) => (dirtyScopes[scope] || 0) > (seenScopes[scope] || 0));
  if (!hasMatch) {
    return false;
  }

  acknowledgeDirtyScopesForConsumer(consumerId, scopes, dirtyScopes);
  viewRefreshDebugState.counters.consumes += 1;
  incrementScopeCounters(viewRefreshDebugState.scopeCounters.consumes, scopes);
  syncDirtyScopesSnapshot(dirtyScopes);
  recordViewRefreshEvent('consume', scopes, consumerId);
  debugViewRefresh('Consumed dirty scopes for consumer', { consumerId, scopes });
  return true;
}

export function consumeDirtyViewScopes(scopes: ViewRefreshScope[]): boolean {
  return consumeDirtyViewScopesForConsumer('__legacy__', scopes);
}

export function subscribeToViewRefreshForConsumer(
  consumerId: string,
  scopes: ViewRefreshScope[],
  callback: (scopes: ViewRefreshScope[]) => void,
): () => void {
  if (typeof window === 'undefined' || !consumerId || scopes.length === 0) {
    return () => {};
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ViewRefreshEventDetail>).detail;
    const changedScopes = detail?.scopes || [];
    const matchingScopes = changedScopes.filter((scope) => scopes.includes(scope));
    if (matchingScopes.length === 0) {
      return;
    }
    acknowledgeDirtyScopesForConsumer(consumerId, matchingScopes, detail?.versions);
    viewRefreshDebugState.counters.deliveries += 1;
    incrementScopeCounters(viewRefreshDebugState.scopeCounters.deliveries, matchingScopes);
    syncDirtyScopesSnapshot(readDirtyScopes());
    recordViewRefreshEvent('deliver', matchingScopes, consumerId);
    debugViewRefresh('Delivered runtime refresh event', { consumerId, scopes: matchingScopes });
    callback(matchingScopes);
  };

  window.addEventListener(VIEW_REFRESH_EVENT_NAME, handler as EventListener);
  return () => {
    window.removeEventListener(VIEW_REFRESH_EVENT_NAME, handler as EventListener);
  };
}

export function subscribeToViewRefresh(
  scopes: ViewRefreshScope[],
  callback: (scopes: ViewRefreshScope[]) => void,
): () => void {
  return subscribeToViewRefreshForConsumer(`__legacy__:${scopes.join(',')}`, scopes, callback);
}

exposeViewRefreshDebugApi();
