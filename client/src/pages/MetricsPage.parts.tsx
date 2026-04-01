import { ForwardRefExoticComponent, memo, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { BoltIcon, ClockIcon } from '@heroicons/react/24/outline';

type HeroIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>
>;

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: HeroIcon;
  color?: string;
}

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

interface ApmMetrics {
  config?: {
    slowThreshold?: number;
    verySlowThreshold?: number;
    criticalThreshold?: number;
  };
  summary?: {
    totalTracked?: number;
    last5min?: number;
    avgDuration?: number;
    severityCounts?: {
      slow?: number;
      very_slow?: number;
      critical?: number;
    };
  };
  topSlowEndpoints?: Array<{
    endpoint: string;
    count: number;
    avgDuration: number;
    maxDuration: number;
  }>;
}

interface ApmMetricsSectionProps {
  metrics: ApmMetrics | null;
  t: (key: string) => string;
  safeNumber: (value: unknown, defaultValue?: number) => number;
}

export const StatCard = memo(({ title, value, subtitle, icon: Icon, color = 'blue' }: StatCardProps): JSX.Element => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-700',
    green: 'bg-green-50 text-green-600 border-green-200 dark:bg-gray-800 dark:text-green-400 dark:border-green-700',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-gray-800 dark:text-yellow-400 dark:border-yellow-700',
    red: 'bg-red-50 text-red-600 border-red-200 dark:bg-gray-800 dark:text-red-400 dark:border-red-700',
    purple: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-gray-800 dark:text-purple-400 dark:border-purple-700',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-gray-800 dark:text-indigo-400 dark:border-indigo-700'
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
        </div>
        <Icon className="w-10 h-10 opacity-50" />
      </div>
    </motion.div>
  );
});
StatCard.displayName = 'StatCard';

export const ProgressBar = memo(({ label, value, max, color = 'blue' }: ProgressBarProps): JSX.Element => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colorClasses: Record<string, string> = { blue: 'bg-blue-500', green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium">{value} / {max}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClasses[color]} transition-all duration-500`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
});
ProgressBar.displayName = 'ProgressBar';

export function ApmMetricsSection({ metrics, t, safeNumber }: ApmMetricsSectionProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="rounded-xl border bg-rose-50 text-rose-600 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.apm')}</p>
            <p className="text-2xl font-bold mt-1">{safeNumber(metrics?.summary?.totalTracked)}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.slowRequests')} ({t('metrics.last5min')}: {safeNumber(metrics?.summary?.last5min)})</p>
          </div>
          <BoltIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
            <p className="opacity-70 text-xs">{t('metrics.slow')}</p>
            <p className="font-semibold">{safeNumber(metrics?.summary?.severityCounts?.slow)}</p>
            <p className="text-xs opacity-50">&gt; {metrics?.config?.slowThreshold || 1000}ms</p>
          </div>
          <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
            <p className="opacity-70 text-xs">{t('metrics.verySlow')}</p>
            <p className="font-semibold">{safeNumber(metrics?.summary?.severityCounts?.very_slow)}</p>
            <p className="text-xs opacity-50">&gt; {metrics?.config?.verySlowThreshold || 5000}ms</p>
          </div>
          <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
            <p className="opacity-70 text-xs">{t('metrics.critical')}</p>
            <p className="font-semibold text-rose-700 dark:text-rose-300">{safeNumber(metrics?.summary?.severityCounts?.critical)}</p>
            <p className="text-xs opacity-50">&gt; {metrics?.config?.criticalThreshold || 30000}ms</p>
          </div>
        </div>
        {safeNumber(metrics?.summary?.totalTracked) === 0 && (
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            {t('metrics.noSlowRequests')}
          </p>
        )}
        {safeNumber(metrics?.summary?.avgDuration) > 0 && (
          <p className="text-xs opacity-60 mt-2">
            {t('metrics.avgDuration')}: {safeNumber(metrics?.summary?.avgDuration)}ms
          </p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="rounded-xl border bg-rose-50 text-rose-600 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.slowEndpoints')}</p>
            <p className="text-2xl font-bold mt-1">{metrics?.topSlowEndpoints?.length || 0}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.topSlowEndpoints')}</p>
          </div>
          <ClockIcon className="w-10 h-10 opacity-50" />
        </div>
        {metrics?.topSlowEndpoints && metrics.topSlowEndpoints.length > 0 ? (
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200 dark:border-rose-700">
                  <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.endpoint')}</th>
                  <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.count')}</th>
                  <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.avgMs')}</th>
                  <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.maxMs')}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topSlowEndpoints.slice(0, 5).map((item, index) => (
                  <tr key={index} className="border-b border-rose-100 dark:border-rose-800">
                    <td className="py-2 px-2 font-mono text-xs truncate max-w-[150px]" title={item.endpoint}>{item.endpoint}</td>
                    <td className="py-2 px-2 text-right font-semibold">{item.count}</td>
                    <td className="py-2 px-2 text-right opacity-70">{item.avgDuration}ms</td>
                    <td className="py-2 px-2 text-right text-rose-700 dark:text-rose-300">{item.maxDuration}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm opacity-60 text-center py-4">{t('metrics.noData')}</p>
        )}
      </motion.div>
    </div>
  );
}
