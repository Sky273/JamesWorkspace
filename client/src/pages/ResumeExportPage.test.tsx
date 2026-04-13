import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumeExportPage from './ResumeExportPage';

const {
  setCurrentResumeMock,
  getResumeMock,
  getAllTemplatesMock,
  getTemplateByIdMock,
  createAuthOptionsWithCsrfMock,
  fetchWithCsrfRetryMock,
  toastSuccessMock,
  toastErrorMock,
  removeSuggestionMarkersMock,
  createObjectURLMock,
  revokeObjectURLMock,
  removeMock,
  clickMock,
} = vi.hoisted(() => ({
  setCurrentResumeMock: vi.fn(),
  getResumeMock: vi.fn(),
  getAllTemplatesMock: vi.fn(),
  getTemplateByIdMock: vi.fn(),
  createAuthOptionsWithCsrfMock: vi.fn(),
  fetchWithCsrfRetryMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  removeSuggestionMarkersMock: vi.fn((value: string) => value.replace(/\[\[suggestion\]\]/g, '')),
  createObjectURLMock: vi.fn(() => 'blob:resume-export'),
  revokeObjectURLMock: vi.fn(),
  removeMock: vi.fn(),
  clickMock: vi.fn(),
}));

type ResumeLike = Record<string, unknown> & { id: string };

let resumeContextValue: {
  currentResume: ResumeLike | null;
  setCurrentResume: typeof setCurrentResumeMock;
  resumes: ResumeLike[];
};

let routeParams = { id: 'resume-1' };

vi.mock('../context/ResumeContext', () => ({
  useResume: () => resumeContextValue,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
  };
});

vi.mock('../utils/resumeService', () => ({
  resumeService: {
    getResume: getResumeMock,
  },
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    getAllTemplates: getAllTemplatesMock,
    getTemplateById: getTemplateByIdMock,
  },
}));

vi.mock('../utils/apiInterceptor', () => ({
  createAuthOptionsWithCsrf: createAuthOptionsWithCsrfMock,
  fetchWithCsrfRetry: fetchWithCsrfRetryMock,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../components/TiptapEditor', async () => {
  const actual = await vi.importActual<typeof import('../components/TiptapEditor')>('../components/TiptapEditor');
  return {
    ...actual,
    removeSuggestionMarkers: removeSuggestionMarkersMock,
  };
});

vi.mock('./resumeDocumentPayload', async () => {
  const actual = await vi.importActual<typeof import('./resumeDocumentPayload')>('./resumeDocumentPayload');
  return {
    ...actual,
    buildExportPayload: (resume: Record<string, unknown>, template: Record<string, unknown>, format: string) => {
      const cleanedContent = removeSuggestionMarkersMock(
        String(resume['Improved Text'] || resume['Original Text'] || '')
      );

      return {
        htmlContent: String(template.TemplateContent || '')
          .replace('-name-', String(resume['Name'] || ''))
          .replace('-title-', String(resume['Title'] || ''))
          .replace('-content-', cleanedContent),
        filename: `${String(resume['Name'] || 'Candidat').replace(/\s+/g, '_')}.${format}`,
        stylesheet: template.Stylesheet || '',
        headerContent: String(template.HeaderContent || '').replace('-name-', String(resume['Name'] || '')),
        footerContent: String(template.FooterContent || '').replace('-title-', String(resume['Title'] || '')),
        footerHeight: template.FooterHeight || 0,
        format,
      };
    },
  };
});

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton" />,
}));

vi.mock('../components/ConsentBadge', () => ({
  default: () => <div data-testid="consent-badge" />,
}));

vi.mock('../components/ResumeAnalysis/SendEmailModal', () => ({
  default: ({
    attachmentFormat,
    onGenerateAttachment,
  }: {
    attachmentFormat?: string;
    onGenerateAttachment?: (format: 'pdf' | 'docx' | 'doc') => Promise<Blob>;
  }) => (
    <div data-testid="send-email-modal">
      <div>attachment:{attachmentFormat}</div>
      <button onClick={() => void onGenerateAttachment?.((attachmentFormat as 'pdf' | 'docx' | 'doc') || 'pdf')}>
        modal-generate-attachment
      </button>
    </div>
  ),
}));

vi.mock('../components/ResumeAnalysis/ExportTab', () => ({
  default: ({
    selectedTemplate,
    onTemplateChange,
    onExport,
    onSendEmail,
    selectedFormat,
    onFormatChange,
  }: {
    selectedTemplate: string;
    onTemplateChange: (value: string) => void;
    onExport: () => void;
    onSendEmail: () => void;
    selectedFormat: string;
    onFormatChange: (value: 'pdf' | 'docx' | 'doc') => void;
  }) => (
    <div data-testid="export-tab">
      <div data-testid="selected-template">{selectedTemplate}</div>
      <div data-testid="selected-format">{selectedFormat}</div>
      <button onClick={() => onTemplateChange('template-2')}>select-template-2</button>
      <button onClick={() => onFormatChange('docx')}>select-docx</button>
      <button onClick={onExport}>export-now</button>
      <button onClick={onSendEmail}>send-email</button>
    </div>
  ),
}));

