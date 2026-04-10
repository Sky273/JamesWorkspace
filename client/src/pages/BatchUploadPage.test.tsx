import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const toastErrorMock = vi.fn();
const getAllTemplatesMock = vi.fn();
const startBatchExportMock = vi.fn();
const startProcessingMock = vi.fn();
const getEstimatedTimeMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: 'admin',
    },
  }),
}));

vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => ({
    getRootProps: () => ({
      onClick: () => onDrop([new File(['cv'], 'ada.pdf', { type: 'application/pdf' })]),
    }),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: (...args: unknown[]) => toastErrorMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    getAllTemplates: (...args: unknown[]) => getAllTemplatesMock(...args),
  },
}));

vi.mock('./batchUpload/useBatchExport', () => ({
  useBatchExport: () => ({
    startBatchExport: (...args: unknown[]) => startBatchExportMock(...args),
  }),
}));

vi.mock('./batchUpload/useBatchProcessing', () => ({
  useBatchProcessing: () => ({
    startProcessing: (...args: unknown[]) => startProcessingMock(...args),
    getEstimatedTime: (...args: unknown[]) => getEstimatedTimeMock(...args),
  }),
}));

vi.mock('./BatchUploadOptions', () => ({
  default: ({ exportOption, setExportOption }: { exportOption: boolean; setExportOption: (value: boolean) => void }) => (
    <div>
      <span>batch-upload-options:{exportOption ? 'on' : 'off'}</span>
      <button onClick={() => setExportOption(!exportOption)}>toggle-export-option</button>
    </div>
  ),
}));

vi.mock('./BatchUploadFileList', () => ({
  default: ({ files }: { files: Array<{ file: File }> }) => <div>batch-upload-file-list:{files.length}</div>,
}));

vi.mock('./BatchUploadPage.sections', () => ({
  BatchUploadHeader: () => <div>batch-upload-header</div>,
  BatchUploadDropzone: ({ onFolderChange }: { onFolderChange: (event: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div>
      <button
        onClick={() =>
          onFolderChange({
            target: {
              files: [new File(['cv'], 'ada.pdf', { type: 'application/pdf' })],
              value: '',
            },
          } as unknown as React.ChangeEvent<HTMLInputElement>)
        }
      >
        select-folder
      </button>
    </div>
  ),
  BatchUploadActions: ({
    onBackToResumes,
    onStartProcessing,
    onStartExport,
  }: {
    onBackToResumes: () => void;
    onStartProcessing: () => void;
    onStartExport: () => void;
  }) => (
    <div>
      <button onClick={onBackToResumes}>back-to-resumes</button>
      <button onClick={onStartProcessing}>start-processing</button>
      <button onClick={onStartExport}>start-export</button>
    </div>
  ),
  BatchUploadGdprNotice: () => <div>batch-upload-gdpr</div>,
}));

import BatchUploadPage from './BatchUploadPage';

describe('BatchUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllTemplatesMock.mockResolvedValue([{ id: 'tpl-1', name: 'Template 1' }]);
    startBatchExportMock.mockResolvedValue(undefined);
    startProcessingMock.mockResolvedValue(undefined);
    getEstimatedTimeMock.mockReturnValue('~2 minutes');
  });

  it('adds files, enables export mode, loads templates, and forwards processing/export actions', async () => {
    render(<BatchUploadPage />);

    expect(screen.getByText('batch-upload-header')).toBeInTheDocument();
    expect(screen.getByText('batch-upload-file-list:0')).toBeInTheDocument();

    fireEvent.click(screen.getByText('select-folder'));

    await waitFor(() => {
      expect(screen.getByText('batch-upload-file-list:1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('toggle-export-option'));

    await waitFor(() => {
      expect(getAllTemplatesMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('start-processing'));
    fireEvent.click(screen.getByText('start-export'));
    fireEvent.click(screen.getByText('back-to-resumes'));

    expect(startProcessingMock).toHaveBeenCalled();
    expect(startBatchExportMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/resumes');
  });
});
