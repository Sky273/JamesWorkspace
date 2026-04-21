import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStagesMock = vi.fn();
const getPipelineByResumeIdMock = vi.fn();
const addToPipelineMock = vi.fn();
const getInterviewsMock = vi.fn();
const fetchWithAuthMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const markMissionsViewDirtyMock = vi.fn();

const stableT = (key: string) => key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: {
      language: 'fr',
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../../services/pipelineService', () => ({
  getStages: (...args: unknown[]) => getStagesMock(...args),
  getPipelineByResumeId: (...args: unknown[]) => getPipelineByResumeIdMock(...args),
  addToPipeline: (...args: unknown[]) => addToPipelineMock(...args),
  moveToStage: vi.fn(),
  removeFromPipeline: vi.fn(),
  getPipelineHistory: vi.fn(),
  getInterviews: (...args: unknown[]) => getInterviewsMock(...args),
  scheduleInterview: vi.fn(),
  completeInterview: vi.fn(),
  cancelInterview: vi.fn(),
  updatePipelineNotes: vi.fn(),
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../../utils/viewRefreshScopes', () => ({
  markMissionsViewDirty: (...args: unknown[]) => markMissionsViewDirtyMock(...args),
}));

vi.mock('./pipelineTab/PipelineTabHeader', () => ({
  default: ({ hasEntries, onAdd, t }: { hasEntries: boolean; onAdd: () => void; t: (key: string) => string }) => (
    <div>
      <span>pipeline-header:{String(hasEntries)}</span>
      <button onClick={onAdd}>{t('pipeline.add')}</button>
    </div>
  ),
}));

vi.mock('./pipelineTab/PipelineCard', () => ({
  default: ({ pipeline, onSelect, interviews }: { pipeline: { id: string; notes?: string }; onSelect: () => void; interviews: unknown[] }) => (
    <div>
      <span>pipeline-card:{pipeline.id}:{interviews.length}</span>
      <button onClick={onSelect}>select-{pipeline.id}</button>
    </div>
  ),
}));

vi.mock('./PipelineAddModal', () => ({
  default: ({ newPipeline, setNewPipeline, onAdd, onClose }: {
    newPipeline: { missionId: string; clientId: string; notes: string };
    setNewPipeline: (value: { missionId: string; clientId: string; notes: string }) => void;
    onAdd: () => void;
    onClose: () => void;
  }) => (
    <div>
      <span>pipeline-add-modal</span>
      <button onClick={() => setNewPipeline({ ...newPipeline, missionId: 'mission-1', clientId: 'client-1', notes: 'note' })}>fill-pipeline</button>
      <button onClick={onAdd}>confirm-add-pipeline</button>
      <button onClick={onClose}>close-add-pipeline</button>
    </div>
  ),
}));

vi.mock('./PipelineScheduleModal', () => ({ default: () => <div>schedule-modal</div> }));
vi.mock('./PipelineCompleteModal', () => ({ default: () => <div>complete-modal</div> }));
vi.mock('./PipelineHistoryModal', () => ({ default: () => <div>history-modal</div> }));

import PipelineTab from './PipelineTab';

describe('PipelineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStagesMock.mockResolvedValue([{ id: 'stage-1', name: 'Nouveau' }]);
    getPipelineByResumeIdMock.mockResolvedValue([{ id: 'pipeline-1', notes: 'Initial note' }]);
    getInterviewsMock.mockResolvedValue([{ id: 'interview-1' }]);
    fetchWithAuthMock.mockImplementation(async (url: string) => {
      if (url === '/api/missions?limit=100') {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'mission-1', title: 'Mission PM', client_name: 'Acme' }] }),
        };
      }
      if (url === '/api/clients?limit=100') {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'client-1', name: 'Acme', type: 'client' }] }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    addToPipelineMock.mockResolvedValue({});
  });

  it('loads pipeline data, opens the add modal, and adds the resume to a pipeline', async () => {
    render(<PipelineTab resumeId="resume-1" resumeName="Ada" />);

    await waitFor(() => {
      expect(screen.getByText('pipeline-header:true')).toBeInTheDocument();
    });
    expect(screen.getByText('pipeline-card:pipeline-1:0')).toBeInTheDocument();

    fireEvent.click(screen.getByText('pipeline.add'));
    expect(screen.getByText('pipeline-add-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('fill-pipeline'));
    fireEvent.click(screen.getByText('confirm-add-pipeline'));

    await waitFor(() => {
      expect(addToPipelineMock).toHaveBeenCalledWith({
        resumeId: 'resume-1',
        missionId: 'mission-1',
        clientId: 'client-1',
        notes: 'note',
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('pipeline.addedSuccess');
    await waitFor(() => {
      expect(markMissionsViewDirtyMock).toHaveBeenCalledTimes(1);
      expect(getPipelineByResumeIdMock).toHaveBeenLastCalledWith('resume-1', { forceRefresh: true });
    });
  });

  it('shows an error toast when initial loading fails', async () => {
    getStagesMock.mockRejectedValue(new Error('network'));

    render(<PipelineTab resumeId="resume-1" resumeName="Ada" />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('pipeline.errors.loadFailed');
    });
  });
});
