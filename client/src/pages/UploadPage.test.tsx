import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import UploadPage from './UploadPage';

const navigateMock = vi.fn();
const setCurrentResumeMock = vi.fn();

let resumeContextValue: {
  currentResume: { id: string } | null;
  setCurrentResume: typeof setCurrentResumeMock;
};

vi.mock('../context/ResumeContext', () => ({
  useResume: () => resumeContextValue
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ key: 'upload-entry' })
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock('../components/FileUpload', () => ({
  default: () => <div>FileUpload</div>
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  }
}));

describe('UploadPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setCurrentResumeMock.mockReset();
    resumeContextValue = {
      currentResume: { id: 'existing-resume' },
      setCurrentResume: setCurrentResumeMock
    };
  });

  it('redirects to the analysis page when a new resume is hydrated after upload', async () => {
    const { rerender } = render(<UploadPage />);

    expect(setCurrentResumeMock).toHaveBeenCalledWith(null);

    await act(async () => {
      resumeContextValue = {
        currentResume: null,
        setCurrentResume: setCurrentResumeMock
      };
      rerender(<UploadPage />);
    });

    resumeContextValue = {
      currentResume: { id: 'new-resume' },
      setCurrentResume: setCurrentResumeMock
    };

    await act(async () => {
      rerender(<UploadPage />);
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/resumes/new-resume/analysis', {
        state: { refreshResumesView: true },
      });
    });
  });

  it('does not redirect when the context is restored with the same resume id', async () => {
    const { rerender } = render(<UploadPage />);

    await act(async () => {
      resumeContextValue = {
        currentResume: null,
        setCurrentResume: setCurrentResumeMock
      };
      rerender(<UploadPage />);
    });

    resumeContextValue = {
      currentResume: { id: 'existing-resume' },
      setCurrentResume: setCurrentResumeMock
    };

    await act(async () => {
      rerender(<UploadPage />);
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
