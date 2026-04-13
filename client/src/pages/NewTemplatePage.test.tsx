import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';

import NewTemplatePage from './NewTemplatePage';

const {
  navigateMock,
  createTemplateMock,
  updateTemplateMock,
  getTemplateByIdMock,
  useParamsMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  createTemplateMock: vi.fn(),
  updateTemplateMock: vi.fn(),
  getTemplateByIdMock: vi.fn(),
  useParamsMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => useParamsMock(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../utils/viewRefreshScopes', () => ({
  markTemplatesViewDirty: vi.fn(),
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    createTemplate: (...args: unknown[]) => createTemplateMock(...args),
    updateTemplate: (...args: unknown[]) => updateTemplateMock(...args),
    getTemplateById: (...args: unknown[]) => getTemplateByIdMock(...args),
  },
}));

vi.mock('../components/AdminFirmSelector', () => ({
  default: () => null,
}));

vi.mock('../components/TiptapEditor/DeferredTiptapEditor', () => ({
  default: ({
    content,
    onChange,
    onReady,
  }: {
    content: string;
    onChange: (value: string) => void;
    onReady: () => void;
  }) => {
    useEffect(() => {
      onReady();
    }, [onReady]);

    return (
      <textarea
        data-testid="tiptap-editor"
        value={content}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  },
}));

describe('NewTemplatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({});
    createTemplateMock.mockResolvedValue({
      id: 'tpl-new',
      Name: 'Nouveau modele',
      Status: 'active',
    });
  });

  it('redirects to administration templates tab after creating a template', async () => {
    render(<NewTemplatePage />);

    fireEvent.change(screen.getByLabelText('templates.editor.name.label'), {
      target: { value: 'Nouveau modele' },
    });
    fireEvent.change(screen.getByLabelText('templates.editor.statusField.label'), {
      target: { value: 'Active' },
    });
    fireEvent.change(screen.getByLabelText('templates.editor.description.label'), {
      target: { value: 'Description modele' },
    });

    const editors = screen.getAllByTestId('tiptap-editor');
    fireEvent.change(editors[1], { target: { value: '<p>Contenu</p>' } });

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(createTemplateMock).toHaveBeenCalled();
    });

    expect(navigateMock).toHaveBeenCalledWith('/admin?tab=templates', {
      state: {
        createdTemplate: expect.objectContaining({ id: 'tpl-new' }),
      },
    });
  });
});
