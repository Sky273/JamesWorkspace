import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchProcessing } from './useBatchProcessing';
import type { FileStatus } from '../batchUpload.utils';

const {
  navigateMock,
  fetchWithAuthMock,
  createAuthOptionsWithCsrfMock,
  createAndTrackJobMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fetchWithAuthMock: vi.fn(),
  createAuthOptionsWithCsrfMock: vi.fn(),
  createAndTrackJobMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: fetchWithAuthMock,
  createAuthOptionsWithCsrf: createAuthOptionsWithCsrfMock,
  getResponseErrorMessage: vi.fn(async () => 'job creation failed'),
}));

vi.mock('../../utils/longRunningOperation', () => ({
  createAndTrackJob: createAndTrackJobMock,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useBatchProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuthOptionsWithCsrfMock.mockResolvedValue({
      headers: { 'x-csrf-token': 'csrf-token' },
    });
  });

  it('creates a batch job, updates statuses and redirects to jobs', async () => {
    const file = new File(['resume'], 'candidate.pdf', { type: 'application/pdf' });
    const filesRef: { current: FileStatus[] } = {
      current: [{ file, status: 'pending', progress: 0, relativePath: 'folder/candidate.pdf' }],
    };
    const updateFileStatus = vi.fn();
    const setFiles = vi.fn();
    const setIsProcessing = vi.fn();
    const isMountedRef = { current: true };
    const abortControllerRef = { current: null };

    createAndTrackJobMock.mockImplementation(async ({ create }: { create: () => Promise<unknown> }) => {
      await create();
      return { created: { id: 'job-1', total_items: 1 } };
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'job-1', total_items: 1 }),
    });

    const { result } = renderHook(() =>
      useBatchProcessing({
        filesRef,
        isMountedRef,
        abortControllerRef,
        isAdmin: true,
        selectedFirmId: '',
        improveOption: true,
        exportOption: true,
        exportFormats: ['pdf'],
        selectedTemplate: 'template-1',
        deleteAfterExport: false,
        setFiles,
        setIsProcessing,
        updateFileStatus,
      })
    );

    await act(async () => {
      await result.current.startProcessing();
    });

    expect(setIsProcessing).toHaveBeenNthCalledWith(1, true);
    expect(updateFileStatus).toHaveBeenCalledWith(0, { status: 'uploading', progress: 10 });
    expect(updateFileStatus).toHaveBeenCalledWith(0, { status: 'analyzing', progress: 50 });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      '/api/batch-jobs',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData),
      })
    );
    expect(setFiles).toHaveBeenCalledWith([]);
    expect(navigateMock).toHaveBeenCalledWith('/batch-jobs');
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(setIsProcessing).toHaveBeenLastCalledWith(false);
  });

  it('returns an estimated processing time based on pending files and improve option', () => {
    const filesRef: { current: FileStatus[] } = {
      current: [
        { file: new File(['a'], 'a.pdf'), status: 'pending', progress: 0 },
        { file: new File(['b'], 'b.pdf'), status: 'pending', progress: 0 },
      ],
    };

    const { result } = renderHook(() =>
      useBatchProcessing({
        filesRef,
        isMountedRef: { current: true },
        abortControllerRef: { current: null },
        isAdmin: false,
        selectedFirmId: '',
        improveOption: true,
        exportOption: false,
        exportFormats: ['pdf'],
        selectedTemplate: '',
        deleteAfterExport: false,
        setFiles: vi.fn(),
        setIsProcessing: vi.fn(),
        updateFileStatus: vi.fn(),
      })
    );

    expect(result.current.getEstimatedTime()).toBe('batchUpload.estimatedTimeMinutes');
  });
});
