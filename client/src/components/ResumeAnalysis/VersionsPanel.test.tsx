import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getVersionsMock = vi.fn();
const restoreVersionMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const stableT = (key: string, fallback?: string, values?: { count?: number }) => {
  if (key === 'versions.subtitle' && values?.count !== undefined) {
    return `${values.count} version(s)`;
  }
  return fallback || key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../utils/sanitizer.frontend', () => ({
  createSafeHtml: (html: string) => ({ __html: html }),
}));

vi.mock('../../services/resumeVersionsService', () => ({
  getVersions: (...args: unknown[]) => getVersionsMock(...args),
  restoreVersion: (...args: unknown[]) => restoreVersionMock(...args),
  formatChangeReason: (reason: string) => reason || 'Modification',
  formatVersionDate: (value: string) => `formatted:${value}`,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

import VersionsPanel from './VersionsPanel';

describe('VersionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads versions, expands a preview, and restores a previous version', async () => {
    const onVersionRestored = vi.fn();
    const onPreviewVersion = vi.fn();

    getVersionsMock.mockResolvedValue({
      versions: [
        {
          id: 'v2',
          versionNumber: 2,
          changeReason: 'manual_edit',
          createdAt: '2026-04-10T10:00:00.000Z',
          createdByName: 'Luc',
          improvedGlobalRating: 84,
          improvedText: '<p>Version 2</p>',
        },
        {
          id: 'v1',
          versionNumber: 1,
          changeReason: 'initial_improvement',
          createdAt: '2026-04-09T09:00:00.000Z',
          createdByName: 'Ada',
          improvedGlobalRating: 72,
          improvedText: '<p>Version 1</p>',
        },
      ],
      hasMore: false,
      total: 2,
    });
    restoreVersionMock.mockResolvedValue({
      success: true,
      message: 'restored',
      newVersion: { versionNumber: 3 },
    });

    render(
      <VersionsPanel
        resumeId="resume-1"
        currentVersion={2}
        isOpen={true}
        onClose={vi.fn()}
        onVersionRestored={onVersionRestored}
        onPreviewVersion={onPreviewVersion}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Historique des versions')).toBeInTheDocument();
    });

    expect(getVersionsMock).toHaveBeenCalledWith('resume-1', { limit: 50 });
    expect(screen.getByText('2 version(s)')).toBeInTheDocument();
    expect(screen.getByText('manual_edit')).toBeInTheDocument();
    expect(screen.getByText('initial_improvement')).toBeInTheDocument();

    const callsBeforeRestore = getVersionsMock.mock.calls.length;

    fireEvent.click(screen.getAllByTitle('Aperçu')[1]);
    expect(onPreviewVersion).toHaveBeenCalledWith(
      expect.objectContaining({ versionNumber: 1, id: 'v1' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restaurer' }));

    await waitFor(() => {
      expect(restoreVersionMock).toHaveBeenCalledWith('resume-1', 1);
    });
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(onVersionRestored).toHaveBeenCalledWith(3);
    expect(getVersionsMock.mock.calls.length).toBeGreaterThan(callsBeforeRestore);
  });

  it('shows an empty state when no versions are available', async () => {
    getVersionsMock.mockResolvedValue({
      versions: [],
      hasMore: false,
      total: 0,
    });

    render(
      <VersionsPanel
        resumeId="resume-1"
        currentVersion={1}
        isOpen={true}
        onClose={vi.fn()}
        onVersionRestored={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Aucune version disponible')).toBeInTheDocument();
    });
  });
});
