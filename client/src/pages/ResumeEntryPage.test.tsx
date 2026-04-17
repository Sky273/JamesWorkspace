import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResumeEntryPage from './ResumeEntryPage';

const mockUseParams = vi.fn();
const mockUseLocation = vi.fn();
const mockGetResume = vi.fn();

const resumeContextState: {
  currentResume: Record<string, unknown> | null;
  resumes: Array<Record<string, unknown>>;
  setCurrentResume: ReturnType<typeof vi.fn>;
} = {
  currentResume: null,
  resumes: [],
  setCurrentResume: vi.fn(),
};

vi.mock('react-router-dom', () => ({
  Navigate: ({ to, state }: { to: string; state?: unknown }) => (
    <div data-testid="navigate-target" data-to={to} data-state={JSON.stringify(state ?? null)} />
  ),
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams(),
}));

vi.mock('../context/ResumeContext', () => ({
  useResume: () => resumeContextState,
}));

vi.mock('../utils/resumeService', () => ({
  resumeService: {
    getResume: (...args: unknown[]) => mockGetResume(...args),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('ResumeEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'resume-1' });
    mockUseLocation.mockReturnValue({ state: { from: 'dealsGroupedView' } });
    resumeContextState.currentResume = null;
    resumeContextState.resumes = [];
  });

  it('redirects to improve when the resume already has improved content', async () => {
    mockGetResume.mockResolvedValue({
      id: 'resume-1',
      'Improved Text': 'Texte amélioré',
    });
    resumeContextState.resumes = [{
      id: 'resume-1',
      'Improved Text': 'Texte amélioré',
    }];

    render(<ResumeEntryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('navigate-target')).toHaveAttribute('data-to', '/resumes/resume-1/improve');
    });
  });

  it('redirects to analysis when no improved content exists', async () => {
    mockGetResume.mockResolvedValue({
      id: 'resume-1',
      'Original Text': 'Texte original',
    });

    render(<ResumeEntryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('navigate-target')).toHaveAttribute('data-to', '/resumes/resume-1/analysis');
    });
    expect(resumeContextState.setCurrentResume).toHaveBeenCalled();
  });
});
