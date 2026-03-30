import { EmailTemplate, EmailTemplateContext } from '../../../types/entities';

export interface MailStatus {
  connected: boolean;
  email?: string;
  needsReauth?: boolean;
  provider?: string;
}

export interface DraftResult {
  success: boolean;
  draftId: string;
  webLink: string;
  message?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  role?: string;
  is_primary?: boolean;
}

export interface Client {
  id: string;
  name: string;
  type: string;
  contacts?: Contact[];
}

export type AttachmentFormat = 'pdf' | 'docx' | 'doc';
export type ModalStep = 'connect' | 'select' | 'sending' | 'success' | 'error';

export interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeName: string;
  resumeId: string;
  resumeTitle?: string;
  currentVersion?: number;
  onGenerateAttachment: (format: AttachmentFormat) => Promise<Blob>;
  attachmentFormat?: AttachmentFormat;
  prefilledClientId?: string;
  prefilledContactId?: string;
  missionTitle?: string;
  isAdaptation?: boolean;
}

export interface MailSelectionState {
  mailStatus: MailStatus | null;
  clients: Client[];
  loadingClients: boolean;
  selectedClientId: string;
  selectedClient: Client | null;
  selectedContactId: string;
  selectedContact: Contact | null;
  templates: EmailTemplate[];
  selectedTemplateId: string;
  selectedTemplate: EmailTemplate | null;
  loadingTemplates: boolean;
}

export type TranslateFn = (key: string, options?: unknown) => string;
export type BuildTemplateContextFn = () => EmailTemplateContext;
