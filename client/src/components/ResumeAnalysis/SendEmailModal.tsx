/**
 * Send Email Modal Component
 * Modal for sending CV via email (Gmail OAuth)
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, EnvelopeIcon, CheckCircleIcon, ExclamationCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import mailService from '../../utils/mailService';
import clientService from '../../utils/clientService';
import emailTemplateService from '../../services/emailTemplateService';
import { authPost } from '../../utils/apiInterceptor';
import { EmailTemplate, EmailTemplateContext } from '../../types/entities';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger.frontend';

interface MailStatus {
  connected: boolean;
  email?: string;
  needsReauth?: boolean;
  provider?: string;
}

interface DraftResult {
  success: boolean;
  draftId: string;
  webLink: string;
  message?: string;
}

interface Client {
  id: string;
  name: string;
  type: string;
  contacts?: Contact[];
}

interface Contact {
  id: string;
  name: string;
  email: string;
  role?: string;
  is_primary?: boolean;
}

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeName: string;
  resumeId: string;
  resumeTitle?: string;
  currentVersion?: number;
  onGeneratePdf: () => Promise<Blob>;
}

type ModalStep = 'connect' | 'select' | 'sending' | 'success' | 'error';

const SendEmailModal = ({ isOpen, onClose, resumeName, resumeId, resumeTitle, currentVersion, onGeneratePdf }: SendEmailModalProps): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Connection state
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  // Selection state
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  
  // UI state
  const [step, setStep] = useState<ModalStep>('connect');
  const [sending, setSending] = useState(false);
  const [draftLink, setDraftLink] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check mail connection status
  const checkMailStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await mailService.getStatus() as MailStatus;
      setMailStatus(status);
      if (status.connected && !status.needsReauth) {
        setStep('select');
      } else {
        setStep('connect');
      }
    } catch (error) {
      logger.error('Error checking mail status:', error);
      setMailStatus({ connected: false });
      setStep('connect');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Load clients
  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const result = await clientService.getClients({ pageSize: 100 });
      setClients(result.clients || []);
    } catch (error) {
      logger.error('Error loading clients:', error);
      toast.error(t('mail.errors.loadClients'));
    } finally {
      setLoadingClients(false);
    }
  }, [t]);

  // Load email templates
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const templatesData = await emailTemplateService.getTemplates();
      setTemplates(templatesData);
      // Auto-select default template
      const defaultTemplate = templatesData.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      logger.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Load client details with contacts
  const loadClientDetails = useCallback(async (clientId: string) => {
    try {
      const client = await clientService.getClient(clientId);
      setSelectedClient(client);
      setSelectedContactId('');
      setSelectedContact(null);
    } catch (error) {
      logger.error('Error loading client details:', error);
    }
  }, []);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      checkMailStatus();
      loadClients();
      loadTemplates();
    }
  }, [isOpen, checkMailStatus, loadClients, loadTemplates]);

  // Update selected template when template ID changes
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, templates]);

  // Build template context
  const buildTemplateContext = useCallback((): EmailTemplateContext => {
    return {
      client: selectedClient ? {
        name: selectedClient.name,
        type: selectedClient.type,
        industry: ''
      } : undefined,
      contact: selectedContact ? {
        name: selectedContact.name,
        role: selectedContact.role
      } : undefined,
      resume: {
        name: resumeName,
        title: resumeTitle || '',
        version: currentVersion || 1
      },
      firm: {
        name: user?.FirmName || '',
        logo: user?.FirmLogo || ''
      },
      user: {
        name: user?.name || '',
        email: user?.email || '',
        jobTitle: user?.jobTitle || '',
        phone: user?.phone || ''
      }
    };
  }, [selectedClient, selectedContact, resumeName, resumeTitle, currentVersion, user]);

  // Preview template
  const handlePreviewTemplate = async () => {
    if (!selectedTemplateId) return;
    
    try {
      const context = buildTemplateContext();
      const result = await emailTemplateService.previewTemplate(selectedTemplateId, context);
      setPreviewHtml(result.html);
      setShowPreview(true);
    } catch (error) {
      logger.error('Error previewing template:', error);
      toast.error(t('mail.errors.previewFailed'));
    }
  };

  // Load client details when selection changes
  useEffect(() => {
    if (selectedClientId) {
      loadClientDetails(selectedClientId);
    } else {
      setSelectedClient(null);
      setSelectedContactId('');
      setSelectedContact(null);
    }
  }, [selectedClientId, loadClientDetails]);

  // Update selected contact when contact ID changes
  useEffect(() => {
    if (selectedContactId && selectedClient?.contacts) {
      const contact = selectedClient.contacts.find(c => c.id === selectedContactId);
      setSelectedContact(contact || null);
    } else {
      setSelectedContact(null);
    }
  }, [selectedContactId, selectedClient]);

  // Handle Gmail connection
  const handleConnectGmail = async () => {
    try {
      await mailService.connectGmail();
      // Will redirect to OAuth
    } catch (error) {
      logger.error('Error connecting Gmail:', error);
      toast.error(t('mail.errors.connectFailed'));
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!selectedContact?.email) {
      toast.error(t('mail.errors.noEmail'));
      return;
    }

    setSending(true);
    setStep('sending');

    try {
      // Generate PDF
      const pdfBlob = await onGeneratePdf();
      
      // Convert to base64
      const reader = new FileReader();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      // Create draft with submission tracking and template
      logger.info('Creating draft with submission tracking', { resumeId, clientId: selectedClientId, contactId: selectedContactId, currentVersion, templateId: selectedTemplateId });
      
      // Build template context if template is selected
      const hasTemplate = selectedTemplateId && selectedTemplateId.length > 0;
      const templateContext = hasTemplate ? buildTemplateContext() : undefined;
      
      // Debug: log template info
      logger.info('Template info for draft', { 
        hasTemplate, 
        selectedTemplateId, 
        templateContext,
        selectedTemplate: selectedTemplate ? { id: selectedTemplate.id, name: selectedTemplate.name } : null
      });
      
      // Build draft params with submission tracking and template
      const draftParams: Record<string, unknown> = {
        to: selectedContact.email,
        subject: selectedTemplate?.subject_template || resumeName,
        body: '',
        pdfBase64,
        pdfFilename: `${resumeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        resumeId,
        clientId: selectedClientId,
        contactId: selectedContactId,
        versionNumber: currentVersion,
        templateId: hasTemplate ? selectedTemplateId : undefined,
        templateContext
      };
      
      logger.info('Draft params being sent (direct API call)', { 
        to: draftParams.to, 
        subject: draftParams.subject,
        hasTemplateId: !!draftParams.templateId,
        hasTemplateContext: !!draftParams.templateContext,
        templateId: draftParams.templateId
      });
      
      // Direct API call to bypass mailService cache issue
      const response = await authPost('/api/mail/draft', draftParams);
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.needsReauth) {
          throw new Error('NEEDS_REAUTH');
        }
        throw new Error(errorData.error || 'Failed to create draft');
      }
      const result = await response.json() as DraftResult;
      logger.info('Draft created, result:', result);

      setDraftLink(result.webLink);
      setStep('success');
      toast.success(t('mail.success.draftCreated'));

    } catch (error) {
      logger.error('Error sending email:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMsg === 'NEEDS_REAUTH') {
        setErrorMessage(t('mail.errors.needsReauth'));
        setMailStatus({ connected: false, needsReauth: true });
        setStep('connect');
      } else {
        setErrorMessage(errorMsg);
        setStep('error');
      }
    } finally {
      setSending(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await mailService.disconnect();
      setMailStatus({ connected: false });
      setStep('connect');
      toast.success(t('mail.success.disconnected'));
    } catch (error) {
      logger.error('Error disconnecting:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('mail.modal.title')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {loadingStatus ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : step === 'connect' ? (
              <div className="text-center py-6">
                <EnvelopeIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('mail.modal.connectTitle')}
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t('mail.modal.connectDescription')}
                </p>
                <button
                  onClick={handleConnectGmail}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"/>
                  </svg>
                  {t('mail.modal.connectGmail')}
                </button>
              </div>
            ) : step === 'select' ? (
              <div className="space-y-4">
                {/* Connected email */}
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-700 dark:text-green-400">
                      {t('mail.modal.connectedAs', { email: mailStatus?.email })}
                    </span>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {t('mail.modal.disconnect')}
                  </button>
                </div>

                {/* Client selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('mail.modal.selectClient')}
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={loadingClients}
                  >
                    <option value="">{loadingClients ? t('common.loading') : t('mail.modal.chooseClient')}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contact selection */}
                {selectedClient && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('mail.modal.selectContact')}
                    </label>
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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

                {/* Template selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('mail.modal.selectTemplate')}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={loadingTemplates}
                    >
                      <option value="">{loadingTemplates ? t('common.loading') : t('mail.modal.noTemplate')}</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} {template.is_default ? `(${t('mail.modal.default')})` : ''} {template.is_system ? `[${t('mail.modal.system')}]` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedTemplateId && (
                      <button
                        type="button"
                        onClick={handlePreviewTemplate}
                        className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        title={t('mail.modal.previewTemplate')}
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Email preview */}
                {selectedContact?.email && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>{t('mail.modal.to')}:</strong> {selectedContact.email}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>{t('mail.modal.subject')}:</strong> {selectedTemplate?.subject_template || resumeName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>{t('mail.modal.attachment')}:</strong> {resumeName}.pdf
                    </p>
                    {selectedTemplate && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>{t('mail.modal.template')}:</strong> {selectedTemplate.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : step === 'sending' ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">{t('mail.modal.creating')}</p>
              </div>
            ) : step === 'success' ? (
              <div className="text-center py-6">
                <CheckCircleIcon className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('mail.modal.successTitle')}
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t('mail.modal.successDescription')}
                </p>
                <a
                  href={draftLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500 text-gray-700 dark:text-gray-200 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105 group"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                  </svg>
                  <span className="group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors">
                    {t('mail.modal.openDraft')}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            ) : step === 'error' ? (
              <div className="text-center py-6">
                <ExclamationCircleIcon className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('mail.modal.errorTitle')}
                </h4>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setStep('select')}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  {t('mail.modal.retry')}
                </button>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          {step === 'select' && (
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedContact?.email || sending}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedContact?.email && !sending
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {t('mail.modal.createDraft')}
              </button>
            </div>
          )}

          {(step === 'success' || step === 'error') && (
            <div className="flex justify-center p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Template Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('mail.modal.templatePreview')}
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    title="Email Preview"
                    className="w-full h-[500px] border-0"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    {t('mail.modal.loadingPreview')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendEmailModal;
