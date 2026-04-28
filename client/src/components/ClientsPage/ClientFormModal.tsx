/**
 * Client Form Modal Component
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { TFunction } from 'i18next';
import Modal from './Modal';
import { Client, ClientType, ClientStatus } from '../../types/entities';
import clientService from '../../utils/clientService';
import AdminFirmSelector from '../AdminFirmSelector';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Client> & { firm_id?: string }) => void;
  client: Client | null;
  t: TFunction;
}

const fieldClassName = 'w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#6246ea] focus:outline-none focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100';
const labelClassName = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

const ClientFormModal = ({ isOpen, onClose, onSubmit, client, t }: ClientFormModalProps): JSX.Element => {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<ClientType>('prospect');
  const [status, setStatus] = useState<ClientStatus>('active');
  const [address, setAddress] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [loadingIndustries, setLoadingIndustries] = useState<boolean>(false);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');

  // Load industries from backend
  useEffect(() => {
    const loadIndustries = async () => {
      if (isOpen) {
        setLoadingIndustries(true);
        try {
          const data = await clientService.getIndustries();
          setIndustries(data || []);
        } catch {
          // Silently fail - industries dropdown will be empty
        } finally {
          setLoadingIndustries(false);
        }
      }
    };
    loadIndustries();
  }, [isOpen]);

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setType(client.type || 'prospect');
      setStatus(client.status || 'active');
      setAddress(client.address || '');
      setWebsite(client.website || '');
      setIndustry(client.industry || '');
      setNotes(client.notes || '');
      setSelectedFirmId(client.firm_id || '');
    } else {
      setName('');
      setType('prospect');
      setStatus('active');
      setAddress('');
      setWebsite('');
      setIndustry('');
      setNotes('');
      setSelectedFirmId('');
    }
  }, [client, isOpen]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const data: Partial<Client> & { firm_id?: string } = {
      name,
      type,
      status,
      address: address || undefined,
      website: website || undefined,
      industry: industry || undefined,
      notes: notes || undefined
    };
    // Add firm_id if admin selected a firm (for both new and edited clients)
    if (selectedFirmId) {
      data.firm_id = selectedFirmId;
    }
    onSubmit(data);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={client ? t('clients.modal.editClient') : t('clients.modal.addClient')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Admin Firm Selector - visible for admins */}
        <AdminFirmSelector
          selectedFirmId={selectedFirmId}
          onFirmChange={setSelectedFirmId}
          className="mb-2"
          t={t}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClassName}>
              {t('clients.modal.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className={fieldClassName}
              required
            />
          </div>

          <div>
            <label className={labelClassName}>
              {t('clients.modal.type')} *
            </label>
            <select
              value={type}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value as ClientType)}
              className={fieldClassName}
            >
              <option value="prospect">{t('clients.types.prospect')}</option>
              <option value="client">{t('clients.types.client')}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('clients.modal.status')}
            </label>
            <select
              value={status}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as ClientStatus)}
              className={fieldClassName}
            >
              <option value="active">{t('clients.status.active')}</option>
              <option value="inactive">{t('clients.status.inactive')}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('clients.modal.industry')}
            </label>
            <select
              value={industry}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setIndustry(e.target.value)}
              className={fieldClassName}
              disabled={loadingIndustries}
            >
              <option value="">{loadingIndustries ? t('common.loading') : t('clients.modal.selectIndustry')}</option>
              {industries.map((ind: string) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('clients.modal.website')}
            </label>
            <input
              type="url"
              value={website}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
              className={fieldClassName}
              placeholder="https://"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClassName}>
              {t('clients.modal.address')}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
              className={fieldClassName}
              placeholder={t('clients.modal.addressPlaceholder')}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClassName}>
              {t('clients.modal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              rows={3}
              className={fieldClassName}
              placeholder={t('clients.modal.notesPlaceholder')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="app-button-secondary rounded-[9px] px-4 py-2 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="app-primary-action rounded-[9px] px-4 py-2 text-sm"
          >
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ClientFormModal;
