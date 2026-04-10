import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const stableT = (key: string) => key;

const getStatusMock = vi.fn();
const getClientsMock = vi.fn();
const getClientMock = vi.fn();
const getTemplatesMock = vi.fn();
const previewTemplateMock = vi.fn();
const authPostMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

vi.mock('../../utils/mailService', () => ({
  default: {
    getStatus: (...args: unknown[]) => getStatusMock(...args),
    connectGmail: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('../../utils/clientService', () => ({
  default: {
    getClients: (...args: unknown[]) => getClientsMock(...args),
    getClient: (...args: unknown[]) => getClientMock(...args),
  },
}));

vi.mock('../../services/emailTemplateService', () => ({
  default: {
    getTemplates: (...args: unknown[]) => getTemplatesMock(...args),
    previewTemplate: (...args: unknown[]) => previewTemplateMock(...args),
  },
}));

vi.mock('../../utils/apiInterceptor', () => ({
  authPost: (...args: unknown[]) => authPostMock(...args),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      name: 'Luc',
      email: 'luc@example.com',
      firmName: 'ResumeConverter',
      firmLogo: '',
      google_id: 'google-user',
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('./sendEmail/SendEmailModalHeader', () => ({
  default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>close-modal</button>,
}));

vi.mock('./sendEmail/SendEmailConnectStep', () => ({
  default: () => <div>connect-step</div>,
}));

vi.mock('./sendEmail/SendEmailSelectStep', () => ({
  default: ({
    clients,
    selectedClientId,
    onClientChange,
    selectedClient,
    selectedContactId,
    onContactChange,
    templates,
    selectedTemplateId,
    onTemplateChange,
    onPreviewTemplate,
  }: {
    clients: Array<{ id: string; name: string }>;
    selectedClientId: string;
    onClientChange: (id: string) => void;
    selectedClient: { contacts?: Array<{ id: string; name: string; email: string }> } | null;
    selectedContactId: string;
    onContactChange: (id: string) => void;
    templates: Array<{ id: string; name: string }>;
    selectedTemplateId: string;
    onTemplateChange: (id: string) => void;
    onPreviewTemplate: () => void;
  }) => (
    <div>
      <select aria-label="client-select" value={selectedClientId} onChange={(e) => onClientChange(e.target.value)}>
        <option value="">none</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.name}</option>
        ))}
      </select>
      <select aria-label="contact-select" value={selectedContactId} onChange={(e) => onContactChange(e.target.value)}>
        <option value="">none</option>
        {(selectedClient?.contacts || []).map((contact) => (
          <option key={contact.id} value={contact.id}>{contact.name}</option>
        ))}
      </select>
      <select aria-label="template-select" value={selectedTemplateId} onChange={(e) => onTemplateChange(e.target.value)}>
        <option value="">none</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>{template.name}</option>
        ))}
      </select>
      <button onClick={onPreviewTemplate}>preview-template</button>
    </div>
  ),
}));

vi.mock('./sendEmail/SendEmailStatusStep', () => ({
  default: ({ step, draftLink }: { step: string; draftLink: string }) => <div>{step}:{draftLink}</div>,
}));

vi.mock('./sendEmail/SendEmailPreviewModal', () => ({
  default: ({ isOpen, sanitizedPreviewHtml }: { isOpen: boolean; sanitizedPreviewHtml: string }) =>
    isOpen ? <div>{sanitizedPreviewHtml}</div> : null,
}));

import SendEmailModal from './SendEmailModal';

