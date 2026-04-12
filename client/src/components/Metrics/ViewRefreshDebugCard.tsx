import { useMemo, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { getViewRefreshSnapshot, type ViewRefreshScope } from '../../utils/viewRefresh';

type SnapshotState = ReturnType<typeof getViewRefreshSnapshot>;

const DEBUG_SCOPES_ORDER: ViewRefreshScope[] = [
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
];

function formatDirtyScopes(snapshot: SnapshotState): Array<{ scope: string; version: number }> {
  return DEBUG_SCOPES_ORDER
    .map((scope) => ({ scope, version: snapshot.dirtyScopes[scope] || 0 }))
    .filter(({ version }) => version > 0);
}

export default function ViewRefreshDebugCard(): JSX.Element | null {
  const { t } = useTranslation();
  const debugEnabled = import.meta.env.VITE_DEBUG_VIEW_REFRESH === '1';
  const [snapshot, setSnapshot] = useState<SnapshotState>(() => getViewRefreshSnapshot());

  const dirtyScopes = useMemo(() => formatDirtyScopes(snapshot), [snapshot]);
  const label = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  if (!debugEnabled) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-amber-500/30 bg-amber-50/80 p-5 text-slate-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
            {label('metrics.viewRefreshDebug.badge', 'Debug')}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            {label('metrics.viewRefreshDebug.title', 'Refresh transverse')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {label('metrics.viewRefreshDebug.description', 'Scopes de refresh produits et consommes par les vues cachees.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSnapshot(getViewRefreshSnapshot())}
          className="app-button-secondary inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {label('metrics.viewRefreshDebug.refresh', 'Recharger le snapshot')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label('metrics.viewRefreshDebug.marks', 'Marks')}
          </p>
          <p className="mt-2 text-2xl font-semibold">{snapshot.counters.marks}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label('metrics.viewRefreshDebug.deliveries', 'Deliveries')}
          </p>
          <p className="mt-2 text-2xl font-semibold">{snapshot.counters.deliveries}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label('metrics.viewRefreshDebug.consumes', 'Consumes')}
          </p>
          <p className="mt-2 text-2xl font-semibold">{snapshot.counters.consumes}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label('metrics.viewRefreshDebug.dirtyScopes', 'Scopes dirty')}
          </p>
          <p className="mt-2 text-2xl font-semibold">{dirtyScopes.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-sm font-semibold">{label('metrics.viewRefreshDebug.activeScopes', 'Scopes dirty actifs')}</p>
          {dirtyScopes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {dirtyScopes.map(({ scope, version }) => (
                <span
                  key={scope}
                  className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                >
                  {scope} v{version}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {label('metrics.viewRefreshDebug.noDirtyScopes', 'Aucun scope dirty en attente.')}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-sm font-semibold">{label('metrics.viewRefreshDebug.recentEvents', 'Evenements recents')}</p>
          {snapshot.recentEvents.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {snapshot.recentEvents.slice(0, 6).map((event, index) => (
                <li key={`${event.at}-${event.type}-${index}`} className="rounded-xl border border-slate-200/80 px-3 py-2 dark:border-slate-700/80">
                  <span className="font-medium">{event.type}</span>
                  {' | '}
                  {event.scopes.join(', ')}
                  {event.consumerId ? ` | ${event.consumerId}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {label('metrics.viewRefreshDebug.noEvents', 'Aucun evenement recent enregistre.')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

