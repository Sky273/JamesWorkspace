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
  useAuthMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  createTemplateMock: vi.fn(),
  updateTemplateMock: vi.fn(),
  getTemplateByIdMock: vi.fn(),
  useParamsMock: vi.fn(),
  useAuthMock: vi.fn(),
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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../components/AdminFirmSelector', () => ({
  default: () => null,
}));

vi.mock('../components/TiptapEditor/DeferredTiptapEditor', () => ({
  default: function MockDeferredTiptapEditor({
    content,
    onChange,
    onReady,
  }: {
    content: string;
    onChange: (value: string) => void;
    onReady: () => void;
  }) {
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
    useAuthMock.mockReturnValue({
      user: { firmId: 'firm-current', firm_id: 'firm-current', role: 'admin' },
      loading: false,
    });
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

  it('assigns the current user firm to templates loaded from extraction', async () => {
    sessionStorage.setItem('extractedTemplate', JSON.stringify({
      name: 'Template extrait',
      description: 'Description extraite',
      headerContent: '<div>Header</div>',
      templateContent: '<p>Body</p>',
      footerContent: '<div>Footer</div>',
      stylesheet: 'body { color: #111; }',
      tags: ['cv'],
    }));

    render(<NewTemplatePage />);

    await waitFor(() => {
      expect(screen.getByLabelText('templates.editor.name.label')).toHaveValue('Template extrait');
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(createTemplateMock).toHaveBeenCalledWith(expect.objectContaining({
        firm_id: 'firm-current',
        name: 'Template extrait',
      }));
    });

    expect(sessionStorage.getItem('extractedTemplate')).toBeNull();
  });
});
