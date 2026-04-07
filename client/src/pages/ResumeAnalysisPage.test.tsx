import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumeAnalysisPage from './ResumeAnalysisPage';

const {
  navigateMock,
  setCurrentResumeMock,
  improveCurrentResumeMock,
  fetchWithAuthMock,
  createAuthOptionsWithCsrfMock,
  getResumeMock,
  getAllTemplatesMock,
  toastSuccessMock,
  toastErrorMock,
  loggerInfoMock,
  loggerErrorMock,
  removeSuggestionMarkersMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  setCurrentResumeMock: vi.fn(),
  improveCurrentResumeMock: vi.fn(),
  fetchWithAuthMock: vi.fn(),
  createAuthOptionsWithCsrfMock: vi.fn(),
  getResumeMock: vi.fn(),
  getAllTemplatesMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  removeSuggestionMarkersMock: vi.fn((value: string) => value.replace(/\[\[suggestion\]\]/g, '')),
}));

type ResumeLike = Record<string, unknown> & { id: string; name?: string };

let resumeContextValue: {
  currentResume: ResumeLike | null;
  setCurrentResume: typeof setCurrentResumeMock;
  resumes: ResumeLike[];
  improveCurrentResume: typeof improveCurrentResumeMock;
  loading: boolean;
  processingStep: string | null;
};

let routeParams = { id: 'resume-1' };
let locationState: { from?: string } | null = null;

vi.mock('../context/ResumeContext', () => ({
  useResume: () => resumeContextValue,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: locationState }),
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
  },
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithAuth: fetchWithAuthMock,
  createAuthOptionsWithCsrf: createAuthOptionsWithCsrfMock,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    info: loggerInfoMock,
    error: loggerErrorMock,
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

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonCard: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('../components/ImprovementAnimation', () => ({
  default: ({ currentStep }: { currentStep: string }) => <div data-testid="improvement-animation">{currentStep}</div>,
}));

vi.mock('../components/ResumeAnalysis/OverviewTab', () => ({
  default: ({ resume }: { resume: ResumeLike }) => <div data-testid="overview-tab">overview:{String(resume.id)}</div>,
}));

vi.mock('../components/ResumeAnalysis/SkillsTagsTab', () => ({
  default: () => <div data-testid="skills-tab">skills</div>,
}));

vi.mock('../components/ResumeAnalysis/OriginalTextTab', () => ({
  default: () => <div data-testid="original-tab">original</div>,
}));

vi.mock('../components/ResumeAnalysis/PipelineTab', () => ({
  default: ({ resumeId }: { resumeId: string }) => <div data-testid="pipeline-tab">pipeline:{resumeId}</div>,
}));

vi.mock('../components/ResumeComments', () => ({
  default: ({ resumeId }: { resumeId: string }) => <div data-testid="resume-comments">comments:{resumeId}</div>,
}));

vi.mock('../components/ResumeAnalysisPage/ResumeAnalysisHeader', () => ({
  default: ({
    resumeName,
    hasImprovedText,
    onShare,
    onImprove,
  }: {
    resumeName: string;
    hasImprovedText: boolean;
    onShare: () => void;
    onImprove: () => void;
  }) => (
    <div data-testid="analysis-header">
      <span>{resumeName}</span>
      <span>{hasImprovedText ? 'improved' : 'original'}</span>
      <button onClick={onShare}>share</button>
      <button onClick={onImprove}>improve</button>
    </div>
  ),
}));

vi.mock('../components/ResumeAnalysisPage/ResumeAnalysisStepIndicator', () => ({
  default: ({ onImprove }: { onImprove: () => void }) => (
    <button onClick={onImprove} data-testid="step-indicator-improve">
      improve-from-step
    </button>
  ),
}));

vi.mock('../components/ShareQRCodeModal', () => ({
  default: ({
    isOpen,
    isLoading,
    url,
    title,
    warning,
    candidateName,
  }: {
    isOpen: boolean;
    isLoading?: boolean;
    url: string;
    title?: string;
    warning?: string;
    candidateName?: string;
  }) => (
    <div data-testid="share-modal">
      <span>{isOpen ? 'open' : 'closed'}</span>
      <span>{isLoading ? 'loading' : 'idle'}</span>
      <span>{url}</span>
      <span>{title}</span>
      <span>{warning}</span>
      <span>{candidateName}</span>
    </div>
  ),
}));

