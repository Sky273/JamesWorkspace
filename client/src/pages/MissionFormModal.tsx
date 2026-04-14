/**
 * MissionFormModal - Create/edit mission modal with Tiptap
 * Extracted from MissionsPage.tsx
 */

import { ChangeEvent, FormEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import AdminFirmSelector from '../components/AdminFirmSelector';

interface Client {
  id: string;
  name: string;
  type: string;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface Deal {
  id: string;
  title: string;
  status: string;
  client_name?: string;
}

interface MissionFormData {
  Title: string;
  Content: string;
  Status: 'Active' | 'Closed' | 'Draft';
  'Client ID': string;
  'Contact ID': string;
  'Firm ID': string;
  'Deal ID': string;
}

interface MissionFormModalProps {
  isEditing: boolean;
  formData: MissionFormData;
  setFormData: (data: MissionFormData) => void;
  clients: Client[];
  contacts: Contact[];
  deals: Deal[];
  loadingClients: boolean;
  loadingContacts: boolean;
  loadingDeals: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  editorSlot?: ReactNode;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--cv-primary)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--cv-primary)_16%,transparent)] dark:border-white/10 dark:bg-slate-900/70 dark:text-[var(--cv-text)]';

export default function MissionFormModal({
  isEditing,
  formData,
  setFormData,
  clients,
  contacts,
  deals,
  loadingClients,
  loadingContacts,
  loadingDeals,
  onSubmit,
  onClose,
  editorSlot,
}: MissionFormModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="cv-surface flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-white/10 sm:px-6">
          <div>
            <div className="cv-kicker mb-2">{t('missions.title')}</div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">
              {isEditing ? t('missions.editMission') : t('missions.addMission')}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
              {t(
                'missions.editorHelp',
                'Renseignez le contexte commercial, puis structurez le contenu pour faciliter l’exploitation de la mission.'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
            aria-label={t('common.close', 'Fermer')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-5 border-b border-slate-200/70 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03] lg:border-b-0 lg:border-r sm:p-6">
              <section className="space-y-3">
                <div>
                  <div className="cv-kicker mb-2">{t('common.information', 'Informations')}</div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                    {t('missions.missionTitle')}
                  </h3>
                </div>

                <AdminFirmSelector
                  selectedFirmId={formData['Firm ID']}
                  onFirmChange={(firmId) => setFormData({ ...formData, 'Firm ID': firmId })}
                  className="mb-1"
                  t={t}
                />

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('missions.missionTitle')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.Title}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, Title: e.target.value })
                    }
                    placeholder={t('missions.titlePlaceholder')}
                    className={fieldClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('missions.missionStatus')}
                  </label>
                  <select
                    value={formData.Status}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFormData({
                        ...formData,
                        Status: e.target.value as 'Active' | 'Closed' | 'Draft',
                      })
                    }
                    className={fieldClassName}
                  >
                    <option value="Active">{t('missions.status.Active')}</option>
                    <option value="Draft">{t('missions.status.Draft')}</option>
                    <option value="Closed">{t('missions.status.Closed')}</option>
                  </select>
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <div className="cv-kicker mb-2">{t('missions.deal', 'Affectation')}</div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                    {t('missions.client', 'Client et relation')}
                  </h3>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('missions.deal', 'Affaire')}
                  </label>
                  <select
                    value={formData['Deal ID']}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFormData({ ...formData, 'Deal ID': e.target.value })
                    }
                    className={fieldClassName}
                    disabled={loadingDeals}
                  >
                    <option value="">
                      {loadingDeals
                        ? t('common.loading', 'Chargement...')
                        : t('missions.selectDeal', 'Aucune affaire (optionnel)')}
                    </option>
                    {deals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.title}
                        {deal.client_name ? ` — ${deal.client_name}` : ''} ({deal.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('missions.client', 'Client / Prospect')}
                    </label>
                    <Link
                      to="/clients"
                      className="text-sm font-medium text-[var(--cv-primary)] underline-offset-4 transition hover:underline"
                    >
                      {t('common.manage', 'Gérer')}
                    </Link>
                  </div>
                  <select
                    value={formData['Client ID']}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      setFormData({ ...formData, 'Client ID': e.target.value, 'Contact ID': '' });
                    }}
                    className={fieldClassName}
                    disabled={loadingClients}
                  >
                    <option value="">
                      {loadingClients
                        ? t('common.loading', 'Chargement...')
                        : t('missions.selectClient', 'Sélectionner un client')}
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.type === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('missions.contact', 'Interlocuteur')}
                  </label>
                  <select
                    value={formData['Contact ID']}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFormData({ ...formData, 'Contact ID': e.target.value })
                    }
                    className={`${fieldClassName} disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={!formData['Client ID'] || loadingContacts}
                  >
                    <option value="">
                      {!formData['Client ID']
                        ? t('missions.selectClientFirst', "Sélectionner d'abord un client")
                        : loadingContacts
                          ? t('common.loading', 'Chargement...')
                          : t('missions.selectContact', 'Sélectionner un interlocuteur')}
                    </option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                        {contact.role ? ` - ${contact.role}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            </aside>

            <section className="min-h-0 p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="cv-kicker mb-2">{t('missions.missionContent')}</div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--cv-text)]">
                    {t('missions.missionContent')} *
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                  {t('missions.editorHelp')}
                </p>
              </div>
              <div className="min-h-[420px] rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                {editorSlot || (
                  <div className="min-h-[400px] rounded-[1.25rem] border border-dashed border-slate-200 dark:border-white/10" />
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="cv-ghost-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="cv-gradient-button inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              {isEditing ? t('missions.update') : t('missions.create')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
