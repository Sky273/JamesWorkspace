import { motion } from 'framer-motion';
import type { JSX } from 'react';
import type {
  KPICardConfig,
  QuickActionConfig,
  SecondaryStatCard,
} from './HomeDashboard.types';

interface DashboardActionCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subValue?: string;
  color: string;
  delay: number;
  onClick?: () => void;
}

interface DashboardQuickActionProps {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  color: string;
  delay: number;
  tone?: 'primary' | 'secondary';
}

function DashboardActionCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  delay,
  onClick,
}: DashboardActionCardProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subValue && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </div>
    </motion.div>
  );
}

function DashboardQuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  color,
  delay,
  tone = 'secondary',
}: DashboardQuickActionProps): JSX.Element {
  if (tone === 'primary') {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="app-primary-action flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/10">
            <Icon className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">{label}</span>
            <span className="block text-sm text-slate-800/80">{description}</span>
          </span>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all text-left w-full"
    >
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </motion.button>
  );
}

export function HomeDashboardLoading(): JSX.Element {
  return (
    <section className="py-12 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-32"></div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeDashboardHeader({
  title,
  firmLabel,
}: {
  title: string;
  firmLabel: string | null;
}): JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {firmLabel && <p className="text-gray-500 dark:text-gray-400 mt-1">{firmLabel}</p>}
    </motion.div>
  );
}

export function HomeDashboardKpiGrid({
  cards,
  onNavigate,
}: {
  cards: KPICardConfig[];
  onNavigate: (route: string) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
      {cards.map((card) => (
        <DashboardActionCard
          key={`${card.route}-${card.label}`}
          {...card}
          onClick={() => onNavigate(card.route)}
        />
      ))}
    </div>
  );
}

export function HomeDashboardSecondaryStats({ cards }: { cards: SecondaryStatCard[] }): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: card.delay }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Icon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">{card.title}</h3>
            </div>
            <div className="space-y-3">
              {card.rows.map((row) => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                  <span className={`font-semibold text-gray-900 dark:text-gray-100 ${row.valueClassName || ''}`.trim()}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function HomeDashboardQuickActions({
  title,
  actions,
  onNavigate,
}: {
  title: string;
  actions: QuickActionConfig[];
  onNavigate: (route: string) => void;
}): JSX.Element {
  const primaryAction = actions.find((action) => action.tone === 'primary');
  const secondaryActions = actions.filter((action) => action.tone !== 'primary');

  return (
    <motion.div
      id="quick-actions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
      className="scroll-mt-32"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      {primaryAction ? (
        <div className="mb-4">
          <DashboardQuickAction
            key={`${primaryAction.route}-${primaryAction.label}`}
            {...primaryAction}
            onClick={() => onNavigate(primaryAction.route)}
          />
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {secondaryActions.map((action) => (
          <DashboardQuickAction
            key={`${action.route}-${action.label}`}
            {...action}
            onClick={() => onNavigate(action.route)}
          />
        ))}
      </div>
    </motion.div>
  );
}
