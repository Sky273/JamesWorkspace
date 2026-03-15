/**
 * MissionFormModal - Create/edit mission modal with TinyMCE
 * Extracted from MissionsPage.tsx
 */

import { FormEvent, ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
}

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
  onClose
}: MissionFormModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? t('missions.editMission') : t('missions.addMission')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 overflow-y-auto max-h-[70vh]">
          {/* Admin Firm Selector - only visible for admins when creating */}
          <AdminFirmSelector
            selectedFirmId={formData['Firm ID']}
            onFirmChange={(firmId) => setFormData({ ...formData, 'Firm ID': firmId })}
            className="mb-4"
            t={t}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('missions.missionTitle')} *
              </label>
              <input
                type="text"
                required
                value={formData.Title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, Title: e.target.value })}
                placeholder={t('missions.titlePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('missions.missionStatus')}
              </label>
              <select
                value={formData.Status}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, Status: e.target.value as 'Active' | 'Closed' | 'Draft' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="Active">{t('missions.status.Active')}</option>
                <option value="Draft">{t('missions.status.Draft')}</option>
                <option value="Closed">{t('missions.status.Closed')}</option>
              </select>
            </div>
          </div>

          {/* Deal Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('missions.deal', 'Affaire')}
            </label>
            <select
              value={formData['Deal ID']}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, 'Deal ID': e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              disabled={loadingDeals}
            >
              <option value="">{loadingDeals ? t('common.loading', 'Chargement...') : t('missions.selectDeal', 'Aucune affaire (optionnel)')}</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}{deal.client_name ? ` — ${deal.client_name}` : ''} ({deal.status})
                </option>
              ))}
            </select>
          </div>

          {/* Client and Contact Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('missions.client', 'Client / Prospect')}
              </label>
              <select
                value={formData['Client ID']}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setFormData({ ...formData, 'Client ID': e.target.value, 'Contact ID': '' });
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loadingClients}
              >
                <option value="">{loadingClients ? t('common.loading', 'Chargement...') : t('missions.selectClient', 'Sélectionner un client')}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.type === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('missions.contact', 'Interlocuteur')}
              </label>
              <select
                value={formData['Contact ID']}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, 'Contact ID': e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={!formData['Client ID'] || loadingContacts}
              >
                <option value="">
                  {!formData['Client ID'] 
                    ? t('missions.selectClientFirst', 'Sélectionner d\'abord un client') 
                    : loadingContacts 
                    ? t('common.loading', 'Chargement...') 
                    : t('missions.selectContact', 'Sélectionner un interlocuteur')}
                </option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}{contact.role ? ` - ${contact.role}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('missions.missionContent')} *
            </label>
            <div id="missionContentEditor" className="border border-gray-300 dark:border-gray-600 rounded-lg"></div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('missions.editorHelp')}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              {isEditing ? t('missions.update') : t('missions.create')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
