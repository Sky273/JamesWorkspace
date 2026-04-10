import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const uploadResumeMock = vi.fn();
const setProcessingErrorMock = vi.fn();
const fetchWithAuthMock = vi.fn();
const createAuthOptionsWithCsrfMock = vi.fn().mockResolvedValue({});
let capturedOnDrop: ((files: File[]) => void | Promise<void>) | null = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../context/ResumeContext', () => ({
  useResume: () => ({
    uploadResume: uploadResumeMock,
    loading: false,
    processingStep: null,
    processingError: null,
    setProcessingError: setProcessingErrorMock,
  }),
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  createAuthOptionsWithCsrf: (...args: unknown[]) => createAuthOptionsWithCsrfMock(...args),
}));

vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void | Promise<void> }) => {
    capturedOnDrop = onDrop;
    return {
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false,
    };
  },
}));

vi.mock('./AdminFirmSelector', () => ({
  default: ({ onFirmChange }: { onFirmChange: (firmId: string) => void }) => (
    <button onClick={() => onFirmChange('firm-1')}>choose-firm</button>
  ),
}));

vi.mock('./form/InputWithLeadingIcon', () => ({
  default: ({ id, value, onChange, placeholder, type = 'text' }: {
    id: string;
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    placeholder: string;
    type?: string;
  }) => (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  ),
}));

import FileUpload from './FileUpload';

describe('FileUpload', () => {
  it('validates candidate info, then uploads the dropped file with GDPR data', async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ preAnalysisEnabled: true }),
    });

    render(<FileUpload />);

    fireEvent.click(screen.getByText('choose-firm'));
    fireEvent.change(screen.getByLabelText('Nom complet du candidat *'), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Email du candidat *'), {
      target: { value: 'ada@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: "Continuer vers l'upload" }));

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    const file = new File(['cv'], 'ada.pdf', { type: 'application/pdf' });
    await capturedOnDrop?.([file]);

    expect(uploadResumeMock).toHaveBeenCalledWith(file, {
      profileType: 'external',
      candidateName: 'Ada Lovelace',
      candidateEmail: 'ada@example.com',
      firmId: 'firm-1',
    });
  });
});
