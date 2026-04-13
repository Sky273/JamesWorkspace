import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingOfficeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import { markResumeDealRelationsDirty } from '../../utils/viewRefreshScopes';
import toast from 'react-hot-toast';
import { STATUS_COLORS, STATUS_LABELS } from './dealsGrouped.types';

interface Deal {
  id: string;
  title: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  status: string;
  priority: string;
  resumes_count: number;
}

interface ResumeDeal {
  deal_id: string;
  deal_title: string;
  client_name?: string;
  contact_name?: string;
  status: string;
  added_at: string;
}

interface ManageResumeDealsModalProps {
  resumeId: string;
  onSuccess?: () => void;
}

const ManageResumeDealsModal = ({ resumeId, onSuccess }: ManageResumeDealsModalProps): JSX.Element => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [resumeDeals, setResumeDeals] = useState<ResumeDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isOpen) return;

    try {
      setLoading(true);
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });

      const dealsResponse = await fetchWithAuth('/api/deals?limit=100', options);
      if (dealsResponse.ok) {
        const data = await dealsResponse.json();
        setAllDeals(data.data || []);
      }

      const resumeDealsResponse = await fetchWithAuth(`/api/deals/by-resume/${resumeId}`, options);
      if (resumeDealsResponse.ok) {
        const data = await resumeDealsResponse.json();
        setResumeDeals(data.data || []);
      }
    } catch (error) {
      logger.error('Error fetching deals:', error);
      toast.error(t('crm.deals.messages.errorFetching'));
    } finally {
      setLoading(false);
    }
  }, [isOpen, resumeId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableDeals = allDeals.filter((deal) =>
    !resumeDeals.some((rd) => rd.deal_id === deal.id) &&
    (searchTerm === '' ||
      deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.client_name?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const addToDeal = async (dealId: string) => {
    setSaving(true);
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId }),
      });
      const response = await fetchWithAuth(`/api/deals/${dealId}/resumes`, options);

      if (response.ok) {
        toast.success(t('crm.deals.modal.cvAdded'));
      markResumeDealRelationsDirty();
        await fetchData();
        setShowAddSection(false);
        setSearchTerm('');
        onSuccess?.();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add');
      }
    } catch (error) {
      logger.error('Error adding to deal:', error);
      toast.error(t('crm.deals.modal.errorAdding'));
    } finally {
      setSaving(false);
    }
  };

  const removeFromDeal = async (dealId: string) => {
    setSaving(true);
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithAuth(`/api/deals/${dealId}/resumes/${resumeId}`, options);

      if (response.ok) {
        toast.success(t('crm.deals.modal.cvRemoved'));
      markResumeDealRelationsDirty();
        setResumeDeals((prev) => prev.filter((rd) => rd.deal_id !== dealId));
        onSuccess?.();
      } else {
        throw new Error('Failed to remove');
      }
    } catch (error) {
      logger.error('Error removing from deal:', error);
      toast.error(t('crm.deals.modal.errorRemoving'));
    } finally {
      setSaving(false);
    }
  };

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
    setShowAddSection(false);
    setSearchTerm('');
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={openModal}
        className="cv-ghost-button inline-flex min-h-10 items-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-medium"
        title={t('crm.deals.modal.manageDeals')}
      >
        <FolderIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{t('crm.deals.modal.manageDeals')}</span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('crm.deals.modal.manageDeals')}
              className="cv-panel flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-200/70 px-6 py-5 dark:border-white/6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="cv-kicker">{t('crm.deals.modal.manageDeals')}</div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-[#dee5ff]">{t('crm.deals.modal.manageDeals')}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">{resumeId}</p>
                  </div>
                  <button onClick={closeModal} className="cv-ghost-button rounded-[1rem] p-2.5">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cv-primary)]" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-[#dee5ff]">
                            {t('crm.deals.modal.associatedDeals')} ({resumeDeals.length})
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">
                            {t('crm.deals.modal.associatedDealsHint', { defaultValue: 'Pilotez les rattachements sans quitter la vue par affaire.' })}
                          </p>
                        </div>
                        {!showAddSection ? (
                          <button
                            onClick={() => setShowAddSection(true)}
                            className="cv-gradient-button inline-flex items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-sm font-semibold"
                          >
                            <PlusIcon className="h-4 w-4" />
                            {t('common.add')}
                          </button>
                        ) : null}
                      </div>

                      {resumeDeals.length === 0 ? (
                        <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-10 text-center dark:border-white/10">
                          <FolderIcon className="mx-auto mb-3 h-10 w-10 text-slate-400 dark:text-[#7f8ab0]" />
                          <p className="text-sm text-slate-500 dark:text-[#a3aac4]">{t('crm.deals.modal.noDealsAssociated')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {resumeDeals.map((deal) => (
                            <div
                              key={deal.deal_id}
                              className="flex flex-col gap-3 rounded-[1.2rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/6 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-[#dee5ff]">{deal.deal_title}</span>
                                  <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                                    {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#8f99b8]">
                                  {deal.client_name ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <BuildingOfficeIcon className="h-3.5 w-3.5" />
                                      {deal.client_name}
                                    </span>
                                  ) : null}
                                  {deal.contact_name ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <UserIcon className="h-3.5 w-3.5" />
                                      {deal.contact_name}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <button
                                onClick={() => removeFromDeal(deal.deal_id)}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[color:color-mix(in_srgb,var(--cv-danger)_20%,transparent)] bg-[var(--cv-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--cv-danger)] transition-colors hover:brightness-105 disabled:opacity-50"
                              >
                                <TrashIcon className="h-4 w-4" />
                                {t('crm.deals.modal.removeFromDeal')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <AnimatePresence>
                      {showAddSection ? (
                        <motion.section
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border-t border-slate-200/70 pt-6 dark:border-white/6"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-[#dee5ff]">{t('crm.deals.modal.addToDeal')}</h3>
                              <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">{t('crm.deals.modal.addHint', { defaultValue: 'Cherchez une affaire puis rattachez le CV en un clic.' })}</p>
                            </div>
                            <button
                              onClick={() => {
                                setShowAddSection(false);
                                setSearchTerm('');
                              }}
                              className="cv-ghost-button rounded-[1rem] px-4 py-3 text-sm font-medium"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>

                          <div className="relative mt-4">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder={t('crm.deals.modal.searchDeal')}
                              className="cv-search-input w-full rounded-[1rem] py-3 pl-10 pr-4 text-sm"
                            />
                          </div>

                          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                            {availableDeals.length === 0 ? (
                              <div className="rounded-[1.2rem] border border-dashed border-slate-300 px-4 py-8 text-center dark:border-white/10">
                                <p className="text-sm text-slate-500 dark:text-[#a3aac4]">
                                  {searchTerm ? t('crm.deals.modal.noDealFound') : t('crm.deals.modal.allDealsAssociated')}
                                </p>
                              </div>
                            ) : (
                              availableDeals.map((deal) => (
                                <button
                                  key={deal.id}
                                  onClick={() => addToDeal(deal.id)}
                                  disabled={saving}
                                  className="flex w-full items-center justify-between gap-3 rounded-[1.1rem] border border-slate-200/70 bg-white/70 p-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/6 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-[#dee5ff]">{deal.title}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#8f99b8]">
                                      {deal.client_name ? <span className="truncate">{deal.client_name}</span> : null}
                                      <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                                        {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
                                    <PlusIcon className="h-4 w-4" />
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </motion.section>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/70 px-6 py-5 dark:border-white/6">
                <button onClick={closeModal} className="cv-ghost-button w-full rounded-[1rem] px-4 py-3 text-sm font-medium">{t('common.close')}</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default ManageResumeDealsModal;
