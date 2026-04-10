import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetMock = vi.fn();
const authPostMock = vi.fn();
const authPutMock = vi.fn();
const authDeleteMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

const stableT = (key: string, fallback?: string) => fallback || key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
    authPost: (...args: unknown[]) => authPostMock(...args),
    authPut: (...args: unknown[]) => authPutMock(...args),
    authDelete: (...args: unknown[]) => authDeleteMock(...args),
  }),
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('./BackupConfigSection', () => ({
  default: ({ onRunBackup, onSave, onTestConnection }: {
    onRunBackup: () => void;
    onSave: () => void;
    onTestConnection: () => void;
  }) => (
    <div>
      <div>backup-config-section</div>
      <button onClick={onSave}>save-backup</button>
      <button onClick={onTestConnection}>test-backup</button>
      <button onClick={onRunBackup}>run-backup</button>
    </div>
  ),
}));

vi.mock('./BackupHistorySection', () => ({
  default: ({ history, onRefresh }: { history: Array<{ id: string }>; onRefresh: () => void }) => (
    <div>
      <div>backup-history-section:{history.length}</div>
      <button onClick={onRefresh}>refresh-history</button>
    </div>
  ),
}));

vi.mock('./BackupRestoreSection', () => ({
  default: ({ remoteFiles, onRefresh }: { remoteFiles: Array<{ name: string }>; onRefresh: () => void }) => (
    <div>
      <div>backup-restore-section:{remoteFiles.length}</div>
      <button onClick={onRefresh}>refresh-remote</button>
    </div>
  ),
}));

import BackupPage from './BackupPage';

describe('BackupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/backup/settings') {
        return {
          ok: true,
          json: async () => ({
            id: 'settings-1',
            backup_target: 'remote',
            host: 'ftp.example.com',
          }),
        };
      }

      if (url === '/api/backup/history?limit=20') {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: 'history-1' }],
          }),
        };
      }

      if (url === '/api/backup/list-remote') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            files: [{ name: 'backup-1.zip' }],
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({}),
      };
    });
  });

  it('loads settings, switches sections, and refreshes remote files when opening restore', async () => {
    render(<BackupPage />);

    await waitFor(() => {
      expect(screen.getByText('backup-config-section')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'backup.historyTab' }));
    expect(screen.getByText('backup-history-section:1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'backup.restoreTab' }));

    await waitFor(() => {
      expect(screen.getByText('backup-restore-section:1')).toBeInTheDocument();
    });
    expect(authGetMock).toHaveBeenCalledWith('/api/backup/list-remote');
  });

  it('runs backup actions and shows success/error toasts', async () => {
    authPostMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'backup failed' }),
      });
    authPutMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'settings-1', backup_target: 'remote', host: 'ftp.example.com' }),
    });

    render(<BackupPage />);

    await waitFor(() => {
      expect(screen.getByText('backup-config-section')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('save-backup'));
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('backup.saveSuccess');
    });

    fireEvent.click(screen.getByText('run-backup'));
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('backup.backupSuccess');
    });

    fireEvent.click(screen.getByText('test-backup'));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('backup.connectionError');
    });
  });
});
