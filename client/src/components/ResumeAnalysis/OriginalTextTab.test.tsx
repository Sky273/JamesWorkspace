import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateOriginalContentMock = vi.fn();
const updateResumeAnalysisMock = vi.fn();
const fetchWithAuthMock = vi.fn();
const createAuthOptionsWithCsrfMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../../context/ResumeContext', () => ({
  useResume: () => ({
    updateOriginalContent: (...args: unknown[]) => updateOriginalContentMock(...args),
    updateResumeAnalysis: (...args: unknown[]) => updateResumeAnalysisMock(...args),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  createAuthOptionsWithCsrf: (...args: unknown[]) => createAuthOptionsWithCsrfMock(...args),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../TiptapEditor/DeferredTiptapEditor', () => {
  const DeferredTiptapEditor = React.forwardRef(({
    content,
    onChange,
    onReady,
    skillProofs,
  }: {
    content: string;
    onChange: (value: string) => void;
    onReady: () => void;
    skillProofs?: Array<{ name: string }>;
  }, ref: React.Ref<{ getContent: () => string; setContent: (value: string) => void }>) => {
    const [value, setValue] = React.useState(content);

    React.useEffect(() => {
      onReady();
    }, [onReady]);

    React.useImperativeHandle(ref, () => ({
      getContent: () => value,
      setContent: (nextValue: string) => setValue(nextValue),
    }), [value]);

    return (
      <div>
        <div data-testid="original-skill-proofs">{skillProofs?.map((proof) => proof.name).join(',') || 'none'}</div>
        <textarea
          aria-label="original-editor"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value);
          }}
        />
      </div>
    );
  });
  DeferredTiptapEditor.displayName = 'DeferredTiptapEditorMock';

  return {
    __esModule: true,
    default: DeferredTiptapEditor,
  };
});

vi.mock('../TiptapEditor/suggestions.shared', () => ({
  parseSuggestions: () => [],
}));

vi.mock('../TiptapEditor/suggestionsHtml', () => ({
  removeSuggestionMarkers: (value: string) => value.replace(/\[\[suggestion\]\]/g, ''),
}));

import OriginalTextTab from './OriginalTextTab';

describe('OriginalTextTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOriginalContentMock.mockResolvedValue({ success: true });
    updateResumeAnalysisMock.mockResolvedValue({});
    createAuthOptionsWithCsrfMock.mockResolvedValue({ method: 'POST', headers: { 'x-csrf-token': 'csrf' } });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        modifiedContent: 'AI updated content',
        message: 'AI update applied',
      }),
    });
  });

  it('saves edited original content and persists name/title changes on blur', async () => {
    render(
      <OriginalTextTab
        resume={{
          id: 'resume-1',
          Name: 'Ada',
          Title: 'Engineer',
          'Original Text': 'Initial content',
          'Key Improvements': '[]',
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('original-editor'), { target: { value: 'Updated content' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateOriginalContentMock).toHaveBeenCalledWith('resume-1', 'Updated content');
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Modifications saved successfully');

    fireEvent.change(screen.getByDisplayValue('Ada'), { target: { value: 'Ada Lovelace' } });
    fireEvent.blur(screen.getByDisplayValue('Ada Lovelace'));
    fireEvent.change(screen.getByDisplayValue('Engineer'), { target: { value: 'Senior Engineer' } });
    fireEvent.blur(screen.getByDisplayValue('Senior Engineer'));

    await waitFor(() => {
      expect(updateResumeAnalysisMock).toHaveBeenCalledWith('resume-1', { Name: 'Ada Lovelace' });
    });
    expect(updateResumeAnalysisMock).toHaveBeenCalledWith('resume-1', { Title: 'Senior Engineer' });
  });

  it('uses the internal AI modify flow and updates the editor content', async () => {
    render(
      <OriginalTextTab
        resume={{
          id: 'resume-1',
          Name: 'Ada',
          Title: 'Engineer',
          'Original Text': 'Initial content',
          'Key Improvements': '[]',
        }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Exemple : Reformuler/i), {
      target: { value: 'Rewrite this CV' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        '/api/resumes/resume-1/ai-modify',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(screen.getByLabelText('original-editor')).toHaveValue('AI updated content');
    expect(screen.getByText('AI update applied')).toBeInTheDocument();
  });

  it('passes current skill proofs to the editor', () => {
    render(
      <OriginalTextTab
        resume={{
          id: 'resume-1',
          Name: 'Ada',
          Title: 'Engineer',
          'Original Text': 'Initial content',
          skillsEvidence: [{ name: 'Java', evidenceScore: 0.8 }],
          toolsEvidence: [{ tool: 'Docker', evidence_score: 0.7 }],
        }}
      />
    );

    expect(screen.getByTestId('original-skill-proofs')).toHaveTextContent('Docker,Java');
  });
});
