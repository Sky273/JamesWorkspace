import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Client, Contact, DealFormData, STATUS_CONFIG, PRIORITY_CONFIG } from './dealsTab.types';

interface DealFormModalProps {
  open: boolean;
  isEditing: boolean;
  formData: DealFormData;
  setFormData: (data: DealFormData) => void;
  clients: Client[];
  contacts: Contact[];
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onClientChange: (clientId: string) => void;
}

export default function DealFormModal({
  open,
  isEditing,
  formData,
  setFormData,
  clients,
  contacts,
  saving,
  onSubmit,
  onClose,
  onClientChange
}: DealFormModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {isEditing ? t('crm.deals.editTitle') : t('crm.deals.createTitle')}
              </h2>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('crm.deals.name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('crm.deals.client')}
                  </label>
                  <select
                    value={formData.client_id || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, client_id: e.target.value, contact_id: '' });
                      onClientChange(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">{t('crm.deals.selectClient')}</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.type === 'client' ? t('clients.types.client') : t('clients.types.prospect')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('crm.deals.contact')}
                  </label>
                  <select
                    value={formData.contact_id || ''}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={!formData.client_id}
                  >
                    <option value="">{t('crm.deals.selectContact')}</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} {contact.role ? `(${contact.role})` : ''}
                      </option>
                    ))}
                  </select>
                  {!formData.client_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('crm.deals.selectClientFirst')}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.status')}
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="open">{STATUS_CONFIG.open.label}</option>
                      <option value="won">{STATUS_CONFIG.won.label}</option>
                      <option value="lost">{STATUS_CONFIG.lost.label}</option>
                      <option value="on_hold">{STATUS_CONFIG.on_hold.label}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.priority')}
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="low">{PRIORITY_CONFIG.low.label}</option>
                      <option value="medium">{PRIORITY_CONFIG.medium.label}</option>
                      <option value="high">{PRIORITY_CONFIG.high.label}</option>
                      <option value="urgent">{PRIORITY_CONFIG.urgent.label}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.startDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.expected_start_date || ''}
                      onChange={(e) => setFormData({ ...formData, expected_start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.endDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.expected_end_date || ''}
                      onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('crm.deals.description')}
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={onClose} className="btn btn-secondary px-4 py-2">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={saving} className={`btn btn-primary px-4 py-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
