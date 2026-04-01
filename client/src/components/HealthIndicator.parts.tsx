import type { JSX } from 'react';
import { getStatusLabel, getStatusTone } from './HealthIndicator.utils';

export function StatusBadge({
  t,
  status,
}: {
  t?: (key: string) => string;
  status?: string;
}): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${getStatusTone(status)}`}
    >
      {getStatusLabel(t, status)}
    </span>
  );
}

export function IndicatorRow({
  label,
  meta,
  status,
  t,
}: {
  label: string;
  meta?: string | null;
  status?: string;
  t?: (key: string) => string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {meta ? <span className="font-mono text-[10px] text-gray-400">{meta}</span> : null}
        <StatusBadge t={t} status={status} />
      </div>
    </div>
  );
}

export function SectionTitle({ title }: { title: string }): JSX.Element {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {title}
    </div>
  );
}
