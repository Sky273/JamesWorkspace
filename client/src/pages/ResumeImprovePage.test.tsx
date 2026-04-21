import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeImprovePage from './ResumeImprovePage';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockGetResume = vi.fn();
const mockImproveCurrentResume = vi.fn();
const mockDeleteResume = vi.fn();

const resumeContextState: {
  currentResume: Record<string, unknown> | null;
  setCurrentResume: ReturnType<typeof vi.fn>;
  resumes: Array<Record<string, unknown>>;
  improveCurrentResume: typeof mockImproveCurrentResume;
  updateImprovedContent: ReturnType<typeof vi.fn>;
  deleteResume: typeof mockDeleteResume;
  deleting: boolean;
  loading: boolean;
  processingStep: string | null;
} = {
  currentResume: null,
  setCurrentResume: vi.fn(),
  resumes: [] as Array<Record<string, unknown>>,
  improveCurrentResume: mockImproveCurrentResume,
  updateImprovedContent: vi.fn(),
  deleteResume: mockDeleteResume,
  deleting: false,
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
  fetchWithCsrfRetry: vi.fn(),
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
    onDelete,
    onSave,
  }: {
    hasImprovedText: boolean;
    onAdapt: () => void;
    onDelete: () => void;
    onSave: () => void;
  }) => (
    <div>
      <span>{hasImprovedText ? 'header-improved' : 'header-empty'}</span>
      <button onClick={onSave}>save-improved</button>
      <button onClick={onAdapt}>adapt-resume</button>
      <button onClick={onDelete}>delete-resume</button>
    </div>
  ),
}));

