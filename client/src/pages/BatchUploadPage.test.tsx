import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BatchUploadPage from './BatchUploadPage';

const {
  navigateMock,
  startProcessingMock,
  startBatchExportMock,
  deleteProcessedResumesMock,
  getEstimatedTimeMock,
  templateGetAllMock,
  toastErrorMock,
  toastMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  startProcessingMock: vi.fn(),
  startBatchExportMock: vi.fn(),
  deleteProcessedResumesMock: vi.fn(),
  getEstimatedTimeMock: vi.fn(() => '~2 minutes'),
  templateGetAllMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastMock: vi.fn(),
}));

let authUser: { role?: string } | null = { role: 'admin' };
let capturedOnDrop: ((files: File[]) => void) | null = null;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    getAllTemplates: templateGetAllMock,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(toastMock, { error: toastErrorMock }),
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => {
    capturedOnDrop = onDrop;
    return {
      getRootProps: () => ({ 'data-testid': 'dropzone-root' }),
      getInputProps: () => ({ 'data-testid': 'dropzone-input' }),
      isDragActive: false,
    };
  },
}));

vi.mock('./batchUpload/useBatchProcessing', () => ({
  useBatchProcessing: () => ({
    startProcessing: startProcessingMock,
    getEstimatedTime: getEstimatedTimeMock,
  }),
}));

vi.mock('./batchUpload/useBatchExport', () => ({
  useBatchExport: () => ({
    startBatchExport: startBatchExportMock,
    deleteProcessedResumes: deleteProcessedResumesMock,
  }),
}));

vi.mock('./BatchUploadOptions', () => ({
  default: ({
    exportOption,
    setExportOption,
    templates,
    isAdmin,
    selectedFirmId,
  }: {
    exportOption: boolean;
    setExportOption: (value: boolean) => void;
    templates: Array<{ id: string; Name: string }>;
    isAdmin: boolean;
    selectedFirmId: string;
  }) => (
    <div data-testid="batch-options">
      <span>{exportOption ? 'export-on' : 'export-off'}</span>
      <span>{templates.map((template) => template.Name).join(',')}</span>
      <span>{isAdmin ? 'admin' : 'not-admin'}</span>
      <span>{selectedFirmId}</span>
      <button onClick={() => setExportOption(!exportOption)}>toggle-export-option</button>
    </div>
  ),
}));

vi.mock('./BatchUploadFileList', () => ({
  default: ({
    files,
    pendingCount,
    successCount,
  }: {
    files: Array<{ file: File; status: string }>;
    pendingCount: number;
    successCount: number;
  }) => (
    <div data-testid="batch-file-list">
      <span>files:{files.length}</span>
      <span>pending:{pendingCount}</span>
      <span>success:{successCount}</span>
    </div>
  ),
}));

describe('BatchUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { role: 'admin' };
    capturedOnDrop = null;
    templateGetAllMock.mockResolvedValue([
      { id: 'template-1', Name: 'Executive' },
      { id: 'template-2', Name: 'Minimal' },
    ]);
  });

  it('loads export templates when export option is enabled', async () => {
    render(<BatchUploadPage />);

    expect(screen.getByTestId('batch-options')).toHaveTextContent('export-off');
    fireEvent.click(screen.getByRole('button', { name: 'toggle-export-option' }));

    await waitFor(() => {
      expect(templateGetAllMock).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('batch-options')).toHaveTextContent('Executive,Minimal');
    expect(screen.getByTestId('batch-options')).toHaveTextContent('admin');
  });

  it('adds dropped files and starts processing from the action button', async () => {
    render(<BatchUploadPage />);

    expect(capturedOnDrop).toBeTypeOf('function');

    const file = new File(['resume'], 'candidate.pdf', { type: 'application/pdf' });
    capturedOnDrop?.([file]);

    await waitFor(() => {
      expect(screen.getByTestId('batch-file-list')).toHaveTextContent('files:1');
      expect(screen.getByTestId('batch-file-list')).toHaveTextContent('pending:1');
    });

    fireEvent.click(screen.getByRole('button', { name: /Traiter|batchUpload.process/ }));

    expect(startProcessingMock).toHaveBeenCalled();
    expect(screen.getByText('~2 minutes')).toBeInTheDocument();
  });

  it('keeps export mode enabled when files are added after template loading', async () => {
    render(<BatchUploadPage />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle-export-option' }));
    await waitFor(() => {
      expect(templateGetAllMock).toHaveBeenCalled();
    });

    const file = new File(['resume'], 'candidate.pdf', { type: 'application/pdf' });
    capturedOnDrop?.([file]);

    await waitFor(() => {
      expect(screen.getByTestId('batch-file-list')).toHaveTextContent('files:1');
    });
    expect(screen.getByTestId('batch-options')).toHaveTextContent('export-on');
  });

  it('renders non-admin mode without admin selector state', async () => {
    authUser = { role: 'user' };

    render(<BatchUploadPage />);

    expect(screen.getByTestId('batch-options')).toHaveTextContent('not-admin');
    fireEvent.click(screen.getByRole('button', { name: /Retour aux CVs|batchUpload.backToResumes/ }));
    expect(navigateMock).toHaveBeenCalledWith('/resumes');
  });
});
