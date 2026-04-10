import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeImprovePage from './ResumeImprovePage';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockGetResume = vi.fn();
const mockImproveCurrentResume = vi.fn();

const resumeContextState: {
  currentResume: Record<string, unknown> | null;
  setCurrentResume: ReturnType<typeof vi.fn>;
  resumes: Array<Record<string, unknown>>;
  improveCurrentResume: typeof mockImproveCurrentResume;
  updateImprovedContent: ReturnType<typeof vi.fn>;
  loading: boolean;
  processingStep: string | null;
} = {
  currentResume: null,
  setCurrentResume: vi.fn(),
  resumes: [] as Array<Record<string, unknown>>,
  improveCurrentResume: mockImproveCurrentResume,
  updateImprovedContent: vi.fn(),
  loading: false,
  processingStep: null,
};

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

vi.mock('../context/ResumeContext', () => ({
  useResume: () => resumeContextState,
}));

vi.mock('../utils/resumeService', () => ({
  resumeService: {
    getResume: (...args: unknown[]) => mockGetResume(...args),
    updateResume: vi.fn(),
  },
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    getAllTemplates: vi.fn(),
  },
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithAuth: vi.fn(),
  createAuthOptionsWithCsrf: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock('../components/ShareQRCodeModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>share-modal</div> : null),
}));

vi.mock('../components/ImprovementAnimation', () => ({
  default: ({ currentStep }: { currentStep: string }) => <div>improvement-animation:{currentStep}</div>,
}));

vi.mock('../components/ResumeAnalysis/ImprovedTextTab', () => ({
  default: ({ editorSlot }: { editorSlot: React.ReactNode }) => (
    <div>
      <div>improved-tab</div>
      {editorSlot}
    </div>
  ),
}));

vi.mock('../components/ResumeImprove/ResumeImproveHeader', () => ({
  default: ({
    hasImprovedText,
    onAdapt,
    onSave,
  }: {
    hasImprovedText: boolean;
    onAdapt: () => void;
    onSave: () => void;
  }) => (
    <div>
      <span>{hasImprovedText ? 'header-improved' : 'header-empty'}</span>
      <button onClick={onSave}>save-improved</button>
      <button onClick={onAdapt}>adapt-resume</button>
    </div>
  ),
}));

vi.mock('../components/ResumeImprove/ResumeImproveStepIndicator', () => ({
  default: ({ resumeId }: { resumeId: string }) => <div>step-indicator:{resumeId}</div>,
}));

vi.mock('../components/ResumeImprove/ResumeImproveEmptyState', () => ({
  default: ({ onImprove }: { onImprove: () => void }) => (
    <button onClick={onImprove}>start-improve</button>
  ),
}));

vi.mock('../components/ResumeAnalysis/CompareTab', () => ({
  default: () => <div>compare-tab</div>,
}));

vi.mock('../components/ResumeAnalysis/OverviewTab', () => ({
  default: () => <div>overview-tab</div>,
}));

vi.mock('../components/ResumeAnalysis/PipelineTab', () => ({
  default: ({ resumeId }: { resumeId: string }) => <div>pipeline-tab:{resumeId}</div>,
}));

vi.mock('../components/ResumeComments', () => ({
  default: ({ resumeId }: { resumeId: string }) => <div>resume-comments:{resumeId}</div>,
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('../components/TiptapEditor', () => ({
  DeferredTiptapEditor: ({
    content,
    onReady,
    skillProofs,
  }: {
    content: string;
    onReady: () => void;
    skillProofs?: Array<{ name: string }>;
  }) => {
    onReady();
    return <div>editor:{content}:{skillProofs?.map((proof) => proof.name).join(',') || 'none'}</div>;
  },
  parseSuggestions: () => [],
  removeSuggestionMarkers: (value: string) => value,
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'resume.improve.title': 'Amélioration du CV',
        'resume.improve.description': 'Description amélioration',
        'resume.analysis.improvedResume': 'CV amélioré',
        'resume.improve.notYetImproved': 'Pas encore amélioré',
        'resume.analysis.tabs.improved': 'Version améliorée',
        'resume.analysis.tabs.compare': 'Comparer',
        'resume.analysis.tabs.overview': 'Analyse',
        'resume.analysis.tabs.pipeline': 'Pipeline',
        'resume.improveSuccess': 'Amélioration réussie',
        'resume.improveError': 'Erreur amélioration',
        'errors.loadResume': 'Erreur chargement CV',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('ResumeImprovePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'resume-1' });
    resumeContextState.currentResume = null;
    resumeContextState.resumes = [];
    resumeContextState.loading = false;
    resumeContextState.processingStep = null;
    resumeContextState.setCurrentResume.mockImplementation((resume: Record<string, unknown> | null) => {
      resumeContextState.currentResume = resume;
    });
    mockGetResume.mockResolvedValue({
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'File Name': 'ada.pdf',
      'Original Text': 'Texte original',
    });
    mockImproveCurrentResume.mockResolvedValue(undefined);
  });

  it('charge le CV et lance l’amélioration depuis l’état vide', async () => {
    const resume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Original Text': 'Texte original',
    };
    resumeContextState.currentResume = resume;
    resumeContextState.resumes = [resume];

    render(<ResumeImprovePage />);

    expect(await screen.findByText('Amélioration du CV')).toBeInTheDocument();
    expect(screen.getByText('header-empty')).toBeInTheDocument();
    expect(screen.getByText('step-indicator:resume-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('start-improve'));

    await waitFor(() => {
      expect(mockImproveCurrentResume).toHaveBeenCalledTimes(1);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Amélioration réussie');
  });

  it('affiche les onglets quand un texte amélioré existe et permet la navigation', async () => {
    const improvedResume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Improved Text': 'Contenu amélioré',
      'Improved Key Improvements': 'Point 1',
      improvedSkillsEvidence: [{ name: 'Java', evidenceScore: 0.91 }],
      improvedToolsEvidence: [{ tool: 'Docker', evidence_score: 0.83 }],
    };
    resumeContextState.currentResume = improvedResume;
    resumeContextState.resumes = [improvedResume];

    render(<ResumeImprovePage />);

    expect(await screen.findByText('header-improved')).toBeInTheDocument();
    expect(screen.getByText('improved-tab')).toBeInTheDocument();
    expect(screen.getByText('editor:Contenu amélioré:Docker,Java')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Comparer'));
    expect(screen.getByText('compare-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Analyse'));
    expect(screen.getByText('overview-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pipeline'));
    expect(screen.getByText('pipeline-tab:resume-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('adapt-resume'));
    expect(mockNavigate).toHaveBeenCalledWith('/resumes/resume-1/adapt');
  });
  it('surfaces a load error when the resume cannot be fetched', async () => {
    resumeContextState.currentResume = null;
    resumeContextState.resumes = [];
    mockGetResume.mockRejectedValueOnce(new Error('fetch failed'));

    render(<ResumeImprovePage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load resume')).toBeInTheDocument();
    });
    expect(mockToastError).toHaveBeenCalledWith('Erreur chargement CV');
  });

  it('surfaces an improvement error when improveCurrentResume fails', async () => {
    const resume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Original Text': 'Texte original',
    };
    resumeContextState.currentResume = resume;
    resumeContextState.resumes = [resume];
    mockImproveCurrentResume.mockRejectedValueOnce(new Error('improve failed'));

    render(<ResumeImprovePage />);

    expect(await screen.findByText('header-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByText('start-improve'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Erreur amélioration');
    });
  });
});
