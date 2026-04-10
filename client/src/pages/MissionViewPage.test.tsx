import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MissionViewPage from './MissionViewPage';

const navigateMock = vi.fn();
const authGetMock = vi.fn();
const toastErrorMock = vi.fn();
const missionPipelineKanbanMock = vi.fn();

let routeParams: { id?: string } = { id: 'mission-1' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: authGetMock,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../components/MissionsPage/MissionPipelineKanban', () => ({
  default: (props: { missionId: string; missionTitle?: string }) => {
    missionPipelineKanbanMock(props);
    return <div data-testid="mission-pipeline">pipeline:{props.missionId}:{props.missionTitle}</div>;
  },
}));

vi.mock('../i18n', () => ({
  default: {
    language: 'fr',
  },
}));

describe('MissionViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { id: 'mission-1' };
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'mission-1',
        Title: 'Product Manager',
        Content: '<p>Mission content</p>',
        Customer: 'Acme',
        Status: 'Active',
        'Created At': '2026-04-10T09:00:00Z',
        'Deal ID': 'deal-1',
        'Deal Title': 'Affaire test',
        'Client Name': 'Acme',
        'Contact Name': 'Jane Doe',
        'Contact Role': 'CTO',
      }),
    });
  });

  it('loads the mission, renders the embedded pipeline, and navigates to edit', async () => {
    render(<MissionViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mission-pipeline')).toHaveTextContent('pipeline:mission-1:Product Manager');

    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));

    expect(navigateMock).toHaveBeenCalledWith('/missions', {
      state: { editMissionId: 'mission-1' },
    });
  });

  it('falls back to the missions list when going back without enough history', async () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 1 },
    });

    render(<MissionViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.back' }));

    expect(navigateMock).toHaveBeenCalledWith('/missions');
  });

  it('shows the mission not found state when loading fails', async () => {
    authGetMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<MissionViewPage />);

    await waitFor(() => {
      expect(screen.getByText('errors.missionNotFound')).toBeInTheDocument();
    });

    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
