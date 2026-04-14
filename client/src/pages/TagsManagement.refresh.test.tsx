import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import TagsManagement from './TagsManagement';

const getAllTagsMock = vi.fn();
const getCleanedTagsMock = vi.fn();
const getEscoTagsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin' },
  }),
}));

vi.mock('../utils/tagService', () => ({
  tagService: {
    getAllTags: (...args: unknown[]) => getAllTagsMock(...args),
    getCleanedTags: (...args: unknown[]) => getCleanedTagsMock(...args),
    getEscoTags: (...args: unknown[]) => getEscoTagsMock(...args),
    recalculateCleanedTags: vi.fn(),
    recalculateEscoTags: vi.fn(),
    renameTag: vi.fn(),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('../components/TagsManagement/TagsStatsGrid', () => ({ default: () => <div>stats-grid</div> }));
vi.mock('../components/TagsManagement/TagsToolbar', () => ({ default: () => <div>toolbar</div> }));
vi.mock('../components/TagsManagement/TagsDescriptionBanner', () => ({ default: () => <div>banner</div> }));
vi.mock('../components/TagsManagement/TagsCategoryGrid', () => ({ default: () => <div>grid</div> }));
vi.mock('../components/TagsManagement/TagEditModal', () => ({ default: () => null }));

describe('TagsManagement refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getAllTagsMock.mockResolvedValue({ Skills: [] });
    getCleanedTagsMock.mockResolvedValue({ Skills: [] });
    getEscoTagsMock.mockResolvedValue({ skills: [], industries: [], tools: [], softSkills: [] });
  });

  it('forces tags refresh on mount when the tags scope is dirty', async () => {
    markViewScopesDirty(['tags']);

    render(<TagsManagement embedded />);

    await waitFor(() => {
      expect(getAllTagsMock).toHaveBeenCalledWith(true);
      expect(getCleanedTagsMock).toHaveBeenCalledWith(true);
      expect(getEscoTagsMock).toHaveBeenCalledWith(true);
    });
  });

  it('forces tags refresh on runtime tags dirty events', async () => {
    render(<TagsManagement embedded />);

    await waitFor(() => {
      expect(getAllTagsMock).toHaveBeenCalled();
    });

    getAllTagsMock.mockClear();
    getCleanedTagsMock.mockClear();
    getEscoTagsMock.mockClear();

    markViewScopesDirty(['tags']);

    await waitFor(() => {
      expect(getAllTagsMock).toHaveBeenCalledWith(true);
      expect(getCleanedTagsMock).toHaveBeenCalledWith(true);
      expect(getEscoTagsMock).toHaveBeenCalledWith(true);
    });
  });
});
