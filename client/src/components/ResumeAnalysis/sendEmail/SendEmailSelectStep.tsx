import { CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Client, Contact, TranslateFn } from './types';
import { EmailTemplate } from '../../../types/entities';

interface SendEmailSelectStepProps {
  connectedEmail?: string;
  isGoogleSsoUser: boolean;
  clients: Client[];
  loadingClients: boolean;
  selectedClientId: string;
  selectedClient: Client | null;
  selectedContactId: string;
  selectedContact: Contact | null;
  templates: EmailTemplate[];
  loadingTemplates: boolean;
  selectedTemplateId: string;
  selectedTemplate: EmailTemplate | null;
  resumeName: string;
  onDisconnect: () => void;
  onClientChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onPreviewTemplate: () => void;
  t: TranslateFn;
}

export default function SendEmailSelectStep({
  connectedEmail,
  isGoogleSsoUser,
  clients,
  loadingClients,
  selectedClientId,
  selectedClient,
  selectedContactId,
  selectedContact,
  templates,
  loadingTemplates,
  selectedTemplateId,
  selectedTemplate,
  resumeName,
  onDisconnect,
  onClientChange,
  onContactChange,
  onTemplateChange,
  onPreviewTemplate,
  t,
}: SendEmailSelectStepProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400">{t('mail.modal.connectedAs', { email: connectedEmail })}</span>
        </div>
        {!isGoogleSsoUser && (
          <button onClick={onDisconnect} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
            {t('mail.modal.disconnect')}
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('mail.modal.selectClient')}</label>
        <select
          value={selectedClientId}
          onChange={(e) => onClientChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          disabled={loadingClients}
        >
          <option value="">{loadingClients ? t('common.loading') : t('mail.modal.chooseClient')}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name} ({client.type})</option>
          ))}
        </select>
      </div>

      {selectedClient && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('mail.modal.selectContact')}</label>
          <select
            value={selectedContactId}
            onChange={(e) => onContactChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('mail.modal.chooseContact')}</option>
            {selectedClient.contacts?.map((contact) => (
              <option key={contact.id} value={contact.id} disabled={!contact.email}>
                {contact.name} {contact.role ? `(${contact.role})` : ''} - {contact.email || t('mail.modal.noEmail')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('mail.modal.selectTemplate')} *</label>
        <div className="flex gap-2">
          <select
            value={selectedTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            disabled={loadingTemplates}
          >
            <option value="" disabled>{loadingTemplates ? t('common.loading') : t('mail.modal.chooseTemplate', { defaultValue: 'Choisir un template' })}</option>
            {templates.filter(template => !template.is_system).map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={onPreviewTemplate}
              className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              title={t('mail.modal.previewTemplate')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" /></svg>
            </button>
          )}
        </div>
      </div>

      {selectedContact?.email && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400"><strong>{t('mail.modal.to')}:</strong> {selectedContact.email}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400"><strong>{t('mail.modal.subject')}:</strong> {selectedTemplate?.subject_template || resumeName}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400"><strong>{t('mail.modal.attachment')}:</strong> {resumeName}.pdf</p>
          {selectedTemplate && (
            <p className="text-sm text-gray-600 dark:text-gray-400"><strong>{t('mail.modal.template')}:</strong> {selectedTemplate.name}</p>
          )}
        </div>
      )}
    </div>
  );
}