describe('ResumeAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    routeParams = { id: 'resume-1' };
    locationState = null;
    createAuthOptionsWithCsrfMock.mockResolvedValue({
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'csrf-token' },
    });
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
      improveCurrentResume: improveCurrentResumeMock,
      loading: false,
      processingStep: null,
    };
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('loads a resume from the API when it is not already present in context', async () => {
    const fetchedResume = {
      id: 'resume-1',
      Name: 'Jane Doe',
      'Original Text': 'Original content',
    };
    getResumeMock.mockResolvedValue(fetchedResume);

    const { rerender } = render(
      <MemoryRouter>
        <ResumeAnalysisPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getResumeMock).toHaveBeenCalledWith('resume-1');
    });
    expect(setCurrentResumeMock).toHaveBeenCalledWith(fetchedResume);
    rerender(
      <MemoryRouter>
        <ResumeAnalysisPage />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('analysis-header')).toHaveTextContent('Jane Doe');
    expect(screen.getByTestId('overview-tab')).toHaveTextContent('overview:resume-1');
    expect(screen.getByTestId('resume-comments')).toHaveTextContent('comments:resume-1');
  });

  it('improves the current resume and redirects to the improve page', async () => {
    resumeContextValue = {
      ...resumeContextValue,
      currentResume: {
        id: 'resume-1',
        Name: 'Jane Doe',
        'Original Text': 'Original content',
      },
    };
    improveCurrentResumeMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ResumeAnalysisPage />
      </MemoryRouter>
    );

    await screen.findByTestId('analysis-header');
    fireEvent.click(screen.getByRole('button', { name: 'improve' }));

    await waitFor(() => {
      expect(improveCurrentResumeMock).toHaveBeenCalled();
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('resume.improveSuccess');
    expect(navigateMock).toHaveBeenCalledWith('/resumes/resume-1/improve');
  });

  it('generates a share link for improved content using the template pipeline', async () => {
    resumeContextValue = {
      ...resumeContextValue,
      currentResume: {
        id: 'resume-1',
        Name: 'Jane Doe',
        Title: 'Engineer',
        'Improved Text': '[[suggestion]]Improved body',
        'Original Text': 'Original body',
      },
    };
    getAllTemplatesMock.mockResolvedValue([
      {
        TemplateContent: '<main>-name-|-title-|-content-</main>',
        HeaderContent: '<header>-name-|-title-</header>',
        FooterContent: '<footer>-name-|-title-</footer>',
        Stylesheet: 'body { color: black; }',
        FooterHeight: 35,
      },
    ]);
    fetchWithAuthMock.mockResolvedValue({
      json: async () => ({ success: true, token: 'token-123' }),
    });

    render(
      <MemoryRouter>
        <ResumeAnalysisPage />
      </MemoryRouter>
    );

    await screen.findByTestId('analysis-header');
    fireEvent.click(screen.getByRole('button', { name: 'share' }));

    await waitFor(() => {
      expect(getAllTemplatesMock).toHaveBeenCalled();
    });
    expect(removeSuggestionMarkersMock).toHaveBeenCalledWith('[[suggestion]]Improved body');
    expect(createAuthOptionsWithCsrfMock).toHaveBeenCalledWith({
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      '/api/share/resume/resume-1/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          htmlContent: '<main>Jane Doe|Engineer|Improved body</main>',
          filename: 'Jane_Doe',
          stylesheet: 'body { color: black; }',
          headerContent: '<header>Jane Doe|Engineer</header>',
          footerContent: '<footer>Jane Doe|Engineer</footer>',
          footerHeight: 35,
        }),
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId('share-modal')).toHaveTextContent('open');
      expect(screen.getByTestId('share-modal')).toHaveTextContent(`${window.location.origin}/share/pdf/token-123`);
      expect(screen.getByTestId('share-modal')).toHaveTextContent('share.improvedCV');
    });
  });

  it('generates a share link for the original file when no improved text exists', async () => {
    resumeContextValue = {
      ...resumeContextValue,
      currentResume: {
        id: 'resume-1',
        Name: 'Jane Doe',
        'Original Text': 'Original body',
      },
    };
    fetchWithAuthMock.mockResolvedValue({
      json: async () => ({ success: true, token: 'file-456' }),
    });

    render(
      <MemoryRouter>
        <ResumeAnalysisPage />
      </MemoryRouter>
    );

    await screen.findByTestId('analysis-header');
    fireEvent.click(screen.getByRole('button', { name: 'share' }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith('/api/share/resume/resume-1/original');
    });
    expect(screen.getByTestId('share-modal')).toHaveTextContent(`${window.location.origin}/share/file/file-456`);
    expect(screen.getByTestId('share-modal')).toHaveTextContent('share.originalWarning');
    expect(screen.getByTestId('share-modal')).toHaveTextContent('share.originalFile');
  });

  it('shows an error state when the resume cannot be loaded', async () => {
    getResumeMock.mockRejectedValue(new Error('backend down'));

    render(
      <MemoryRouter>
        <ResumeAnalysisPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('errors.loadResume')).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith('errors.loadResume');
  });

});
