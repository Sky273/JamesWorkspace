import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowPathIcon, BanknotesIcon, BuildingOfficeIcon, PlusIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import AnimatedCard from '../components/page/AnimatedCard';
import CardActionButton from '../components/page/CardActionButton';
import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import PaginationPair from '../components/page/PaginationPair';
import SearchField from '../components/page/SearchField';
import StatCardsGrid from '../components/page/StatCardsGrid';
import { useAuth } from '../context/AuthContext';
import { useScopedViewRefresh } from '../hooks/useScopedViewRefresh';
import userService, { type Firm } from '../utils/userService';
import logger from '../utils/logger.frontend';
import { markFirmViewsDirty } from '../utils/viewRefreshScopes';

const PAGE_SIZE = 12;
const CREDIT_PRESETS = [100, 250, 500, 1000];

function getTotalPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const FirmCreditsPage = ({ embedded = false }: { embedded?: boolean } = {}): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [creditsAmount, setCreditsAmount] = useState('100');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const fetchCredits = useCallback(async ({ forceRefresh = false, pageOverride }: { forceRefresh?: boolean; pageOverride?: number } = {}) => {
    try {
      setLoading(true);
      const nextPage = pageOverride ?? page;
      const result = await userService.getFirmCreditsPaginated({
        page: nextPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearchTerm.trim(),
        forceRefresh,
      });
      setFirms(result.firms);
      setTotalCount(typeof result.pagination?.totalCount === 'number' ? result.pagination.totalCount : result.firms.length);
    } catch (error) {
      logger.error('Error loading firm credits:', error);
      toast.error(t('firmCredits.messages.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, page, t]);

  useEffect(() => {
    void fetchCredits();
  }, [fetchCredits]);

  useScopedViewRefresh({
    consumerId: embedded ? 'admin-workspace:firm-credits-page' : 'firm-credits-page',
    scopes: ['firms', 'administration'],
    onRefresh: () => {
      void fetchCredits({ forceRefresh: true });
    },
  });

  const totalPages = useMemo(() => getTotalPages(totalCount, PAGE_SIZE), [totalCount]);
  const totalCredits = useMemo(() => firms.reduce((sum, firm) => sum + (firm.credits || 0), 0), [firms]);
  const totalConsumed = useMemo(() => firms.reduce((sum, firm) => sum + (firm.total_credits_consumed || 0), 0), [firms]);
  const averageCredits = useMemo(
    () => (firms.length > 0 ? Math.round(totalCredits / firms.length) : 0),
    [firms.length, totalCredits],
  );
  const selectedFirmCredits = selectedFirm?.credits || 0;
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

  const handleRefresh = useCallback(async () => {
    await fetchCredits({ forceRefresh: true, pageOverride: page });
  }, [fetchCredits, page]);

  const handleAddCredits = useCallback(async () => {
    if (!selectedFirm) {
      return;
    }

    const amount = Number.parseInt(creditsAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error(t('firmCredits.messages.invalidAmount'));
      return;
    }

    try {
      setSaving(true);
      const updatedFirm = await userService.addFirmCredits(selectedFirm.id, amount);
      setFirms((currentFirms) => currentFirms.map((firm) => (firm.id === updatedFirm.id ? updatedFirm : firm)));
      setSelectedFirm(null);
      setCreditsAmount('100');
      markFirmViewsDirty();
      toast.success(t('firmCredits.messages.creditsAdded', { amount, name: updatedFirm.name }));
      await fetchCredits({ forceRefresh: true, pageOverride: page });
    } catch (error) {
      logger.error('Error adding firm credits:', error);
      toast.error(t('firmCredits.messages.errorAddingCredits'));
    } finally {
      setSaving(false);
    }
  }, [creditsAmount, fetchCredits, page, selectedFirm, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={embedded ? 'space-y-6' : 'cv-surface app-page-shell'}
    >
      {!embedded ? <PageHeader title={t('firmCredits.title')} subtitle={t('firmCredits.subtitle')} /> : null}

      <StatCardsGrid
        className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"
        items={[
          {
            icon: BuildingOfficeIcon,
            iconBgClassName: 'bg-blue-100 dark:bg-blue-900/30',
            iconClassName: 'text-blue-600 dark:text-blue-400',
            label: t('firmCredits.stats.totalFirms'),
            value: totalCount,
          },
          {
            icon: BanknotesIcon,
            iconBgClassName: 'bg-emerald-100 dark:bg-emerald-900/30',
            iconClassName: 'text-emerald-600 dark:text-emerald-400',
            label: t('firmCredits.stats.visibleCredits'),
            value: totalCredits,
            helper: t('firmCredits.stats.visibleCreditsHelper'),
          },
          {
            icon: ShieldCheckIcon,
            iconBgClassName: 'bg-purple-100 dark:bg-purple-900/30',
            iconClassName: 'text-purple-600 dark:text-purple-400',
            label: t('firmCredits.stats.consumedCredits'),
            value: totalConsumed,
            helper: t('firmCredits.stats.consumedCreditsHelper'),
          },
          {
            icon: BuildingOfficeIcon,
            iconBgClassName: 'bg-sky-100 dark:bg-sky-900/30',
            iconClassName: 'text-sky-600 dark:text-sky-400',
            label: t('firmCredits.stats.averageCredits'),
            value: averageCredits,
            helper: t('firmCredits.stats.defaultCreditsHelper', { value: 1000 }),
          },
        ]}
      />

      <div className="section-shell mb-6 rounded-[2rem]">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div>
            <div className="mb-3 text-sm font-medium text-slate-500 dark:text-[var(--cv-muted)]">
              {t('firmCredits.toolbarTitle')}
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SearchField
                containerClassName="relative flex-1"
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('firmCredits.searchPlaceholder')}
              />
              <button
                onClick={() => void handleRefresh()}
                className="app-button-secondary inline-flex items-center justify-center rounded-2xl p-2.5"
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--cv-outline)] bg-slate-50/80 p-4 dark:bg-white/[0.03]">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <ShieldCheckIcon className="h-5 w-5 text-[var(--cv-primary)]" />
              {isSuperAdmin ? t('firmCredits.access.superAdminTitle') : t('firmCredits.access.localAdminTitle')}
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)]">
              {isSuperAdmin ? t('firmCredits.access.superAdminDescription') : t('firmCredits.access.localAdminDescription')}
            </p>
          </div>
        </div>
      </div>

      <PaginationPair
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={loading}
        itemName={t('firmCredits.results')}
      >
        {firms.length === 0 && !loading ? (
          <EmptyStateCard
            icon={BuildingOfficeIcon}
            title={t('firmCredits.empty.title')}
            description={t('firmCredits.empty.description')}
            containerClassName="section-shell rounded-[2rem] p-12 text-center"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {firms.map((firm, index) => (
              <AnimatedCard key={firm.id} index={index} className="overflow-hidden">
                <div className="border-b border-[var(--cv-outline)] bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-slate-900 dark:text-white">{firm.name}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-[var(--cv-muted)]">{t('firmCredits.currentBalance')}</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatCredits(firm.credits || 0)}
                    </div>
                  </div>
                  <div className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {t('firmCredits.statusLabel')}: {firm.status || 'active'}
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--cv-outline)] p-3">
                      <div className="cv-kicker mb-1">{t('firmCredits.card.consumed')}</div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white">{formatCredits(firm.total_credits_consumed || 0)}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--cv-outline)] p-3">
                      <div className="cv-kicker mb-1">{t('firmCredits.card.added')}</div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white">{formatCredits(firm.total_credits_added || 0)}</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-[var(--cv-outline)] p-3">
                    <div className="cv-kicker mb-1">{t('firmCredits.card.lastActivity')}</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatDateTime(firm.last_credit_activity_at)}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--cv-outline)] p-3">
                    <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{t('firmCredits.card.topConsumers')}</div>
                    {firm.top_consumers && firm.top_consumers.length > 0 ? (
                      <div className="space-y-2">
                        {firm.top_consumers.slice(0, 3).map((consumer) => (
                          <div key={`${firm.id}-${consumer.user_id || consumer.user_name}`} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-800 dark:text-slate-200">{consumer.user_name}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {t('firmCredits.card.userActions', { count: consumer.action_count })}
                              </div>
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white">{formatCredits(consumer.credits_consumed)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">{t('firmCredits.card.noConsumption')}</div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--cv-outline)] p-3">
                    <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{t('firmCredits.card.recentActivity')}</div>
                    {firm.recent_credit_transactions && firm.recent_credit_transactions.length > 0 ? (
                      <div className="space-y-2">
                        {firm.recent_credit_transactions.slice(0, 3).map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-800 dark:text-slate-200">{getActionLabel(transaction.action_type)}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {transaction.user_name} • {formatDateTime(transaction.created_at)}
                              </div>
                            </div>
                            <div className={`font-semibold ${transaction.credits_delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {transaction.credits_delta > 0 ? '+' : ''}{formatCredits(transaction.credits_delta)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">{t('firmCredits.card.noActivity')}</div>
                    )}
                  </div>

                  {isSuperAdmin ? (
                    <div className="mt-4 flex items-center gap-2 border-t border-[var(--cv-outline)] pt-4">
                      <CardActionButton
                        icon={PlusIcon}
                        label={t('firmCredits.addCredits')}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedFirm(firm);
                        }}
                        className="flex-1"
                        tone="primary"
                      />
                    </div>
                  ) : null}
                </div>
              </AnimatedCard>
            ))}
          </div>
        )}
      </PaginationPair>

      {selectedFirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="section-shell w-full max-w-lg rounded-[2rem] p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('firmCredits.modal.title')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('firmCredits.modal.subtitle', { name: selectedFirm.name })}
                </p>
              </div>
              <button
                onClick={() => setSelectedFirm(null)}
                className="app-button-secondary rounded-2xl p-2"
                aria-label={t('common.close')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="firm-credits-amount">
              {t('firmCredits.modal.amountLabel')}
            </label>
            <div className="mb-3 rounded-[1.5rem] border border-[var(--cv-outline)] bg-slate-50/70 p-4 dark:bg-white/[0.03]">
              <div className="mb-1 text-sm text-slate-500 dark:text-[var(--cv-muted)]">{t('firmCredits.modal.currentBalance')}</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-white">{formatCredits(selectedFirmCredits)}</div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {CREDIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCreditsAmount(String(preset))}
                  className="app-button-secondary rounded-2xl px-3 py-2 text-sm font-medium"
                >
                  +{formatCredits(preset)}
                </button>
              ))}
            </div>
            <input
              id="firm-credits-amount"
              type="number"
              min={1}
              step={1}
              value={creditsAmount}
              onChange={(event) => setCreditsAmount(event.target.value)}
              className="mb-5 w-full rounded-2xl border border-[var(--cv-outline)] bg-white px-4 py-3 text-slate-900 outline-none ring-0 dark:bg-slate-900 dark:text-white"
            />
            <p className="mb-5 text-sm text-slate-500 dark:text-[var(--cv-muted)]">
              {t('firmCredits.modal.previewBalance', { value: formatCredits(selectedFirmCredits + Math.max(Number.parseInt(creditsAmount || '0', 10) || 0, 0)) })}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedFirm(null)} className="app-button-secondary rounded-2xl px-4 py-2.5">
                {t('common.cancel')}
              </button>
              <button onClick={() => void handleAddCredits()} disabled={saving} className="app-button-primary rounded-2xl px-4 py-2.5">
                {saving ? t('common.saving') : t('firmCredits.modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};

export default FirmCreditsPage;
