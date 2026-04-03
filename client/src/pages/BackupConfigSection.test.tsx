import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BackupConfigSection from './BackupConfigSection';
import { defaultSettings, type BackupSettings } from './backupPage.types';

const baseSettings: BackupSettings = {
  ...defaultSettings,
  schedulerStatus: {
    daily: false,
    weekly: false,
    monthly: false,
  },
};

function renderSection(settings: BackupSettings) {
  return render(
    <BackupConfigSection
      settings={settings}
      password=""
      setPassword={vi.fn()}
      saving={false}
      testing={false}
      backingUp={false}
      dayNames={['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']}
      onInputChange={vi.fn()}
      onSave={vi.fn()}
      onTestConnection={vi.fn()}
      onRunBackup={vi.fn()}
    />
  );
}

describe('BackupConfigSection', () => {
  it('keeps manual backup enabled for local targets without remote host', () => {
    renderSection({
      ...baseSettings,
      backup_target: 'local',
      host: '',
    });

    expect(screen.getByRole('button', { name: 'backup.runNow' })).toBeEnabled();
  });

  it('requires remote host before enabling manual backup for remote targets', () => {
    renderSection({
      ...baseSettings,
      backup_target: 'remote',
      host: '',
      username: 'user',
    });

    expect(screen.getByRole('button', { name: 'backup.runNow' })).toBeDisabled();
  });

  it('requires both host and username before testing remote connection', () => {
    renderSection({
      ...baseSettings,
      backup_target: 'remote',
      host: 'ftp.example.com',
      username: '',
    });

    expect(screen.getByRole('button', { name: 'backup.testConnection' })).toBeDisabled();
  });

  it('enables remote connection test when required fields are present', () => {
    const onTestConnection = vi.fn();

    render(
      <BackupConfigSection
        settings={{
          ...baseSettings,
          backup_target: 'remote',
          host: 'ftp.example.com',
          username: 'user',
        }}
        password=""
        setPassword={vi.fn()}
        saving={false}
        testing={false}
        backingUp={false}
        dayNames={['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']}
        onInputChange={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={onTestConnection}
        onRunBackup={vi.fn()}
      />
    );

    const testButton = screen.getByRole('button', { name: 'backup.testConnection' });
    expect(testButton).toBeEnabled();

    fireEvent.click(testButton);
    expect(onTestConnection).toHaveBeenCalledTimes(1);
  });
});