vi.mock('../components/page/ConfirmDialog', () => ({
  default: ({
    isOpen,
    onClose,
    onConfirm,
    title,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
  }) => (isOpen ? (
    <div>
      <div>{title}</div>
      <button onClick={onConfirm}>confirm-delete</button>
      <button onClick={onClose}>cancel-delete</button>
    </div>
  ) : null),
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

vi.mock('../components/ResumeAnalysis/OriginalSourcePreview', () => ({
  default: () => <div>original-source-preview</div>,
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
  removeSuggestionMarkers: (value: string) => value,
}));

vi.mock('../components/TiptapEditor/DeferredTiptapEditor', async () => {
  const React = await import('react');
  const MockDeferredTiptapEditor = React.forwardRef(function MockDeferredTiptapEditor({
    content,
    onReady,
    skillProofs,
  }: {
    content: string;
    onReady: () => void;
    skillProofs?: Array<{ name?: string; tool?: string }>;
  }, ref) {
    const [currentContent, setCurrentContent] = React.useState(content);
    React.useImperativeHandle(ref, () => ({
      getContent: () => currentContent,
      setContent: (nextContent: string) => setCurrentContent(nextContent),
      getEditor: () => null,
    }), [currentContent]);
    onReady();
    const labels = (skillProofs || []).map((proof) => proof.name || proof.tool).filter(Boolean).join(',');
    return <div>editor:{currentContent}:{labels || 'none'}</div>;
  });

  return {
    default: MockDeferredTiptapEditor,
  };
});

vi.mock('../components/TiptapEditor/suggestions.shared', () => ({
  parseSuggestions: () => [],
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
        'resume.improve.title': 'Amelioration du CV',
        'resume.improve.description': 'Description amelioration',
        'resume.analysis.improvedResume': 'CV ameliore',
        'resume.improve.notYetImproved': 'Pas encore ameliore',
        'resume.analysis.tabs.improved': 'Version amelioree',
        'resume.analysis.tabs.compare': 'Comparer',
        'resume.analysis.tabs.overview': 'Analyse',
        'resume.analysis.tabs.pipeline': 'Pipeline',
        'resume.improveSuccess': 'Amelioration reussie',
        'resume.improveError': 'Erreur amelioration',
        'errors.loadResume': 'Erreur chargement CV',
        'resumes.confirmDeleteTitle': 'Confirmer la suppression',
      };
      map['resume.analysis.tabs.original'] = 'Original';
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
    resumeContextState.deleting = false;
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
    mockDeleteResume.mockResolvedValue(undefined);
    resumeContextState.updateImprovedContent.mockResolvedValue({ success: true, currentVersion: 5 });
  });

  it('charge le CV et lance l amelioration depuis l etat vide', async () => {
    const resume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Original Text': 'Texte original',
    };
    resumeContextState.currentResume = resume;
    resumeContextState.resumes = [resume];

    render(<ResumeImprovePage />);

    expect(await screen.findByText('Amelioration du CV')).toBeInTheDocument();
    expect(screen.getByText('header-empty')).toBeInTheDocument();
    expect(screen.getByText('step-indicator:resume-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('start-improve'));

    await waitFor(() => {
      expect(mockImproveCurrentResume).toHaveBeenCalledTimes(1);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Amelioration reussie');
  });

  it('affiche les onglets quand un texte ameliore existe et permet la navigation', async () => {
    const improvedResume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Improved Text': 'Contenu ameliore',
      improvedText: 'Contenu ameliore',
      'Improved Key Improvements': 'Point 1',
      improvedSkillsEvidence: [{ name: 'Java', evidenceScore: 0.91 }],
      improvedToolsEvidence: [{ tool: 'Docker', evidence_score: 0.83 }],
    };
    resumeContextState.currentResume = improvedResume;
    resumeContextState.resumes = [improvedResume];
    mockGetResume.mockResolvedValue(improvedResume);

    render(<ResumeImprovePage />);

    expect(await screen.findByText('header-improved')).toBeInTheDocument();
    expect(screen.getByText('improved-tab')).toBeInTheDocument();
    expect(screen.getByText('editor:Contenu ameliore:Docker,Java')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Original'));
    expect(screen.getByText('original-source-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Comparer'));
    expect(screen.getByText('compare-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Analyse'));
    expect(screen.getByText('overview-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pipeline'));
    expect(screen.getByText('pipeline-tab:resume-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('adapt-resume'));
    expect(mockNavigate).toHaveBeenCalledWith('/resumes/resume-1/adapt');
  });

  it('does not navigate back to analysis when save is clicked on an improved resume', async () => {
    const improvedResume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Improved Text': 'Contenu ameliore',
      improvedText: 'Contenu ameliore',
    };
    resumeContextState.currentResume = improvedResume;
    resumeContextState.resumes = [improvedResume];
    mockGetResume.mockResolvedValue(improvedResume);

    render(<ResumeImprovePage />);

    expect(await screen.findByText('header-improved')).toBeInTheDocument();

    fireEvent.click(screen.getByText('save-improved'));

    expect(mockNavigate).not.toHaveBeenCalledWith('/resumes/resume-1/analysis');
  });

  it('keeps the saved improved content visible after save', async () => {
    const improvedResume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Improved Text': '<p>Contenu sauvegarde</p>',
      improvedText: '<p>Contenu sauvegarde</p>',
    };
    resumeContextState.currentResume = improvedResume;
    resumeContextState.resumes = [improvedResume];
    mockGetResume.mockResolvedValue(improvedResume);
    resumeContextState.updateImprovedContent.mockResolvedValueOnce({ success: true, currentVersion: 6 });

    render(<ResumeImprovePage />);

    expect(await screen.findByText('header-improved')).toBeInTheDocument();
    expect(screen.getByText('editor:<p>Contenu sauvegarde</p>:none')).toBeInTheDocument();

    fireEvent.click(screen.getByText('save-improved'));

    await waitFor(() => {
      expect(resumeContextState.updateImprovedContent).toHaveBeenCalledWith('resume-1', '<p>Contenu sauvegarde</p>');
    });
    expect(screen.getByText('editor:<p>Contenu sauvegarde</p>:none')).toBeInTheDocument();
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
      expect(mockToastError).toHaveBeenCalledWith('Erreur amelioration');
    });
  });

  it('allows deleting an improved resume from the detail page', async () => {
    const improvedResume = {
      id: 'resume-1',
      Name: 'Ada Lovelace',
      'Improved Text': 'Contenu ameliore',
      improvedText: 'Contenu ameliore',
    };
    resumeContextState.currentResume = improvedResume;
    resumeContextState.resumes = [improvedResume];
    mockGetResume.mockResolvedValue(improvedResume);

    render(<ResumeImprovePage />);

    expect(await screen.findByText('header-improved')).toBeInTheDocument();

    fireEvent.click(screen.getByText('delete-resume'));
    expect(screen.getByText('Confirmer la suppression')).toBeInTheDocument();

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(mockDeleteResume).toHaveBeenCalledWith('resume-1');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/resumes');
  });
});
