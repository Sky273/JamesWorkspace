import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BackupConfigSection from './BackupConfigSection';
import type { BackupSettings } from './backupPage.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

const baseSettings: BackupSettings = {
  backup_target: 'local',
  protocol: 'ftp',
  tls_mode: 'explicit',
  host: '',
  port: 21,
  username: '',
  remote_path: '/backups',
  hasPassword: false,
  daily_enabled: true,
  daily_time: '02:00',
  daily_retention: 7,
  weekly_enabled: false,
  weekly_day: 1,
  weekly_time: '03:00',
  weekly_retention: 4,
  monthly_enabled: false,
  monthly_day: 1,
  monthly_time: '04:00',
  monthly_retention: 12,
  schedulerStatus: {
    daily: true,
    weekly: false,
    monthly: false,
  },
};

describe('BackupConfigSection', () => {
  it('shows the local backup warning and hides remote settings for local backups', () => {
    render(
      <BackupConfigSection
        settings={baseSettings}
        password=""
        setPassword={vi.fn()}
        saving={false}
        testing={false}
        backingUp={false}
        dayNames={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
        onInputChange={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
        onRunBackup={vi.fn()}
      />
    );

    expect(screen.getByText('Local backups are stored on the server. For disaster recovery, consider using remote backup.')).toBeInTheDocument();
    expect(screen.queryByText('backup.connectionTitle')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'backup.runNow' })).toBeEnabled();
  });

  it('disables remote actions without host and credentials, and forwards remote field changes', () => {
    const onInputChange = vi.fn();
    const onTestConnection = vi.fn();
    const onRunBackup = vi.fn();

    render(
      <BackupConfigSection
        settings={{ ...baseSettings, backup_target: 'remote' }}
        password=""
        setPassword={vi.fn()}
        saving={false}
        testing={false}
        backingUp={false}
        dayNames={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
        onInputChange={onInputChange}
        onSave={vi.fn()}
        onTestConnection={onTestConnection}
        onRunBackup={onRunBackup}
      />
    );

    expect(screen.getByText('backup.connectionTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'backup.testConnection' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'backup.runNow' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('ftp.example.com'), { target: { value: 'ftp.example.com' } });
    fireEvent.change(screen.getByDisplayValue('/backups'), { target: { value: '/secure-backups' } });

    expect(onInputChange).toHaveBeenCalledWith('host', 'ftp.example.com');
    expect(onInputChange).toHaveBeenCalledWith('remote_path', '/secure-backups');

    fireEvent.click(screen.getByRole('radio', { name: 'Local only (server disk)' }));
    expect(onInputChange).toHaveBeenCalledWith('backup_target', 'local');
    expect(onTestConnection).not.toHaveBeenCalled();
    expect(onRunBackup).not.toHaveBeenCalled();
  });
});
