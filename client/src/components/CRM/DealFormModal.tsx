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

const fieldClassName = 'w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#6246ea] focus:outline-none focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100';
const labelClassName = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[13px] border border-[#dedbe8] bg-white shadow-xl dark:border-white/10 dark:bg-[#182235]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
                {isEditing ? t('crm.deals.editTitle') : t('crm.deals.createTitle')}
              </h2>

              <form onSubmit={onSubmit} className="space-y-3.5">
                <div>
                  <label className={labelClassName}>
                    {t('crm.deals.name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={fieldClassName}
                    required
                  />
                </div>

                <div>
                  <label className={labelClassName}>
                    {t('crm.deals.client')}
                  </label>
                  <select
                    value={formData.client_id || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, client_id: e.target.value, contact_id: '' });
                      onClientChange(e.target.value);
                    }}
                    className={fieldClassName}
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
                  <label className={labelClassName}>
                    {t('crm.deals.contact')}
                  </label>
                  <select
                    value={formData.contact_id || ''}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className={fieldClassName}
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>
                      {t('crm.deals.status')}
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={fieldClassName}
                    >
                      <option value="open">{STATUS_CONFIG.open.label}</option>
                      <option value="won">{STATUS_CONFIG.won.label}</option>
                      <option value="lost">{STATUS_CONFIG.lost.label}</option>
                      <option value="on_hold">{STATUS_CONFIG.on_hold.label}</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClassName}>
                      {t('crm.deals.priority')}
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className={fieldClassName}
                    >
                      <option value="low">{PRIORITY_CONFIG.low.label}</option>
                      <option value="medium">{PRIORITY_CONFIG.medium.label}</option>
                      <option value="high">{PRIORITY_CONFIG.high.label}</option>
                      <option value="urgent">{PRIORITY_CONFIG.urgent.label}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>
                      {t('crm.deals.startDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.expected_start_date || ''}
                      onChange={(e) => setFormData({ ...formData, expected_start_date: e.target.value })}
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>
                      {t('crm.deals.endDate')}
                    </label>
                    <input
                      type="date"
                      value={formData.expected_end_date || ''}
                      onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                      className={fieldClassName}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>
                      {t('crm.deals.budgetMin')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.budget_min ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        budget_min: e.target.value === '' ? '' : Number(e.target.value)
                      })}
                      className={fieldClassName}
                      placeholder={t('crm.deals.budgetMinPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>
                      {t('crm.deals.budgetMax')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.budget_max ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        budget_max: e.target.value === '' ? '' : Number(e.target.value)
                      })}
                      className={fieldClassName}
                      placeholder={t('crm.deals.budgetMaxPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>
                    {t('crm.deals.description')}
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className={fieldClassName}
                    placeholder={t('crm.deals.descriptionPlaceholder')}
                  />
                </div>

                <div>
                  <label className={labelClassName}>
                    {t('crm.deals.notes')}
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={5}
                    className={fieldClassName}
                    placeholder={t('crm.deals.notesPlaceholder')}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={onClose} className="app-button-secondary rounded-[9px] px-4 py-2 text-sm">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={saving} className={`app-primary-action rounded-[9px] px-4 py-2 text-sm ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