describe('ResumeExportPage', () => {
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { id: 'resume-1' };
    setCurrentResumeMock.mockImplementation((resume: ResumeLike | null) => {
      resumeContextValue = {
        ...resumeContextValue,
        currentResume: resume,
      };
    });
    resumeContextValue = {
      currentResume: null,
      setCurrentResume: setCurrentResumeMock,
      resumes: [],
    };
    getAllTemplatesMock.mockResolvedValue([
      { id: 'template-1', Name: 'Default' },
      { id: 'template-2', Name: 'Executive' },
    ]);
    createAuthOptionsWithCsrfMock.mockImplementation(async (options: RequestInit) => options);

    Object.defineProperty(window, 'URL', {
      configurable: true,
      value: {
        createObjectURL: createObjectURLMock,
        revokeObjectURL: revokeObjectURLMock,
      },
    });

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        const anchor = originalCreateElement('a');
        anchor.click = clickMock;
        anchor.remove = removeMock;
        return anchor;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the resume and exports the selected template as docx', async () => {
    const resume = {
      id: 'resume-1',
      Name: 'Jane Doe',
      Title: 'Engineer',
      'Improved Text': '[[suggestion]]Improved body',
      'Original Text': 'Original body',
    };
    getResumeMock.mockResolvedValue(resume);
    getTemplateByIdMock.mockResolvedValue({
      id: 'template-2',
      Name: 'Executive',
      TemplateContent: '<main>-name-|-title-|-content-</main>',
      HeaderContent: '<header>-name-</header>',
      FooterContent: '<footer>-title-</footer>',
      FooterHeight: 40,
      Stylesheet: 'body { color: red; }',
    });
    fetchWithCsrfRetryMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['file-content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    });

    const { rerender } = render(
      <MemoryRouter>
        <ResumeExportPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getResumeMock).toHaveBeenCalledWith('resume-1', { forceRefresh: true });
      expect(getAllTemplatesMock).toHaveBeenCalled();
    });

    rerender(
      <MemoryRouter>
        <ResumeExportPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-template-2' }));
    fireEvent.click(screen.getByRole('button', { name: 'select-docx' }));
    fireEvent.click(screen.getByRole('button', { name: 'export-now' }));

    await waitFor(() => {
      expect(getTemplateByIdMock).toHaveBeenCalledWith('template-2');
    });
    expect(removeSuggestionMarkersMock).toHaveBeenCalledWith('[[suggestion]]Improved body');
    expect(fetchWithCsrfRetryMock).toHaveBeenCalledWith(
      '/generate-docx',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          htmlContent: '<main>Jane Doe|Engineer|Improved body</main>',
          filename: 'Jane_Doe.docx',
          stylesheet: 'body { color: red; }',
          headerContent: '<header>Jane Doe</header>',
          footerContent: '<footer>Engineer</footer>',
          footerHeight: 40,
          format: 'docx',
        }),
      }),
      300000
    );
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:resume-export');
    expect(toastSuccessMock).toHaveBeenCalledWith('resume.exportSuccess');
  });

  it('shows an error toast when export generation fails', async () => {
    resumeContextValue = {
      ...resumeContextValue,
      currentResume: {
        id: 'resume-1',
        Name: 'Jane Doe',
        'Original Text': 'Original body',
      },
    };
    getAllTemplatesMock.mockResolvedValue([{ id: 'template-1', Name: 'Default' }]);
    getTemplateByIdMock.mockResolvedValue({
      id: 'template-1',
      Name: 'Default',
      TemplateContent: '<main>-content-</main>',
    });
    fetchWithCsrfRetryMock.mockResolvedValue({
      ok: false,
    });

    render(
      <MemoryRouter>
        <ResumeExportPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'export-now' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('resume.exportError');
    });
  });

  it('opens the send email modal with the selected attachment format', async () => {
    resumeContextValue = {
      ...resumeContextValue,
      currentResume: {
        id: 'resume-1',
        Name: 'Jane Doe',
        'Original Text': 'Original body',
      },
    };

    render(
      <MemoryRouter>
        <ResumeExportPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-docx' }));
    fireEvent.click(screen.getByRole('button', { name: 'send-email' }));

    expect(await screen.findByTestId('send-email-modal')).toHaveTextContent('attachment:docx');
  });

  it('generates the email attachment with the selected template and format from the page flow', async () => {
    const resume = {
      id: 'resume-1',
      Name: 'Jane Doe',
      Title: 'Engineer',
      'Improved Text': '[[suggestion]]Improved body',
      'Original Text': 'Original body',
    };

    resumeContextValue = {
      ...resumeContextValue,
      currentResume: resume,
    };

    getTemplateByIdMock.mockResolvedValue({
      id: 'template-1',
      Name: 'Default',
      TemplateContent: '<main>-name-|-title-|-content-</main>',
      HeaderContent: '<header>-name-</header>',
      FooterContent: '<footer>-title-</footer>',
      FooterHeight: 40,
      Stylesheet: 'body { color: red; }',
    });
    fetchWithCsrfRetryMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['attachment-content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    });

    render(
      <MemoryRouter>
        <ResumeExportPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-template')).toHaveTextContent('template-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'select-docx' }));
    fireEvent.click(screen.getByRole('button', { name: 'send-email' }));

    fireEvent.click(await screen.findByRole('button', { name: 'modal-generate-attachment' }));

    await waitFor(() => {
      expect(getTemplateByIdMock).toHaveBeenCalledWith('template-1');
    });

    expect(fetchWithCsrfRetryMock).toHaveBeenCalledWith(
      '/generate-docx',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          htmlContent: '<main>Jane Doe|Engineer|Improved body</main>',
          filename: 'Jane_Doe.docx',
          stylesheet: 'body { color: red; }',
          headerContent: '<header>Jane Doe</header>',
          footerContent: '<footer>Engineer</footer>',
          footerHeight: 40,
          format: 'docx',
        }),
      }),
      300000
    );
  });
});
