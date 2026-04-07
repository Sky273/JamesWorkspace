import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumeAdaptPage from './ResumeAdaptPage';

const {
  navigateMock,
  authGetMock,
  analyzeMatchMock,
  createAdaptationMock,
  toastSuccessMock,
  toastErrorMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  authGetMock: vi.fn(),
  analyzeMatchMock: vi.fn(),
  createAdaptationMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

let routeParams = { id: 'resume-1' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: authGetMock,
  }),
}));

vi.mock('../utils/resumeAdaptationService', () => ({
  default: {
    analyzeMatch: analyzeMatchMock,
    createAdaptation: createAdaptationMock,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: loggerErrorMock,
    log: vi.fn(),
  },
}));

vi.mock('../components/MissionSelector', () => ({
  default: ({
    onSelect,
    onClose,
  }: {
    onSelect: (mission: { id: string; Title: string }) => void;
    onClose: () => void;
  }) => (
    <div>
      <button onClick={() => onSelect({ id: 'mission-1', Title: 'Mission One' })}>select-mission</button>
      <button onClick={onClose}>close-selector</button>
    </div>
  ),
}));

vi.mock('../components/MatchAnalysisDisplay', () => ({
  default: ({
    onContinue,
    onCancel,
  }: {
    onContinue: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="match-analysis">
      <button onClick={onContinue}>continue-adaptation</button>
      <button onClick={onCancel}>cancel-analysis</button>
    </div>
  ),
}));

vi.mock('../components/ResumeAdapt/AdaptProgressSteps', () => ({
  default: ({ step }: { step: string }) => <div data-testid="progress-steps">{step}</div>,
}));

vi.mock('../components/ResumeAdapt/AdaptLoadingState', () => ({
  default: ({ mode }: { mode: string }) => <div data-testid="loading-state">{mode}</div>,
}));

vi.mock('../components/ResumeAdapt/AdaptResultPanel', () => ({
  default: ({
    onNewAdaptation,
    onViewAdaptation,
    adaptation,
  }: {
    onNewAdaptation: () => void;
    onViewAdaptation: () => void;
    adaptation: { adaptationId?: string; adaptedText?: string };
  }) => (
    <div data-testid="adapt-result">
      <span>{adaptation.adaptedText}</span>
      <button onClick={onNewAdaptation}>new-adaptation</button>
      <button onClick={onViewAdaptation}>view-adaptation</button>
    </div>
  ),
}));

describe('ResumeAdaptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { id: 'resume-1' };
  });

  it('loads the resume, analyzes a mission and opens the adaptation result', async () => {
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resume-1', Name: 'Jane Doe', 'Improved Text': 'Improved body' }),
    });
    analyzeMatchMock.mockResolvedValue({
      score: 82,
      strengths: ['Leadership'],
      gaps: ['Go'],
    });
    createAdaptationMock.mockResolvedValue({
      adaptedText: 'Adapted profile',
      adaptationId: 'adapt-55',
      matchAnalysis: {
        score: 88,
        strengths: ['Leadership'],
        gaps: [],
      },
    });

    render(
      <MemoryRouter>
        <ResumeAdaptPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-mission' }));

    await waitFor(() => {
      expect(analyzeMatchMock).toHaveBeenCalledWith('resume-1', 'mission-1');
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('adaptation.analysisComplete');

    fireEvent.click(await screen.findByRole('button', { name: 'continue-adaptation' }));

    await waitFor(() => {
      expect(createAdaptationMock).toHaveBeenCalledWith('resume-1', 'mission-1');
    });
    expect(await screen.findByTestId('adapt-result')).toHaveTextContent('Adapted profile');
    expect(toastSuccessMock).toHaveBeenCalledWith('adaptation.generationComplete');

    fireEvent.click(screen.getByRole('button', { name: 'view-adaptation' }));
    expect(navigateMock).toHaveBeenCalledWith('/adaptations/adapt-55');
  });

  it('returns to mission selection when analysis fails', async () => {
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resume-1', Name: 'Jane Doe' }),
    });
    analyzeMatchMock.mockRejectedValue(new Error('analysis failed'));

    render(
      <MemoryRouter>
        <ResumeAdaptPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-mission' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('adaptation.analysisError');
    });
    expect(await screen.findByRole('button', { name: 'select-mission' })).toBeInTheDocument();
  });

  it('shows the error view when the resume cannot be loaded', async () => {
    authGetMock.mockResolvedValue({
      ok: false,
    });

    render(
      <MemoryRouter>
        <ResumeAdaptPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('errors.resumeNotFound')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.backToList' }));
    expect(navigateMock).toHaveBeenCalledWith('/resumes');
  });
});
