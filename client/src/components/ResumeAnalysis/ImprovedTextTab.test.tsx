import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getVersionsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../../services/resumeVersionsService', () => ({
  getVersions: (...args: unknown[]) => getVersionsMock(...args),
}));

vi.mock('./VersionsPanel', () => ({
  default: ({ isOpen, currentVersion, onClose }: { isOpen: boolean; currentVersion: number; onClose: () => void }) =>
    isOpen ? (
      <div>
        <span>versions-panel:{currentVersion}</span>
        <button onClick={onClose}>close-versions</button>
      </div>
    ) : null,
}));

import ImprovedTextTab from './ImprovedTextTab';

describe('ImprovedTextTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads versions, shows score deltas, opens the versions panel, and saves edited fields on blur', async () => {
    const onUpdateField = vi.fn().mockResolvedValue(undefined);

    getVersionsMock.mockResolvedValue({
      versions: [{ versionNumber: 4 }],
      total: 4,
    });

    render(
      <ImprovedTextTab
        resume={{
          id: 'resume-1',
          Name: 'Ada',
          Title: 'Product Owner',
          'Global Rating': 72,
          'Improved Global Rating': 89,
          'Current Version': 4,
        }}
        onUpdateField={onUpdateField}
        editorSlot={<div>editor-slot</div>}
      />
    );

    await waitFor(() => {
      expect(getVersionsMock).toHaveBeenCalledWith('resume-1', { limit: 1 });
    });

    expect(screen.getByText('editor-slot')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('89%')).toBeInTheDocument();
    expect(screen.getByText('+17%')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Ada'), { target: { value: 'Ada Lovelace' } });
    fireEvent.blur(screen.getByDisplayValue('Ada Lovelace'));
    fireEvent.change(screen.getByDisplayValue('Product Owner'), { target: { value: 'Senior Product Owner' } });
    fireEvent.blur(screen.getByDisplayValue('Senior Product Owner'));

    await waitFor(() => {
      expect(onUpdateField).toHaveBeenCalledWith('Name', 'Ada Lovelace');
    });
    expect(onUpdateField).toHaveBeenCalledWith('Title', 'Senior Product Owner');

    fireEvent.click(screen.getByRole('button', { name: 'v4' }));
    expect(screen.getByText('versions-panel:4')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-versions'));
    expect(screen.queryByText('versions-panel:4')).not.toBeInTheDocument();
  });

  it('runs AI modification and resets the textarea after success', async () => {
    const onAIModify = vi.fn().mockResolvedValue('AI modification applied');

    getVersionsMock.mockResolvedValue({
      versions: [],
      total: 0,
    });

    render(
      <ImprovedTextTab
        resume={{
          id: 'resume-1',
          Name: 'Ada',
          Title: 'Product Owner',
        }}
        onAIModify={onAIModify}
        editorSlot={<div>editor-slot</div>}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText(/Exemple : Rendre le résumé plus concis/i),
      { target: { value: 'Make the summary shorter' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => {
      expect(onAIModify).toHaveBeenCalledWith('Make the summary shorter');
    });
    expect(screen.getByText('AI modification applied')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Exemple : Rendre le résumé plus concis/i)).toHaveValue('');
  });
});
