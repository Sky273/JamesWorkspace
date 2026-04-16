import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchExport } from './useBatchExport';
import type { FileStatus } from '../batchUpload.utils';

const {
  fetchWithAuthMock,
  createAuthOptionsWithCsrfMock,
  prepareLongRunningRequestMock,
  toastSuccessMock,
  toastErrorMock,
  createObjectURLMock,
  revokeObjectURLMock,
  clickMock,
  removeMock,
} = vi.hoisted(() => ({
  fetchWithAuthMock: vi.fn(),
  createAuthOptionsWithCsrfMock: vi.fn(),
  prepareLongRunningRequestMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  createObjectURLMock: vi.fn(() => 'blob:zip-export'),
  revokeObjectURLMock: vi.fn(),
  clickMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: fetchWithAuthMock,
  createAuthOptionsWithCsrf: createAuthOptionsWithCsrfMock,
  prepareLongRunningRequest: prepareLongRunningRequestMock,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useBatchExport', () => {
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.clearAllMocks();
    createAuthOptionsWithCsrfMock.mockImplementation(async (options: RequestInit) => options);
    prepareLongRunningRequestMock.mockResolvedValue(undefined);
    Object.defineProperty(window, 'URL', {
      configurable: true,
      value: {
        createObjectURL: createObjectURLMock,
        revokeObjectURL: revokeObjectURLMock,
      },
    });
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        const anchor = originalCreateElement('a');
        anchor.click = clickMock;
        anchor.remove = removeMock;
        return anchor;
      }
      return originalCreateElement(tagName);
    });
  });

  it('exports successful resumes as a zip download', async () => {
    const filesRef: { current: FileStatus[] } = {
      current: [
        { status: 'success', resumeId: 'resume-1', file: new File(['a'], 'a.pdf'), progress: 100 },
        { status: 'success', resumeId: 'resume-2', file: new File(['b'], 'b.pdf'), progress: 100 },
      ],
    };
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['zip']),
    });
    const setIsExporting = vi.fn();

    const { result } = renderHook(() =>
      useBatchExport({
        filesRef,
        isMountedRef: { current: true },
        processedResumeIdsRef: { current: [] },
        selectedTemplate: 'template-1',
        exportFormats: ['pdf', 'docx'],
        setIsExporting,
        setIsDeleting: vi.fn(),
        setResumesDeleted: vi.fn(),
      })
    );

    let exportResult = false;
    await act(async () => {
      exportResult = await result.current.startBatchExport();
    });

    expect(exportResult).toBe(true);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      '/api/batch-export',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeIds: ['resume-1', 'resume-2'],
          templateId: 'template-1',
          formats: ['pdf', 'docx'],
        }),
      }),
      300000
    );
    expect(clickMock).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:zip-export');
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(setIsExporting).toHaveBeenNthCalledWith(1, true);
    expect(setIsExporting).toHaveBeenLastCalledWith(false);
  });

  it('deletes processed resumes and marks them as deleted', async () => {
    fetchWithAuthMock.mockResolvedValue({ ok: true });
    const processedResumeIdsRef = { current: ['resume-1', 'resume-2'] };
    const setIsDeleting = vi.fn();
    const setResumesDeleted = vi.fn();

    const { result } = renderHook(() =>
      useBatchExport({
        filesRef: { current: [] },
        isMountedRef: { current: true },
        processedResumeIdsRef,
        selectedTemplate: 'template-1',
        exportFormats: ['pdf'],
        setIsExporting: vi.fn(),
        setIsDeleting,
        setResumesDeleted,
      })
    );

    await act(async () => {
      await result.current.deleteProcessedResumes();
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith('/api/resumes/resume-1', expect.objectContaining({ method: 'DELETE' }));
    expect(fetchWithAuthMock).toHaveBeenCalledWith('/api/resumes/resume-2', expect.objectContaining({ method: 'DELETE' }));
    expect(processedResumeIdsRef.current).toEqual([]);
    expect(setResumesDeleted).toHaveBeenCalledWith(true);
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(setIsDeleting).toHaveBeenNthCalledWith(1, true);
    expect(setIsDeleting).toHaveBeenLastCalledWith(false);
  });
});
