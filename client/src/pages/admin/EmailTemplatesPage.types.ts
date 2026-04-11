import type { EmailTemplate, EmailTemplateKeywords } from '../../types/entities';

export type ModalMode = 'create' | 'edit' | 'preview' | null;

export interface EmailTemplateFormState {
  name: string;
  description: string;
  subject: string;
  mjml: string;
  isDefault: boolean;
}

export interface EmailTemplatesEditModalProps {
  mode: 'create' | 'edit';
  form: EmailTemplateFormState;
  keywords: EmailTemplateKeywords | null;
  previewHtml: string;
  previewSubject: string;
  previewLoading: boolean;
  saving: boolean;
  onClose: () => void;
  onPreview: () => void;
  onSave: () => void;
  onChange: (field: keyof EmailTemplateFormState, value: string | boolean) => void;
  t: (key: string) => string;
}

export interface EmailTemplatesPreviewModalProps {
  template: EmailTemplate;
  previewHtml: string;
  previewSubject: string;
  previewLoading: boolean;
  onClose: () => void;
}

export interface DuplicateFirmOption {
  id: string;
  name: string;
}
