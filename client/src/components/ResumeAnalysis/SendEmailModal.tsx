import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import mailService from '../../utils/mailService';
import clientService from '../../utils/clientService';
import emailTemplateService from '../../services/emailTemplateService';
import { authPost } from '../../utils/apiInterceptor';
import { EmailTemplate, EmailTemplateContext } from '../../types/entities';
import { useAuth } from '../../context/AuthContext';
import logger from '../../utils/logger.frontend';
import SendEmailModalHeader from './sendEmail/SendEmailModalHeader';
import SendEmailConnectStep from './sendEmail/SendEmailConnectStep';
import SendEmailSelectStep from './sendEmail/SendEmailSelectStep';
import SendEmailStatusStep from './sendEmail/SendEmailStatusStep';
import SendEmailPreviewModal from './sendEmail/SendEmailPreviewModal';
import type {
  AttachmentFormat,
  Client,
  DraftResult,
  MailStatus,
  ModalStep,
  SendEmailModalProps,
  Contact,
  TranslateFn,
} from './sendEmail/types';

const SendEmailModal = ({
  isOpen,
  onClose,
  resumeName,
  resumeId,
  resumeTitle,
  currentVersion,
  onGenerateAttachment,
  attachmentFormat = 'pdf',
  prefilledClientId,
  prefilledContactId,
}: SendEmailModalProps): JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tr = useCallback<TranslateFn>((key: string, options?: unknown) => String(t(key, options as never)), [t]);

  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [step, setStep] = useState<ModalStep>('connect');
  const [sending, setSending] = useState(false);
  const [draftLink, setDraftLink] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const sanitizedPreviewHtml = useMemo(() => {
    if (!previewHtml) return '';
    return previewHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '');
  }, [previewHtml]);

  const checkMailStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await mailService.getStatus() as MailStatus;
      setMailStatus(status);
      setStep(status.connected && !status.needsReauth ? 'select' : 'connect');
    } catch (error) {
      logger.error('Error checking mail status:', error);
      setMailStatus({ connected: false });
      setStep('connect');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

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

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const templatesData = await emailTemplateService.getTemplates();
      setTemplates(templatesData);
      setSelectedTemplateId('');
      setSelectedTemplate(null);
    } catch (error) {
      logger.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

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

  useEffect(() => {
    if (isOpen) {
      void checkMailStatus();
      void loadClients();
      void loadTemplates();
    }
  }, [isOpen, checkMailStatus, loadClients, loadTemplates]);

  useEffect(() => {
    if (isOpen && prefilledClientId && clients.length > 0) {
      const client = clients.find(c => c.id === prefilledClientId);
      if (client) {
        setSelectedClientId(prefilledClientId);
        void loadClientDetails(prefilledClientId);
      }
    }
  }, [isOpen, prefilledClientId, clients, loadClientDetails]);

  useEffect(() => {
    if (prefilledContactId && selectedClient?.contacts) {
      const contact = selectedClient.contacts.find(c => c.id === prefilledContactId);
      if (contact) {
        setSelectedContactId(prefilledContactId);
        setSelectedContact(contact);
      }
    }
  }, [prefilledContactId, selectedClient]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(templateItem => templateItem.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (selectedClientId) {
      void loadClientDetails(selectedClientId);
    } else {
      setSelectedClient(null);
      setSelectedContactId('');
      setSelectedContact(null);
    }
  }, [selectedClientId, loadClientDetails]);

  useEffect(() => {
    if (selectedContactId && selectedClient?.contacts) {
      const contact = selectedClient.contacts.find(c => c.id === selectedContactId);
      setSelectedContact(contact || null);
    } else {
      setSelectedContact(null);
    }
  }, [selectedContactId, selectedClient]);

  const buildTemplateContext = useCallback((): EmailTemplateContext => {
    return {
      client: selectedClient ? { name: selectedClient.name, type: selectedClient.type, industry: '' } : undefined,
      contact: selectedContact ? { name: selectedContact.name, role: selectedContact.role } : undefined,
      resume: { name: resumeName, title: resumeTitle || '', version: currentVersion || 1 },
      firm: { name: user?.firm || '', logo: user?.firmLogo || '' },
      user: { name: user?.name || '', email: user?.email || '', jobTitle: user?.jobTitle || '', phone: user?.phone || '' }
    };
  }, [selectedClient, selectedContact, resumeName, resumeTitle, currentVersion, user]);

  const handlePreviewTemplate = useCallback(async () => {
    if (!selectedTemplateId) return;
    try {
      const result = await emailTemplateService.previewTemplate(selectedTemplateId, buildTemplateContext());
      setPreviewHtml(result.html);
      setShowPreview(true);
    } catch (error) {
      logger.error('Error previewing template:', error);
      toast.error(t('mail.errors.previewFailed'));
    }
  }, [buildTemplateContext, selectedTemplateId, t]);

  const handleConnectGmail = useCallback(async () => {
    try {
      await mailService.connectGmail();
    } catch (error) {
      logger.error('Error connecting Gmail:', error);
      toast.error(t('mail.errors.connectFailed'));
    }
  }, [t]);

  const handleSend = useCallback(async () => {
    if (!selectedContact?.email) {
      toast.error(t('mail.errors.noEmail'));
      return;
    }

    setSending(true);
    setStep('sending');

    try {
      const attachmentBlob = await onGenerateAttachment(attachmentFormat as AttachmentFormat);
      const reader = new FileReader();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(attachmentBlob);
      });

      logger.info('Creating draft with submission tracking', { resumeId, clientId: selectedClientId, contactId: selectedContactId, currentVersion, templateId: selectedTemplateId });

      const hasTemplate = Boolean(selectedTemplateId && selectedTemplateId.length > 0);
      const templateContext = hasTemplate ? buildTemplateContext() : undefined;

      logger.info('Template info for draft', {
        hasTemplate,
        selectedTemplateId,
        templateContext,
        selectedTemplate: selectedTemplate ? { id: selectedTemplate.id, name: selectedTemplate.name } : null
      });

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
  }, [attachmentFormat, buildTemplateContext, currentVersion, onGenerateAttachment, resumeId, resumeName, selectedContact, selectedClientId, selectedContactId, selectedTemplate, selectedTemplateId, t]);

  const handleDisconnect = useCallback(async () => {
    try {
      await mailService.disconnect();
      setMailStatus({ connected: false });
      setStep('connect');
      toast.success(t('mail.success.disconnected'));
    } catch (error) {
      logger.error('Error disconnecting:', error);
    }
  }, [t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform transition-all">
          <SendEmailModalHeader onClose={onClose} t={tr} />

          <div className="p-4">
            {loadingStatus ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : step === 'connect' ? (
              <SendEmailConnectStep
                isGoogleSsoUser={Boolean(user?.google_id)}
                onConnectGmail={handleConnectGmail}
                onReconnectApp={() => { window.location.href = '/signin'; }}
                t={tr}
              />
            ) : step === 'select' ? (
              <SendEmailSelectStep
                connectedEmail={mailStatus?.email}
                isGoogleSsoUser={Boolean(user?.google_id)}
                clients={clients}
                loadingClients={loadingClients}
                selectedClientId={selectedClientId}
                selectedClient={selectedClient}
                selectedContactId={selectedContactId}
                selectedContact={selectedContact}
                templates={templates}
                loadingTemplates={loadingTemplates}
                selectedTemplateId={selectedTemplateId}
                selectedTemplate={selectedTemplate}
                resumeName={resumeName}
                onDisconnect={handleDisconnect}
                onClientChange={setSelectedClientId}
                onContactChange={setSelectedContactId}
                onTemplateChange={setSelectedTemplateId}
                onPreviewTemplate={handlePreviewTemplate}
                t={tr}
              />
            ) : (
              <SendEmailStatusStep step={step} draftLink={draftLink} errorMessage={errorMessage} onRetry={() => setStep('select')} t={tr} />
            )}
          </div>

          {step === 'select' && (
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedContact?.email || !selectedTemplateId || sending}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedContact?.email && selectedTemplateId && !sending ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                {t('mail.modal.createDraft')}
              </button>
            </div>
          )}

          {(step === 'success' || step === 'error') && (
            <div className="flex justify-center p-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={onClose} className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                {t('common.close')}
              </button>
            </div>
          )}
        </div>
      </div>

      <SendEmailPreviewModal isOpen={showPreview} sanitizedPreviewHtml={sanitizedPreviewHtml} onClose={() => setShowPreview(false)} t={tr} />
    </div>
  );
};

export default SendEmailModal;