describe('SendEmailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads mail status, previews a template, and creates a draft', async () => {
    getStatusMock.mockResolvedValue({ connected: true, email: 'sender@example.com' });
    getClientsMock.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Acme', type: 'client' }],
    });
    getClientMock.mockResolvedValue({
      id: 'client-1',
      name: 'Acme',
      type: 'client',
      contacts: [{ id: 'contact-1', name: 'Jane', email: 'jane@example.com' }],
    });
    getTemplatesMock.mockResolvedValue([
      { id: 'template-1', name: 'Template A', subject_template: 'Sujet' },
    ]);
    previewTemplateMock.mockResolvedValue({ html: '<div>Preview</div>' });
    authPostMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        draftId: 'draft-1',
        webLink: 'https://mail.google.com/draft-1',
      }),
    });

    render(
      <SendEmailModal
        isOpen
        onClose={vi.fn()}
        resumeName="Ada Lovelace"
        resumeId="resume-1"
        resumeTitle="Product Owner"
        currentVersion={2}
        onGenerateAttachment={vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('client-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('client-select'), { target: { value: 'client-1' } });
    await waitFor(() => {
      expect(getClientMock).toHaveBeenCalledWith('client-1');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('contact-select')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('contact-select'), { target: { value: 'contact-1' } });
    await waitFor(() => {
      expect(screen.getByLabelText('template-select')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('template-select'), { target: { value: 'template-1' } });

    fireEvent.click(screen.getByText('preview-template'));
    await waitFor(() => {
      expect(screen.getByText('<div>Preview</div>')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'mail.modal.createDraft' }));
    await waitFor(() => {
      expect(authPostMock).toHaveBeenCalled();
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('mail.success.draftCreated');
  });

  it('surfaces a preview error when the template preview fails', async () => {
    getStatusMock.mockResolvedValue({ connected: true, email: 'sender@example.com' });
    getClientsMock.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Acme', type: 'client' }],
    });
    getClientMock.mockResolvedValue({
      id: 'client-1',
      name: 'Acme',
      type: 'client',
      contacts: [{ id: 'contact-1', name: 'Jane', email: 'jane@example.com' }],
    });
    getTemplatesMock.mockResolvedValue([
      { id: 'template-1', name: 'Template A', subject_template: 'Sujet' },
    ]);
    previewTemplateMock.mockRejectedValue(new Error('preview failed'));

    render(
      <SendEmailModal
        isOpen
        onClose={vi.fn()}
        resumeName="Ada Lovelace"
        resumeId="resume-1"
        onGenerateAttachment={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('client-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('client-select'), { target: { value: 'client-1' } });
    await waitFor(() => {
      expect(getClientMock).toHaveBeenCalledWith('client-1');
    });
    fireEvent.change(screen.getByLabelText('contact-select'), { target: { value: 'contact-1' } });
    fireEvent.change(screen.getByLabelText('template-select'), { target: { value: 'template-1' } });

    fireEvent.click(screen.getByText('preview-template'));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('mail.errors.previewFailed');
    });
  });

  it('returns to the connect step when draft creation requires reauthentication', async () => {
    getStatusMock.mockResolvedValue({ connected: true, email: 'sender@example.com' });
    getClientsMock.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Acme', type: 'client' }],
    });
    getClientMock.mockResolvedValue({
      id: 'client-1',
      name: 'Acme',
      type: 'client',
      contacts: [{ id: 'contact-1', name: 'Jane', email: 'jane@example.com' }],
    });
    getTemplatesMock.mockResolvedValue([
      { id: 'template-1', name: 'Template A', subject_template: 'Sujet' },
    ]);
    authPostMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'need reauth',
        needsReauth: true,
      }),
    });

    render(
      <SendEmailModal
        isOpen
        onClose={vi.fn()}
        resumeName="Ada Lovelace"
        resumeId="resume-1"
        currentVersion={2}
        onGenerateAttachment={vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('client-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('client-select'), { target: { value: 'client-1' } });
    await waitFor(() => {
      expect(getClientMock).toHaveBeenCalledWith('client-1');
    });
    fireEvent.change(screen.getByLabelText('contact-select'), { target: { value: 'contact-1' } });
    fireEvent.change(screen.getByLabelText('template-select'), { target: { value: 'template-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'mail.modal.createDraft' }));

    await waitFor(() => {
      expect(screen.getByText('connect-step')).toBeInTheDocument();
    });
  });

  it('starts in connect mode when Gmail is not connected', async () => {
    getStatusMock.mockResolvedValue({ connected: false });
    getClientsMock.mockResolvedValue({ clients: [] });
    getTemplatesMock.mockResolvedValue([]);

    render(
      <SendEmailModal
        isOpen
        onClose={vi.fn()}
        resumeName="Ada Lovelace"
        resumeId="resume-1"
        onGenerateAttachment={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('connect-step')).toBeInTheDocument();
    });
  });

  it('disables draft creation when the selected contact has no email', async () => {
    getStatusMock.mockResolvedValue({ connected: true, email: 'sender@example.com' });
    getClientsMock.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Acme', type: 'client' }],
    });
    getClientMock.mockResolvedValue({
      id: 'client-1',
      name: 'Acme',
      type: 'client',
      contacts: [{ id: 'contact-1', name: 'Jane', email: '' }],
    });
    getTemplatesMock.mockResolvedValue([
      { id: 'template-1', name: 'Template A', subject_template: 'Sujet' },
    ]);

    render(
      <SendEmailModal
        isOpen
        onClose={vi.fn()}
        resumeName="Ada Lovelace"
        resumeId="resume-1"
        onGenerateAttachment={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('client-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('client-select'), { target: { value: 'client-1' } });
    await waitFor(() => {
      expect(getClientMock).toHaveBeenCalledWith('client-1');
    });
    fireEvent.change(screen.getByLabelText('contact-select'), { target: { value: 'contact-1' } });
    fireEvent.change(screen.getByLabelText('template-select'), { target: { value: 'template-1' } });

    expect(screen.getByRole('button', { name: 'mail.modal.createDraft' })).toBeDisabled();
  });
});
