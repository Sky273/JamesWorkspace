import { useMemo, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
  getViewRefreshSnapshot,
  isViewRefreshDebugEnabled,
  type ViewRefreshScope,
} from '../../utils/viewRefresh';

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

function formatScopePerf(snapshot: SnapshotState) {
  return DEBUG_SCOPES_ORDER
    .map((scope) => ({
      scope,
      stats: snapshot.refreshCycles.byScope[scope],
    }))
    .filter(({ stats }) => stats && stats.total > 0);
}

export default function ViewRefreshDebugCard(): JSX.Element | null {
  const { t } = useTranslation();
  const debugEnabled = isViewRefreshDebugEnabled();
  const [snapshot, setSnapshot] = useState<SnapshotState>(() => getViewRefreshSnapshot());

  const dirtyScopes = useMemo(() => formatDirtyScopes(snapshot), [snapshot]);
  const scopePerf = useMemo(() => formatScopePerf(snapshot), [snapshot]);
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label('metrics.viewRefreshDebug.refreshCycles', 'Cycles de refresh')}
          </p>
          <p className="mt-2 text-2xl font-semibold">{snapshot.refreshCycles.total}</p>
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

      <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
        <p className="text-sm font-semibold">{label('metrics.viewRefreshDebug.refreshSummary', 'Résumé des refreshs')}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
          <span>{label('metrics.viewRefreshDebug.refreshCyclesFailures', 'Échecs')}: <strong>{snapshot.refreshCycles.failures}</strong></span>
          <span>{label('metrics.viewRefreshDebug.refreshCyclesAverage', 'Moyenne')}: <strong>{snapshot.refreshCycles.averageDurationMs.toFixed(1)} ms</strong></span>
          <span>{label('metrics.viewRefreshDebug.refreshCyclesLast', 'Dernier')}: <strong>{snapshot.refreshCycles.lastDurationMs.toFixed(1)} ms</strong></span>
          <span>{label('metrics.viewRefreshDebug.refreshCyclesMax', 'Max')}: <strong>{snapshot.refreshCycles.maxDurationMs.toFixed(1)} ms</strong></span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-slate-900/50">
        <p className="text-sm font-semibold">{label('metrics.viewRefreshDebug.scopePerf', 'Performance par scope')}</p>
        {scopePerf.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-2 pr-4">{label('metrics.viewRefreshDebug.scope', 'Scope')}</th>
                  <th className="pb-2 pr-4">{label('metrics.viewRefreshDebug.refreshCyclesTotal', 'Total')}</th>
                  <th className="pb-2 pr-4">{label('metrics.viewRefreshDebug.refreshCyclesFailures', 'Échecs')}</th>
                  <th className="pb-2 pr-4">{label('metrics.viewRefreshDebug.refreshCyclesAverage', 'Moyenne')}</th>
                  <th className="pb-2 pr-4">{label('metrics.viewRefreshDebug.refreshCyclesLast', 'Dernier')}</th>
                  <th className="pb-2">{label('metrics.viewRefreshDebug.refreshCyclesMax', 'Max')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                {scopePerf.map(({ scope, stats }) => (
                  <tr key={scope}>
                    <td className="py-2 pr-4 font-medium">{scope}</td>
                    <td className="py-2 pr-4">{stats?.total || 0}</td>
                    <td className="py-2 pr-4">{stats?.failures || 0}</td>
                    <td className="py-2 pr-4">{stats?.averageDurationMs.toFixed(1)} ms</td>
                    <td className="py-2 pr-4">{stats?.lastDurationMs.toFixed(1)} ms</td>
                    <td className="py-2">{stats?.maxDurationMs.toFixed(1)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {label('metrics.viewRefreshDebug.noScopePerf', 'Aucun cycle de refresh mesuré pour le moment.')}
          </p>
        )}
      </div>
    </section>
  );
}
