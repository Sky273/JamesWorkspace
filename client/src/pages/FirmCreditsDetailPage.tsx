import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import StatCardsGrid from '../components/page/StatCardsGrid';
import logger from '../utils/logger.frontend';
import userService, { type FirmCreditBreakdownItem, type FirmCreditsDetailResponse } from '../utils/userService';

function formatCredits(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function FirmCreditsDetailPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<FirmCreditsDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const getActionLabel = useCallback((actionType?: string) => {
    const translationKey = actionType ? `firmCredits.actions.${actionType}` : null;
    if (translationKey) {
      const translated = t(translationKey);
      if (translated !== translationKey) {
        return translated;
      }
    }
    return actionType || t('firmCredits.actions.default');
  }, [t]);

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await userService.getFirmCreditsDetail(id);
      setDetail(result);
    } catch (error) {
      logger.error('Error loading firm credit detail:', error);
      toast.error(t('firmCredits.detail.messages.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const summary = detail?.summary;
  const topUserActionRows = useMemo(
    () => (detail?.userActionBreakdown || []).slice(0, 12),
    [detail?.userActionBreakdown],
  );

  const renderBreakdownRow = (item: FirmCreditBreakdownItem, mode: 'user' | 'action' | 'userAction') => (
    <tr key={`${mode}-${item.user_id || item.user_name || 'system'}-${item.action_type || 'all'}`} className="border-t border-[var(--cv-outline)]">
      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
        {mode === 'action' ? getActionLabel(item.action_type) : (item.user_name || t('firmCredits.detail.systemUser'))}
      </td>
      {mode === 'userAction' ? (
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{getActionLabel(item.action_type)}</td>
      ) : null}
      {mode === 'action' ? (
        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.unique_user_count || 0}</td>
      ) : null}
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.transaction_count}</td>
      <td className="px-4 py-3 text-sm font-semibold text-rose-500">-{formatCredits(item.consumed_credits || 0)}</td>
      <td className="px-4 py-3 text-sm font-semibold text-emerald-500">+{formatCredits(item.added_credits || 0)}</td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDateTime(item.last_activity_at)}</td>
    </tr>
  );

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cv-surface app-page-shell">
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
            <span>{t('common.loading')}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!detail) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cv-surface app-page-shell">
        <button
          type="button"
          onClick={() => navigate('/admin?tab=firmCredits')}
          className="app-button-secondary mb-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('firmCredits.detail.back')}
        </button>
        <EmptyStateCard
          icon={BuildingOfficeIcon}
          title={t('firmCredits.detail.empty.title')}
          description={t('firmCredits.detail.empty.description')}
          containerClassName="section-shell rounded-[2rem] p-12 text-center"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="cv-surface app-page-shell"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin?tab=firmCredits')}
          className="app-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('firmCredits.detail.back')}
        </button>
        <button
          type="button"
          onClick={() => void fetchDetail()}
          className="app-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {t('common.refresh')}
        </button>
      </div>

      <PageHeader
        title={t('firmCredits.detail.title', { name: detail.firm.name })}
        subtitle={t('firmCredits.detail.subtitle')}
      />

      <StatCardsGrid
        className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4"
        items={[
          {
            icon: BanknotesIcon,
            iconBgClassName: 'bg-emerald-100 dark:bg-emerald-900/30',
            iconClassName: 'text-emerald-600 dark:text-emerald-400',
            label: t('firmCredits.detail.stats.currentBalance'),
            value: detail.firm.credits || 0,
          },
          {
            icon: ShieldCheckIcon,
            iconBgClassName: 'bg-rose-100 dark:bg-rose-900/30',
            iconClassName: 'text-rose-600 dark:text-rose-400',
            label: t('firmCredits.detail.stats.totalConsumed'),
            value: summary?.total_credits_consumed || 0,
          },
          {
            icon: BanknotesIcon,
            iconBgClassName: 'bg-sky-100 dark:bg-sky-900/30',
            iconClassName: 'text-sky-600 dark:text-sky-400',
            label: t('firmCredits.detail.stats.totalAdded'),
            value: summary?.total_credits_added || 0,
          },
          {
            icon: UserGroupIcon,
            iconBgClassName: 'bg-violet-100 dark:bg-violet-900/30',
            iconClassName: 'text-violet-600 dark:text-violet-400',
            label: t('firmCredits.detail.stats.transactionCount'),
            value: summary?.transaction_count || 0,
            helper: t('firmCredits.detail.stats.lastActivity', { value: formatDateTime(summary?.last_credit_activity_at) }),
          },
        ]}
      />

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="section-shell overflow-hidden rounded-[2rem]">
          <div className="border-b border-[var(--cv-outline)] px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('firmCredits.detail.sections.userBreakdown')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.user')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.transactions')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.consumed')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.added')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.lastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {(detail.userBreakdown || []).length > 0 ? detail.userBreakdown.map((item) => renderBreakdownRow(item, 'user')) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('firmCredits.detail.empty.userBreakdown')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-shell overflow-hidden rounded-[2rem]">
          <div className="border-b border-[var(--cv-outline)] px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('firmCredits.detail.sections.actionBreakdown')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.action')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.users')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.transactions')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.consumed')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.added')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.lastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {(detail.actionBreakdown || []).length > 0 ? detail.actionBreakdown.map((item) => renderBreakdownRow(item, 'action')) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('firmCredits.detail.empty.actionBreakdown')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="section-shell overflow-hidden rounded-[2rem]">
          <div className="border-b border-[var(--cv-outline)] px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('firmCredits.detail.sections.userActionBreakdown')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.user')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.action')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.transactions')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.consumed')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.added')}</th>
                  <th className="px-4 py-3">{t('firmCredits.detail.columns.lastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {topUserActionRows.length > 0 ? topUserActionRows.map((item) => renderBreakdownRow(item, 'userAction')) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('firmCredits.detail.empty.userActionBreakdown')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-shell overflow-hidden rounded-[2rem]">
          <div className="border-b border-[var(--cv-outline)] px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('firmCredits.detail.sections.recentTransactions')}</h2>
          </div>
          <div className="divide-y divide-[var(--cv-outline)]">
            {(detail.recentTransactions || []).length > 0 ? detail.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900 dark:text-white">{getActionLabel(transaction.action_type)}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {transaction.user_name} | {formatDateTime(transaction.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${transaction.credits_delta < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {transaction.credits_delta > 0 ? '+' : ''}{formatCredits(transaction.credits_delta)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('firmCredits.detail.balanceAfter', { value: formatCredits(transaction.balance_after) })}
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('firmCredits.detail.empty.recentTransactions')}
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
