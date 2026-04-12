export const VIEW_REFRESH_STORAGE_KEY = 'appDirtyViewScopes';

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
  'tags',
] as const;

export type ViewRefreshScope = typeof VIEW_REFRESH_SCOPES[number];

function readDirtyScopes(): Set<ViewRefreshScope> {
  if (typeof window === 'undefined') {
    return new Set<ViewRefreshScope>();
  }

  const rawValue = window.sessionStorage.getItem(VIEW_REFRESH_STORAGE_KEY);
  if (!rawValue) {
    return new Set<ViewRefreshScope>();
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return new Set<ViewRefreshScope>();
    }

    return new Set(
      parsed.filter((scope): scope is ViewRefreshScope =>
        typeof scope === 'string' && VIEW_REFRESH_SCOPES.includes(scope as ViewRefreshScope)
      ),
    );
  } catch {
    return new Set<ViewRefreshScope>();
  }
}

function writeDirtyScopes(scopes: Set<ViewRefreshScope>): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (scopes.size === 0) {
    window.sessionStorage.removeItem(VIEW_REFRESH_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(VIEW_REFRESH_STORAGE_KEY, JSON.stringify([...scopes]));
}

export function markViewScopesDirty(scopes: ViewRefreshScope[]): void {
  if (typeof window === 'undefined' || scopes.length === 0) {
    return;
  }

  const nextScopes = readDirtyScopes();
  scopes.forEach((scope) => nextScopes.add(scope));
  writeDirtyScopes(nextScopes);
}

export function markAllViewScopesDirty(): void {
  markViewScopesDirty([...VIEW_REFRESH_SCOPES]);
}

export function consumeDirtyViewScopes(scopes: ViewRefreshScope[]): boolean {
  if (typeof window === 'undefined' || scopes.length === 0) {
    return false;
  }

  const currentScopes = readDirtyScopes();
  const hasMatch = scopes.some((scope) => currentScopes.has(scope));
  if (!hasMatch) {
    return false;
  }

  scopes.forEach((scope) => currentScopes.delete(scope));
  writeDirtyScopes(currentScopes);
  return true;
}
